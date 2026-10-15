import test from 'node:test';
import assert from 'node:assert/strict';
import {products,pairs,defaultConfig} from '../src/sample-data.mjs';
import {recommend,evaluateRule,evaluateGroups,bundleTotals} from '../src/engine.mjs';
import {quoteCommission,estimateMonthlyCharge} from '../src/billing.mjs';

const run=(sourceId,overrides={})=>recommend({sourceId,products,pairs,config:{...defaultConfig,...overrides}});
const ids=r=>r.items.map(x=>x.product.id);

test('similar items stay in relevant category, exclude unavailable',()=>{
  const r=run('sofa-nova',{kind:'similar',maxItems:8});
  assert.ok(ids(r).includes('sofa-alto'));assert.ok(ids(r).includes('sofa-cove'));
  assert.ok(!ids(r).includes('football'));assert.ok(!ids(r).includes('sofa-out-of-stock'));
});
test('complementary items do not mix furniture and sports',()=>{
  const r=run('football-goal',{kind:'complement',maxItems:8});
  assert.ok(ids(r).includes('football'));assert.ok(ids(r).includes('cones'));assert.ok(ids(r).includes('goal-net'));
  assert.ok(!ids(r).includes('cushion-cream'));
});
test('manual mode shows only merchant-selected items',()=>{
  const r=run('sofa-nova',{mode:'manual',manualIds:['table-oak','football']});
  assert.deepEqual(ids(r),['table-oak','football']);
});
test('hybrid pins outrank algorithm',()=>{
  const r=run('sofa-nova',{pinnedIds:['table-oak'],maxItems:3});
  assert.equal(ids(r)[0],'table-oak');
});
test('AI mode ignores manual pins',()=>{
  const r=run('sofa-nova',{mode:'ai',pinnedIds:['football']});
  assert.ok(!ids(r).includes('football'));
});
test('merchant exclusions override pinned items',()=>{
  const r=run('sofa-nova',{pinnedIds:['table-oak','cushion-cream'],excludeIds:['table-oak']});
  assert.ok(!ids(r).includes('table-oak'));assert.equal(ids(r)[0],'cushion-cream');
});
test('unavailable or incompatible pinned products never display',()=>{
  const r=run('camera',{mode:'manual',pinnedIds:['lens-e','lens-z','cones-oos']});
  assert.deepEqual(ids(r),['lens-z']);
});
test('exclusion by tag works on auto pool',()=>{
  const r=run('sofa-nova',{excludeTags:['clearance']});
  assert.ok(!ids(r).includes('throw-wool'));
});
test('title, tags, category, metafields, availability and price rules',()=>{
  const sofa=products.find(p=>p.id==='sofa-alto');
  assert.equal(evaluateRule(sofa,{field:'title',op:'contains',value:'ALTO'}),true);
  assert.equal(evaluateRule(sofa,{field:'tags',op:'any_of',value:['modern','other']}),true);
  assert.equal(evaluateRule(sofa,{field:'category',op:'equals',value:'sofas'}),true);
  assert.equal(evaluateRule(sofa,{field:'metafield:spec.material',op:'equals',value:'velvet'}),true);
  assert.equal(evaluateRule(sofa,{field:'price',op:'gte',value:50000}),true);
  assert.equal(evaluateRule(sofa,{field:'available',op:'equals',value:true}),true);
  assert.equal(evaluateRule(sofa,{field:'secret',op:'exists',value:true}),false);
});
test('AND/OR grouping works',()=>{
  const sofa=products.find(p=>p.id==='sofa-alto');
  assert.ok(evaluateGroups(sofa,[{logic:'OR',rules:[{field:'category',op:'equals',value:'cushions'},{field:'metafield:spec.material',op:'equals',value:'velvet'}]}]));
  assert.ok(!evaluateGroups(sofa,[{logic:'AND',rules:[{field:'category',op:'equals',value:'cushions'},{field:'metafield:spec.material',op:'equals',value:'velvet'}]}]));
});
test('rules apply to manually pinned items, including metafields',()=>{
  const r=run('sofa-nova',{mode:'manual',pinnedIds:['cushion-olive','cushion-cream'],ruleGroups:[{logic:'AND',rules:[{field:'metafield:spec.material',op:'equals',value:'velvet'}]}]});
  assert.deepEqual(ids(r),['cushion-olive']);
});
test('purchase evidence is actual order co-purchase, not invented',()=>{
  const r=run('sofa-nova',{kind:'bought_together',mode:'ai',maxItems:4});
  assert.equal(r.basis,'order_history');assert.equal(ids(r)[0],'cushion-cream');
  assert.ok(r.items.every(x=>x.evidence==='observed'));
  assert.ok(!ids(r).includes('football'));
});
test('cold start switches label and uses relevant inferred items',()=>{
  const r=run('cat-carrier',{kind:'bought_together',mode:'ai'});
  assert.equal(r.heading,'Pairs well with');assert.equal(r.basis,'cold_start');
  assert.ok(ids(r).includes('cat-harness'));assert.ok(!ids(r).includes('football'));
});
test('bundle shows at most 3 add-ons, for at most 4 items including source',()=>{
  const r=run('sofa-nova',{kind:'bundle',maxItems:12});
  assert.ok(r.items.length<=3);
});
test('10% bundle discount applies only with all selected items by default',()=>{
  const items=[{id:'a',priceCents:10000},{id:'b',priceCents:2000},{id:'c',priceCents:3000}];
  let full=bundleTotals({items,selectedIds:['a','b','c'],discount:{type:'percentage',value:10}});
  assert.equal(full.subtotalCents,15000);assert.equal(full.savingCents,1500);assert.equal(full.totalCents,13500);
  let partial=bundleTotals({items,selectedIds:['a','b'],discount:{type:'percentage',value:10}});
  assert.equal(partial.savingCents,0);assert.equal(partial.qualifies,false);
});
test('fixed savings cap at subtotal and fixed total cannot increase price',()=>{
  const items=[{id:'a',priceCents:1000},{id:'b',priceCents:2000}];
  assert.equal(bundleTotals({items,selectedIds:['a','b'],discount:{type:'fixed',value:6000}}).totalCents,0);
  assert.equal(bundleTotals({items,selectedIds:['a','b'],discount:{type:'fixed_total',value:4000}}).savingCents,0);
});
test('commission counts only verified additional line revenue, once, after refunds',()=>{
  const lines=[
    {orderId:'1',lineId:'sofa',priceCents:40000,quantity:1,widgetAttributed:true,approvedAttribution:true,isSourceItem:true},
    {orderId:'1',lineId:'cushion',priceCents:4000,quantity:2,discountCents:1000,refundedCents:2000,widgetAttributed:true,approvedAttribution:true,isSourceItem:false},
    {orderId:'1',lineId:'cushion',priceCents:4000,quantity:2,discountCents:1000,refundedCents:2000,widgetAttributed:true,approvedAttribution:true,isSourceItem:false},
    {orderId:'1',lineId:'other',priceCents:10000,quantity:1,widgetAttributed:false,approvedAttribution:true,isSourceItem:false},
  ];
  const quote=quoteCommission({plan:'free',lines});
  assert.equal(quote.eligibleCents,5000);assert.equal(quote.commissionCents,150);assert.equal(quote.ledger.length,1);
});
test('monthly pricing £15/1.5% and £45/0.5%',()=>{
  assert.equal(estimateMonthlyCharge('growth',100000).totalCents,3000);
  assert.equal(estimateMonthlyCharge('insights',300000).totalCents,6000);
});
