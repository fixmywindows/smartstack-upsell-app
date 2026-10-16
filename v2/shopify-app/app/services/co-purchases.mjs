/**
 * Privacy-minimised product-level co-purchases.
 * Do not pass customer PII, email, addresses or order totals into this module.
 * Count distinct eligible orders (not line quantities); only genuinely
 * paid, non-test, non-cancelled orders provide evidence.
 */
const uniqueIds=ids=>[...new Set(ids.filter(id=>
  typeof id==='string' && /^gid:\/\/shopify\/Product\/[0-9]+$/.test(id)))].sort();

export function eligibleOrderProducts(order) {
  if(!order || order.test || order.cancelledAt || !order.fullyPaid) return [];
  if(order.lineItems?.pageInfo?.hasNextPage)return []; // never claim partial order
  const nodes=order.lineItems?.nodes;
  if(!Array.isArray(nodes))return [];
  // Avoid 900+ pair combinations in an unusually large order.
  const ids=uniqueIds(nodes.filter(line=>Number(line.currentQuantity)>0)
    .map(line=>line.product?.id));
  return ids.length>=2 && ids.length<=30 ? ids : [];
}
export function pairsForProducts(ids) {
  const items=uniqueIds(ids);
  const result=[];
  for(let a=0;a<items.length;a++){
    for(let b=a+1;b<items.length;b++){
      result.push([items[a],items[b]]);
    }
  }
  return result;
}
export function diffOrderPairs(before=[],after=[]) {
  const previous=new Set(pairsForProducts(before).map(x=>x.join('|')));
  const next=new Set(pairsForProducts(after).map(x=>x.join('|')));
  return {
    remove:[...previous].filter(k=>!next.has(k)).map(k=>k.split('|')),
    add:[...next].filter(k=>!previous.has(k)).map(k=>k.split('|')),
  };
}
export function observedPairMap(sourceId,rows) {
  const pairs={};
  for(const row of rows){
    if(!Number.isInteger(row.orderCount) || row.orderCount<2)continue;
    const other=row.productA===sourceId?row.productB:
      row.productB===sourceId?row.productA:null;
    if(!other)continue;
    pairs[other]=row.orderCount;
  }
  return pairs;
}
