/** SmartStack pricing prototype. All values integer pence (GBP for demo). */
export const PLANS = Object.freeze({
  free: {name:'Free', monthlyCents:0, rate:0.03, design:'basic', analytics:false},
  growth: {name:'Growth', monthlyCents:1500, rate:0.015, design:'full', analytics:false},
  insights: {name:'Insights', monthlyCents:4500, rate:0.005, design:'full', analytics:true},
});

/** Commission is charged ONLY on net qualifying add-on line revenue:
 *  - exclude originally viewed item, tax, shipping, untracked lines
 *  - account for discounts and refunds (in pence)
 *  - duplicate orderId+lineId pairs are ignored (ledger idempotency)
 */
export function quoteCommission({plan='free',lines=[]}) {
  const pricing=PLANS[plan];
  if(!pricing)throw new Error('Unknown plan');
  let eligibleCents=0;
  const seen=new Set(),ledger=[];
  for(const line of lines){
    const identity=`${line.orderId}:${line.lineId}`;
    if(seen.has(identity))continue;
    seen.add(identity);
    if(!line.widgetAttributed || line.isSourceItem || !line.approvedAttribution)continue;
    const gross=Math.max(0,Math.round(Number(line.priceCents)||0))*Math.max(0,Math.floor(Number(line.quantity)||0));
    const discount=Math.max(0,Math.round(Number(line.discountCents)||0));
    const refunded=Math.max(0,Math.round(Number(line.refundedCents)||0));
    const netCents=Math.max(0,gross-discount-refunded);
    if(!netCents)continue;
    eligibleCents+=netCents;
    ledger.push({identity,netCents});
  }
  return {plan,eligibleCents,commissionCents:Math.round(eligibleCents*pricing.rate),monthlyCents:pricing.monthlyCents,ledger};
}

export function estimateMonthlyCharge(plan,attributedSalesCents){
  const p=PLANS[plan];if(!p)throw new Error('Unknown plan');
  const revenue=Math.max(0,Number(attributedSalesCents)||0);
  return {plan,monthlyCents:p.monthlyCents,commissionCents:Math.round(revenue*p.rate),totalCents:p.monthlyCents+Math.round(revenue*p.rate)};
}
export const formatGBP = cents => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(cents/100);
