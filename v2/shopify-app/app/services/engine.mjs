/**
 * SmartStack v2: deterministic, testable recommendation engine.
 * Input is pre-normalised catalogue + co-purchase counts. No Shopify secrets.
 * IMPORTANT: this is the heuristic/cold-start engine; a production AI semantic
 * scorer and Shopify data sync will be connected as separate adapters.
 */

export const BLOCK_TYPES = Object.freeze({
  SIMILAR: 'similar',
  COMPLEMENT: 'complement',
  BOUGHT_TOGETHER: 'bought_together',
  BUNDLE: 'bundle',
});
export const MODES = Object.freeze({ AUTO: 'ai', MANUAL: 'manual', HYBRID: 'hybrid' });

const COMPLEMENTS = {
  sofas: ['cushions', 'throws', 'coffee-tables'],
  'football-goals': ['footballs', 'training-cones', 'goal-nets'],
  cameras: ['camera-lenses', 'camera-batteries', 'memory-cards', 'camera-bags'],
  'training-manikins': ['training-aeds', 'first-aid-accessories'],
  'dining-tables': ['dining-chairs', 'tableware'],
  'cat-carriers': ['cat-harnesses', 'pet-accessories'],
};

const stopWords = new Set(['and','the','a','an','with','for','of','by','to','in','on','new','plus','set','pro']);
const tokens = value => new Set(String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(t => t.length > 2 && !stopWords.has(t)));
const compare = (a,b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
const toStrings = x => Array.isArray(x) ? x.map(v=>String(v).toLowerCase()) : String(x ?? '').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
const asNumber = x => Number(x);

/** @returns {unknown} */
export function getField(product, field) {
  if (field.startsWith('metafield:')) return product.metafields?.[field.slice(10)];
  if (field === 'title') return product.title;
  if (field === 'category') return product.category;
  if (field === 'product_type') return product.productType;
  if (field === 'vendor') return product.vendor;
  if (field === 'price') return product.priceCents;
  if (field === 'tags') return product.tags ?? [];
  if (field === 'collections') return product.collections ?? [];
  if (field === 'available') return product.available;
  return undefined; // arbitrary object traversal is intentionally prohibited
}

/**
 * Rule comparison is case-insensitive for text, and numeric for prices.
 * Example: {field:'metafield:spec.material', op:'equals', value:'velvet'}
 */
export function evaluateRule(product, rule) {
  if (!rule?.field || !rule?.op) return false;
  const value = getField(product, rule.field);
  const expected = rule.value;
  if (value === undefined || value === null) return rule.op === 'not_exists';
  if (rule.op === 'exists') return true;
  if (rule.op === 'not_exists') return false;
  const actualList = Array.isArray(value) ? value : [value];
  switch(rule.op) {
    case 'equals': return actualList.some(v=>compare(v,expected));
    case 'not_equals': return actualList.every(v=>!compare(v,expected));
    case 'contains': return actualList.some(v=>String(v).toLowerCase().includes(String(expected ?? '').toLowerCase()));
    case 'starts_with': return actualList.some(v=>String(v).toLowerCase().startsWith(String(expected ?? '').toLowerCase()));
    case 'ends_with': return actualList.some(v=>String(v).toLowerCase().endsWith(String(expected ?? '').toLowerCase()));
    case 'not_starts_with': return actualList.every(v=>!String(v).toLowerCase().startsWith(String(expected ?? '').toLowerCase()));
    case 'not_ends_with': return actualList.every(v=>!String(v).toLowerCase().endsWith(String(expected ?? '').toLowerCase()));
    case 'not_contains': return actualList.every(v=>!String(v).toLowerCase().includes(String(expected ?? '').toLowerCase()));
    case 'any_of': return actualList.some(v => toStrings(expected).includes(String(v).toLowerCase()));
    case 'all_of': return toStrings(expected).every(v=>actualList.map(x=>String(x).toLowerCase()).includes(v));
    case 'gte': return Number.isFinite(asNumber(value)) && asNumber(value) >= asNumber(expected);
    case 'lte': return Number.isFinite(asNumber(value)) && asNumber(value) <= asNumber(expected);
    default: return false;
  }
}

export function evaluateGroups(product, groups=[], outerLogic='AND') {
  // No filter configured: all products are eligible. An explicitly empty group
  // is not a wildcard: it must never accidentally match every product.
  if (!Array.isArray(groups) || groups.length === 0) return true;
  const matches = groups.map(group => {
    const rules = Array.isArray(group?.rules)
      ? group.rules.filter(r => r?.field && r?.op) : [];
    if (rules.length === 0) return false;
    return group.logic === 'OR'
      ? rules.some(r => evaluateRule(product,r))
      : rules.every(r => evaluateRule(product,r));
  });
  return outerLogic === 'OR' ? matches.some(Boolean) : matches.every(Boolean);
}

function isCompatible(source, candidate) {
  // Exclude variants/accessories explicitly requiring a known incompatible spec.
  for(const [key, value] of Object.entries(candidate.requires ?? {})) {
    const sourceValue = source.metafields?.[key];
    if (sourceValue === undefined || !toStrings(value).some(v=>toStrings(sourceValue).includes(v))) return false;
  }
  return true;
}

function eligible(source, candidate, config) {
  if (source.id === candidate.id) return false;
  if (!candidate.available || candidate.published === false) return false;
  if ((config.excludeIds ?? []).includes(candidate.id)) return false;
  if ((config.excludeCategories ?? []).includes(candidate.category)) return false;
  if ((config.excludeTags ?? []).some(t=>(candidate.tags??[]).some(ct=>compare(t,ct)))) return false;
  if (config.minPriceCents != null && candidate.priceCents < config.minPriceCents) return false;
  if (config.maxPriceCents != null && candidate.priceCents > config.maxPriceCents) return false;
  if (!evaluateGroups(candidate, config.ruleGroups ?? [], config.ruleOuterLogic ?? 'AND')) return false;
  if (Array.isArray(config.excludeGroups) && config.excludeGroups.length > 0
      && evaluateGroups(candidate, config.excludeGroups, config.excludeOuterLogic ?? 'OR')) return false;
  if (!isCompatible(source,candidate)) return false;
  return true;
}

function overlap(source, candidate) {
  const a=tokens(source.title), b=tokens(candidate.title);
  if (!a.size || !b.size) return 0;
  return [...a].filter(x=>b.has(x)).length / new Set([...a,...b]).size;
}

function similarity(source,candidate) {
  if (source.category !== candidate.category && source.productType !== candidate.productType) return -Infinity;
  const sameCategory = source.category === candidate.category ? 100 : 0;
  const sameType = source.productType === candidate.productType ? 30 : 0;
  const textOverlap = 30*overlap(source,candidate);
  const priceDistance = 15 * (1-Math.min(1, Math.abs(Math.log((candidate.priceCents+1)/(source.priceCents+1)))));
  return sameCategory + sameType + textOverlap + priceDistance + (source.vendor === candidate.vendor ? 4 : 0);
}

function complementary(source,candidate) {
  const categories = COMPLEMENTS[source.category] || [];
  if (!categories.includes(candidate.category)) return -Infinity;
  let score = 100 - 4*categories.indexOf(candidate.category);
  score += overlap(source,candidate)*10;
  return score;
}

function coPurchased(source,candidate,pairs) {
  const count = pairs?.[source.id]?.[candidate.id] ?? pairs?.[candidate.id]?.[source.id] ?? 0;
  return count >= 2 ? {score:200+Math.log2(count)*20,evidence:'observed',count} : null;
}

/**
 * @param {{sourceId:string, products:Array<object>,config:object,pairs?:object,semanticScores?:object}} input
 * @returns {{source:object,kind:string,heading:string,items:Array<object>,basis:string,warning:string|null}}
 */
export function recommend({sourceId,products,config,pairs={},semanticScores={}}) {
  const source = products.find(p=>p.id===sourceId);
  if (!source) throw new Error('Source product does not exist');
  const kind = config.kind ?? BLOCK_TYPES.COMPLEMENT;
  const mode = config.mode ?? MODES.HYBRID;
  if (!Object.values(BLOCK_TYPES).includes(kind)) throw new Error('Unknown block type');
  if (!Object.values(MODES).includes(mode)) throw new Error('Unknown selection mode');
  const max = Math.max(1,Math.min(kind===BLOCK_TYPES.BUNDLE?3:12,Math.floor(Number(config.maxItems ?? 4))));
  const byId = new Map(products.map(p=>[p.id,p]));
  const pool = products.filter(p=>eligible(source,p,config));
  const allowed = new Set(pool.map(p=>p.id));
  const pinnedIds = [...new Set((config.pinnedIds??[]).concat(config.manualIds??[]))];
  const pinned = mode === MODES.AUTO ? [] : pinnedIds.filter(id=>allowed.has(id)).map(id=>({product:byId.get(id),score:1e6,evidence:'merchant',count:null}));
  const used = new Set(pinned.map(p=>p.product.id));
  const auto = [];
  let heading = config.heading || ({similar:'Similar products',complement:'Pairs perfectly with',bought_together:'Frequently bought together',bundle:'Complete the set'}[kind]);
  let basis = 'attributes';
  let warning = null;

  if (mode !== MODES.MANUAL) {
    for(const candidate of pool) {
      if (used.has(candidate.id)) continue;
      let score = -Infinity,evidence='inferred',count=null;
      if(kind === BLOCK_TYPES.SIMILAR) score=similarity(source,candidate);
      if(kind === BLOCK_TYPES.COMPLEMENT || kind === BLOCK_TYPES.BUNDLE) score=complementary(source,candidate);
      if(kind === BLOCK_TYPES.BOUGHT_TOGETHER) {
        const pair=coPurchased(source,candidate,pairs);
        if(pair) ({score,evidence,count}=pair);
      }
      // Semantic scoring is additive AFTER hard eligibility/compatibility checks.
      // It must come from an approved, cached model and cannot bypass merchant rules.
      if(Number.isFinite(score)) {
        score += Math.max(-20,Math.min(20,Number(semanticScores?.[source.id]?.[candidate.id]??0)));
        auto.push({product:candidate,score,evidence,count});
      }
    }
    auto.sort((a,b)=>b.score-a.score || a.product.id.localeCompare(b.product.id));
    if (kind === BLOCK_TYPES.BOUGHT_TOGETHER && !auto.length) {
      // Never claim order-history evidence that does not exist.
      heading = 'Pairs well with';
      basis = 'cold_start';
      warning = 'Insufficient order history: showing inferred complementary products instead.';
      for(const p of pool){const score=complementary(source,p);if(Number.isFinite(score))auto.push({product:p,score,evidence:'inferred',count:null});}
      auto.sort((a,b)=>b.score-a.score || a.product.id.localeCompare(b.product.id));
    } else if(kind===BLOCK_TYPES.BOUGHT_TOGETHER) basis='order_history';
  }
  let items=[...pinned,...auto].slice(0,max);
  if(kind===BLOCK_TYPES.BOUGHT_TOGETHER && mode===MODES.HYBRID && pinned.length && auto.length){
    heading='Frequently bought together and hand-picked';
  }
  if(kind===BLOCK_TYPES.BOUGHT_TOGETHER && mode===MODES.MANUAL){
    heading='Recommended together'; basis='merchant';
  }
  if(!items.length) warning = warning ?? 'No products match the current availability and matching rules.';
  return {source,kind,heading,items,basis,warning};
}

/** Verify selected bundle and calculate preview savings in integer cents.
 * Checkout application of the discount must be separately verified via Shopify Functions.
 */
export function bundleTotals({items,selectedIds,discount={type:'none',value:0},requireAll=true}) {
  if(!Array.isArray(items)||items.length<2||items.length>4)throw new Error('Bundle must contain 2–4 products');
  const selected=new Set(selectedIds);
  const chosen=items.filter(item=>selected.has(item.id));
  const subtotalCents=chosen.reduce((sum,item)=>sum+Math.max(0,Math.round(item.priceCents)),0);
  const qualifies=chosen.length>=2 && (!requireAll || chosen.length===items.length);
  let savingCents=0;
  if(qualifies){
    if(discount.type==='percentage') savingCents=Math.round(subtotalCents*Math.min(100,Math.max(0,Number(discount.value)||0))/100);
    else if(discount.type==='fixed') savingCents=Math.min(subtotalCents,Math.max(0,Math.round(Number(discount.value)||0)));
    else if(discount.type==='fixed_total') savingCents=Math.max(0,subtotalCents-Math.max(0,Math.round(Number(discount.value)||0)));
    else if(discount.type!=='none') throw new Error('Unknown discount type');
  }
  return {subtotalCents,savingCents,totalCents:subtotalCents-savingCents,qualifies,numberOfItems:chosen.length};
}
