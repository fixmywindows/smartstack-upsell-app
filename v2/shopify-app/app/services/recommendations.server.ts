import db from "../db.server";
import { normaliseRuleGroups } from "../utils/rule-groups";
import { getObservedPairs } from "./order-signals.server";
// @ts-ignore — pure JS engine, tested with Node.
import { recommend, evaluateGroups } from "./engine.mjs";
// @ts-ignore — independent, deterministic aggregator, tested with Node.
import { aggregateRuleSets } from "./set-matching.mjs";

export const BLOCK_KINDS = ["similar","complement","bought_together","bundle"] as const;
export type BlockKind = typeof BLOCK_KINDS[number];
export const BLOCK_TITLES:Record<BlockKind,string> = {
  similar:"Similar products",
  complement:"Pairs perfectly with",
  bought_together:"Pairs well with",
  bundle:"Complete the set",
};
type PreviewOptions={diagnostics?:boolean;previewSetId?:string|null};
const array=(value:unknown):string[]=>Array.isArray(value)?
  value.filter((v):v is string=>typeof v==="string"):[];
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.floor(n)||min));

export async function getRecommendations(
  shopDomain:string,sourceId:string,kind:BlockKind,max:number,options:PreviewOptions={}
){
  const [legacy,sets,snapshots]=await Promise.all([
    db.recommendationBlock.findUnique({where:{shopDomain_kind:{shopDomain,kind}}}),
    db.recommendationRuleSet.findMany({where:{shopDomain,kind},
      orderBy:[{priority:"asc"},{createdAt:"asc"}]}),
    db.productSnapshot.findMany({where:{shopDomain},take:1000,orderBy:{title:"asc"}})
  ]);
  const products=snapshots.map(p=>({
    id:p.productId,title:p.title,handle:p.handle,category:p.category,
    productType:p.productType,vendor:p.vendor,priceCents:p.priceMinor,
    available:p.available,published:p.published,
    tags:array(p.tags),collections:array(p.collections),
    metafields:p.metafields as Record<string,unknown>,
    imageUrl:p.imageUrl,variantId:p.variantId,
    variantsComplete:p.variantsComplete,currencyCode:p.currencyCode
  }));
  type Product=typeof products[number];
  const source=products.find(p=>p.id===sourceId);
  if(!source)throw new Error("Source product does not exist");
  // The block-wide cap is 8 TOTAL products. Bundles use one slot for the
  // current source product and up to seven for add-ons.
  const blockLimit=clamp(max,1,8);
  const addonLimit=kind==="bundle"?Math.max(0,blockLimit-1):blockLimit;
  const pairs=kind==="bought_together"?await getObservedPairs(shopDomain,sourceId):{};
  const configFor=(set:typeof sets[number],desired:number,used:Set<string>)=>({
    kind,mode:set.selectionMode,heading:set.heading,
    maxItems:Math.max(1,Math.min(8,desired)),
    pinnedIds:array(set.pinnedIds),
    excludeTags:array(set.excludeTags),
    excludeIds:[...new Set([...array(set.excludedProductIds),...used])],
    ruleGroups:normaliseRuleGroups(set.targetRules,set.targetLogic),
    ruleOuterLogic:set.targetLogic,
    excludeGroups:normaliseRuleGroups(set.excludeRules,set.excludeLogic),
    excludeOuterLogic:set.excludeLogic,
  });
  type EngineItem={product:Product;evidence?:string;count?:number|null};
  type Contributor={set:typeof sets[number];items:EngineItem[];output:ReturnType<typeof recommend>};
  let contributions:Contributor[]=[];
  let trace:Array<{id:string;name:string;priority:number;status:string;
    requested:number;sourceMatched:boolean;productCount:number;decision:string;reason:string}>=[];
  let legacyOutput:ReturnType<typeof recommend>|null=null;

  if(sets.length){
    if(options.previewSetId && !sets.some(s=>s.id===options.previewSetId&&!s.archived)){
      throw new Error("Selected preview set does not exist in this store");
    }
    const result=aggregateRuleSets({
      sets,source,sourceId,evaluateGroups,normaliseGroups:normaliseRuleGroups,
      max:addonLimit,previewSetId:options.previewSetId||null,
      recommendForSet:(set:typeof sets[number],requested:number,used:Set<string>)=>
        recommend({sourceId,products,pairs,config:configFor(set,requested,used)})
    });
    contributions=result.contributors as Contributor[];
    trace=result.trace as typeof trace;
  }else if(legacy?.enabled&&!options.previewSetId&&addonLimit>0){
    // Compatibility fallback for shops which have not migrated from Phase 1.
    legacyOutput=recommend({sourceId,products,pairs,config:{
      kind,mode:legacy.mode,heading:legacy.heading,maxItems:Math.min(addonLimit,legacy.maxItems),
      pinnedIds:array(legacy.pinnedIds),excludeTags:array(legacy.excludedTags),
      ruleGroups:Array.isArray(legacy.ruleGroups)?legacy.ruleGroups:[]
    }});
  }

  const annotated=contributions.flatMap(({set,items})=>
    items.map(item=>({...item,sourceSetId:set.id,sourceSetName:set.name})));
  const legacyAnnotated=((legacyOutput?.items||[]) as EngineItem[]).map(item=>({
    ...item,sourceSetId:"legacy",sourceSetName:"Original configuration"
  }));
  const selected=annotated.length?annotated:legacyAnnotated;
  const hasObserved=selected.some(item=>item.evidence==="observed");
  // One storefront heading covers products from every IF→THEN row.
  const heading=kind==="bought_together"&&!hasObserved?"Pairs well with":BLOCK_TITLES[kind];
  // Fetch only variants shown to this shopper, never the whole catalogue's
  // variants or merchant-private variant inventory metadata.
  const displayedIds=[sourceId,...selected.map(item=>item.product.id)];
  const variantRecords=await db.productVariantSnapshot.findMany({
    where:{shopDomain,productId:{in:[...new Set(displayedIds)]},available:true},
    orderBy:{variantId:"asc"},
    select:{productId:true,variantId:true,title:true,priceMinor:true,
      compareAtMinor:true,options:true,imageUrl:true}
  });
  const byProduct=new Map<string,typeof variantRecords>();
  for(const variant of variantRecords){
    const list=byProduct.get(variant.productId)||[];
    list.push(variant);
    byProduct.set(variant.productId,list);
  }
  const makeProduct=(p:Product)=>{
    const saved=byProduct.get(p.id)||[];
    const variants=saved.map(v=>({
      id:v.variantId.split("/").pop()||"",
      title:v.title,priceMinor:v.priceMinor,
      compareAtMinor:v.compareAtMinor,
      options:Array.isArray(v.options)?v.options:[],
      imageUrl:v.imageUrl||p.imageUrl
    }));
    // A partially synced product can have more variants than are known.
    // Never add its first variant without customer confirmation.
    const complete=p.variantsComplete!==false;
    const selectedId=complete && variants.length===1?variants[0].id:
      complete && variants.length===0?p.variantId?.split("/").pop()||"":"";
    return {
      id:p.id,title:p.title,vendor:p.vendor,
      url:"/products/"+encodeURIComponent(p.handle),imageUrl:p.imageUrl,
      available:p.available,variantId:selectedId,
      requiresVariantChoice:!complete||variants.length>1,
      variantsComplete:complete,variants,currencyCode:p.currencyCode||"GBP",
      priceMinor:p.priceCents,
      priceFormatted:new Intl.NumberFormat("en-GB",{
        style:"currency",currency:p.currencyCode||"GBP"
      }).format(p.priceCents/100)
    };
  };

  const matchedSets=contributions.map(c=>({
    id:c.set.id,name:c.set.name,priority:c.set.priority,
    productCount:c.items.length,requested:Math.min(c.set.maxItems,addonLimit)
  }));
  const warning=selected.length?null:
    trace.some(row=>row.decision==="stopped_empty")
      ?"The matching set stopped because no products were eligible."
      : "No eligible products across the matching recommendation sets.";
  return {
    heading,items:selected.slice(0,addonLimit).map(item=>({
      ...makeProduct(item.product),
      reason:item.evidence==="merchant"?"Manually pinned"
        :item.evidence==="observed"?"Ordered together "+(item.count??0)+" times"
        :"Matched using product attributes",
      ...(options.diagnostics?{sourceSetId:item.sourceSetId,sourceSetName:item.sourceSetName}:{})
    })),
    source:kind==="bundle"?makeProduct(source):null,
    basis:hasObserved?"order_history":selected.some(item=>item.evidence==="merchant")?
      "merchant":"attributes",
    warning,
    // Backward-compatible field for existing admin preview.
    matchedSet:options.diagnostics?(matchedSets[0]||null):null,
    // Only the authenticated admin gets rule names and allocation details.
    ...(options.diagnostics?{trace,matchedSets,blockLimit,allocatedSlots:selected.length+(kind==="bundle"?1:0),
      remainingSlots:Math.max(0,blockLimit-selected.length-(kind==="bundle"?1:0))}:{})
  };
}
