import {recommend} from "./engine.mjs";

/**
 * Every THEN group can fill its own product slots inside ONE recommendation row.
 *
 * mode=filter: old ALL/ANY behaviour is deliberately unchanged.
 * mode=allocate: groups are independent candidate pools; within-group logic
 * still uses AND/OR, but the groups' results are combined in priority order.
 * Merchant hard exclusions/availability/compatibility are re-evaluated for
 * every pool. Repeated product IDs are excluded both within and across pools.
 */
export function recommendWithGroups({sourceId,products,pairs={},config,semanticScores={}}) {
  if(config.targetMode!=="allocate"){
    return recommend({sourceId,products,pairs,config,semanticScores});
  }
  const groups=Array.isArray(config.ruleGroups)?config.ruleGroups:[];
  const max=Math.max(0,Math.min(config.kind==="bundle"?7:8,
    Math.floor(Number(config.maxItems)||0)));
  const source=products.find(p=>p.id===sourceId);
  if(!source)throw Error("Source product does not exist");
  const used=new Set([sourceId,...(config.excludeIds||[])]);
  const items=[],groupContributions=[];
  let observed=false,merchant=false;
  for(let index=0;index<groups.length;index++){
    const group=groups[index];
    const quota=Number.isInteger(Number(group.maxItems))?
      Math.max(1,Math.min(8,Number(group.maxItems))):1;
    const request=Math.min(quota,max-items.length);
    if(request<=0)break;
    const out=recommend({
      sourceId,products,pairs,semanticScores,
      config:{...config,
        ruleGroups:[{logic:group.logic,rules:group.rules}],
        ruleOuterLogic:"AND",excludeIds:[...used],maxItems:request}
    });
    const added=[];
    for(const item of out.items||[]){
      if(!item?.product?.id||used.has(item.product.id))continue;
      used.add(item.product.id);
      const entry={...item,groupIndex:index};
      items.push(entry);added.push(entry);
      observed||=item.evidence==="observed";
      merchant||=item.evidence==="merchant";
      if(added.length>=request)break;
    }
    groupContributions.push({index,requested:request,contributed:added.length});
  }
  return {
    source,kind:config.kind,items,
    heading:config.kind==="bought_together"?(observed?"Frequently bought together":"Pairs well with"):
      config.heading||"Recommended products",
    basis:observed?"order_history":merchant?"merchant":"attributes",
    warning:items.length?null:"No products meet the configured group conditions.",
    groupContributions
  };
}
