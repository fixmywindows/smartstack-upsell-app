import {verifyAttributionToken,estimateCommission} from "./attribution-token.mjs";

export function currencyDigits(currency) {
  try{return new Intl.NumberFormat("en-GB",{style:"currency",currency}).resolvedOptions().maximumFractionDigits;}
  catch{return 2;}
}
/**
 * Verify purchases from Shopify Admin Order line items.
 * - Token came from a SmartStack button add and is HMAC-signed for this shop/product.
 * - Refunds/removals are reflected by line.currentQuantity.
 * - Discounted unit shopMoney excludes tax/shipping; no currencies are combined.
 */
export function verifiedPurchases(secret,shop,order,plan) {
  if(!order?.fullyPaid || order.test || order.cancelledAt ||
     order.lineItems?.pageInfo?.hasNextPage || !Array.isArray(order.lineItems?.nodes))return [];
  const at=Date.parse(order.createdAt);
  if(!Number.isFinite(at))return [];
  const results=[];
  for(const line of order.lineItems.nodes){
    if(!line?.id||!line?.product?.id||Number(line.currentQuantity)<=0)continue;
    const attribute=line.customAttributes?.find(a=>a?.key==="_smartstack_ref");
    if(!attribute?.value)continue;
    const claim=verifyAttributionToken(secret,shop,attribute.value,at);
    if(!claim||claim.product!==line.product.id)continue;
    const money=line.discountedUnitPriceAfterAllDiscountsSet?.shopMoney;
    if(!money||typeof money.currencyCode!=="string")continue;
    const quantity=Math.min(1000,Math.floor(Number(line.currentQuantity)));
    const unit=Number(money.amount);
    if(!Number.isFinite(unit)||unit<0||unit>1e9)continue;
    const multiplier=10**currencyDigits(money.currencyCode);
    const revenueMinor=Math.round(unit*quantity*multiplier);
    const commission=estimateCommission(revenueMinor,plan);
    results.push({
      lineId:line.id,productId:claim.product,sourceProductId:claim.source,
      setId:claim.set,groupIndex:claim.group,kind:claim.kind,
      quantity,currencyCode:money.currencyCode,netRevenueMinor:revenueMinor,
      commissionBasisPoints:commission.bps,estimatedCommissionMinor:commission.amountMinor,
      purchasedAt:new Date(at)
    });
  }
  return results;
}
