/**
 * Pure rule-set selector for SmartStack. No database, Shopify token or HTTP
 * dependencies; predictable behaviour can be tested without a running shop.
 * The caller must scope sets to the authenticated merchant before calling.
 */
export function sortRuleSets(sets) {
  const specificity = set => ({products: 3, rules: 2, all: 1})[set.sourceMatch] || 0;
  const time = set => {
    const timestamp = new Date(set.createdAt || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  return [...sets].sort((a,b) =>
    (a.priority - b.priority)
    || (specificity(b) - specificity(a))
    || (time(a) - time(b))
    || String(a.id).localeCompare(String(b.id))
  );
}

export function ruleSetApplies(set, source, sourceId, evaluateGroups, normaliseGroups) {
  if (set.sourceMatch === 'all') return {matched:true, reason:'Applies to all products'};
  if (set.sourceMatch === 'products') {
    const selected = Array.isArray(set.sourceProductIds) ? set.sourceProductIds : [];
    const matched = selected.includes(sourceId);
    return {matched,reason:matched?'Source product explicitly selected':'Source product not selected'};
  }
  if (set.sourceMatch === 'rules') {
    const groups = normaliseGroups(set.sourceRules,set.sourceLogic);
    if (!groups.length || !groups.some(g => g.rules?.length)) {
      return {matched:false,reason:'No source conditions configured'};
    }
    const matched = evaluateGroups(source,groups,set.sourceLogic);
    return {matched,reason:matched?'Source conditions matched':'Source conditions did not match'};
  }
  return {matched:false,reason:'Unknown source targeting'};
}

/**
 * @param {Object} args
 * @param {Array<Object>} args.sets Rules already scoped to one merchant and type
 * @param {Object} args.source Current product
 * @param {string} args.sourceId Product GID
 * @param {Function} args.evaluateGroups Pure condition evaluator
 * @param {Function} args.normaliseGroups Backward-compatible group parser
 * @param {Function} args.recommendForSet Returns a recommendation result
 * @param {string|null} [args.previewSetId] Optional authenticated admin-only override
 * @returns {{selection:Object|null, trace:Array<Object>}}
 */
export function resolveRuleSets({
  sets, source, sourceId, evaluateGroups, normaliseGroups, recommendForSet,
  previewSetId = null,
}) {
  const trace=[];
  for (const set of sortRuleSets(sets)) {
    const entry={
      id:set.id,name:set.name,priority:set.priority,
      status:set.archived?'archived':set.enabled?'active':'draft',
      sourceMatched:false,productCount:0,decision:'skipped',reason:'',
    };
    if (set.archived) {
      entry.reason='Archived set';trace.push(entry);continue;
    }
    if (previewSetId && set.id !== previewSetId) {
      entry.reason='Another set selected for preview';trace.push(entry);continue;
    }
    if (!previewSetId && !set.enabled) {
      entry.reason='Set is paused or a draft';trace.push(entry);continue;
    }
    const applies=ruleSetApplies(set,source,sourceId,evaluateGroups,normaliseGroups);
    entry.sourceMatched=applies.matched;
    entry.reason=applies.reason;
    if (!applies.matched) {
      entry.decision='source_mismatch';trace.push(entry);continue;
    }

    const output=recommendForSet(set);
    entry.productCount=output?.items?.length||0;
    if (entry.productCount>0) {
      entry.decision='selected';
      entry.reason='Matched source and found '+entry.productCount+' eligible recommendation(s)';
      trace.push(entry);
      return {selection:{set,output},trace};
    }

    if (previewSetId || set.fallbackMode === 'stop') {
      entry.decision='stopped_empty';
      entry.reason=previewSetId
        ? 'Selected preview has no eligible recommendations (storefront fallback is not being simulated)'
        : 'No eligible recommendations; the set is configured to stop here';
      trace.push(entry);
      return {selection:{set,output},trace};
    }
    entry.decision='fallback';
    entry.reason='No eligible recommendations; checking the next matching set';
    trace.push(entry);
  }
  return {selection:null,trace};
}


/**
 * Assemble one storefront block from several matching IF→THEN rows.
 *
 * max counts RECOMMENDATION slots (not the current product). For bundles the
 * server passes at most 7 slots so main product + 7 add-ons <= 8 total.
 * Each row contributes at most its own maxItems, in priority order.
 * Excluded/unpublished products must already be filtered by recommendForSet.
 * A secondary ID deduplication guard prevents repeating products between rows.
 *
 * No state is mutated, and previewSetId can simulate an inactive draft.
 */
export function aggregateRuleSets({
  sets, source, sourceId, evaluateGroups, normaliseGroups, recommendForSet,
  max=8, previewSetId=/** @type {string | null} */ (null),
}) {
  const blockLimit=Math.max(0,Math.min(8,Math.floor(Number(max) || 0)));
  const trace=[], items=[], contributors=[];
  const usedIds=new Set([sourceId]);
  for(const set of sortRuleSets(sets)){
    const row={
      id:set.id,name:set.name,priority:set.priority,
      status:set.archived?'archived':set.enabled?'active':'draft',
      requested:0,productCount:0,sourceMatched:false,
      decision:'skipped',reason:''
    };
    if(items.length>=blockLimit){
      row.reason='Block is full ('+blockLimit+' products)';
      row.decision='full';trace.push(row);continue;
    }
    if(set.archived){
      row.reason='Archived set';trace.push(row);continue;
    }
    if(previewSetId && set.id!==previewSetId){
      row.reason='Another set selected for preview';trace.push(row);continue;
    }
    if(!previewSetId && !set.enabled){
      row.reason='Set paused or still a draft';trace.push(row);continue;
    }
    const applies=ruleSetApplies(set,source,sourceId,evaluateGroups,normaliseGroups);
    row.sourceMatched=applies.matched;
    if(!applies.matched){
      row.decision='source_mismatch';
      row.reason=applies.reason;trace.push(row);continue;
    }
    const remaining=blockLimit-items.length;
    const perSet=Math.max(1,Math.min(8,Math.floor(Number(set.maxItems)||1)));
    row.requested=Math.min(perSet,remaining);
    const output=recommendForSet(set,row.requested,new Set(usedIds));
    const unique=[];
    for(const entry of (output?.items||[])){
      const id=entry?.product?.id;
      if(!id || usedIds.has(id))continue;
      unique.push(entry);
      usedIds.add(id);
      if(unique.length===row.requested)break;
    }
    row.productCount=unique.length;
    if(unique.length){
      items.push(...unique);
      contributors.push({set,items:unique,output});
      row.decision='contributed';
      row.reason='Contributed '+unique.length+' of '+row.requested+' requested product(s)';
      trace.push(row);
      // Continue into the next matching IF→THEN row until the ONE block is full.
      if(previewSetId)break;
      continue;
    }
    if(previewSetId){
      row.decision='empty_preview';
      row.reason='This draft has no eligible results; other sets were not simulated';
      trace.push(row);break;
    }
    if(set.fallbackMode==='stop'){
      row.decision='stopped_empty';
      row.reason='No eligible recommendations; this row is configured to stop further fallback';
      trace.push(row);break;
    }
    row.decision='fallback';
    row.reason='No eligible recommendations; checking the next matching set';
    trace.push(row);
  }
  return {items,contributors,trace,blockLimit};
}
