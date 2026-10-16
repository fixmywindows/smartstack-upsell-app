import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {eligibleOrderProducts,pairsForProducts,diffOrderPairs,observedPairMap}
  from "../app/services/co-purchases.mjs";
import {recommend} from "../app/services/engine.mjs";
import {runBundleDiscount} from "../discount-prototype/cart-lines-discount.mjs";

const gid=n=>"gid://shopify/Product/"+n;
const variant=n=>"gid://shopify/ProductVariant/"+n;
const order={
 id:"gid://shopify/Order/123",fullyPaid:true,test:false,cancelledAt:null,
 lineItems:{pageInfo:{hasNextPage:false},nodes:[
  {currentQuantity:1,product:{id:gid(1)},variant:{id:variant(11)}},
  {currentQuantity:2,product:{id:gid(2)},variant:{id:variant(12)}},
  {currentQuantity:1,product:{id:gid(2)},variant:{id:variant(13)}},
 ]}
};
test("co-purchase evidence counts distinct non-test, paid orders, not line quantities",()=>{
 assert.deepEqual(eligibleOrderProducts(order),[gid(1),gid(2)]);
 assert.equal(pairsForProducts(eligibleOrderProducts(order)).length,1);
 assert.deepEqual(eligibleOrderProducts({...order,fullyPaid:false}),[]);
 assert.deepEqual(eligibleOrderProducts({...order,test:true}),[]);
 assert.deepEqual(eligibleOrderProducts({...order,cancelledAt:"2026-10-15T00:00:00Z"}),[]);
 assert.deepEqual(eligibleOrderProducts({...order,lineItems:{
   ...order.lineItems,pageInfo:{hasNextPage:true}}}),[]);
 assert.deepEqual(eligibleOrderProducts({...order,lineItems:{
   pageInfo:{hasNextPage:false},nodes:order.lineItems.nodes.map(line=>({...line,currentQuantity:0}))
 }}),[]);
});
test("order updates are idempotent and cancellations remove old pair contributions",()=>{
 const initial=eligibleOrderProducts(order);
 assert.deepEqual(diffOrderPairs(initial,initial),{remove:[],add:[]});
 assert.deepEqual(diffOrderPairs([],initial).add,[[gid(1),gid(2)]]);
 assert.deepEqual(diffOrderPairs(initial,[]).remove,[[gid(1),gid(2)]]);
});
test("purchase labels require two independent qualifying orders",()=>{
 assert.deepEqual(observedPairMap(gid(1),[
   {productA:gid(1),productB:gid(2),orderCount:1},
   {productA:gid(1),productB:gid(3),orderCount:2}
 ]),{[gid(3)]:2});
});
const source={
 id:gid(1),title:"Alpine Snowboard",category:"snowboards",productType:"snowboard",
 tags:["winter","all-mountain"],collections:["winter-sports"],vendor:"Test",
 available:true,published:true,priceCents:71000,metafields:{}
};
const similar={...source,id:gid(2),title:"All Mountain Snowboard",priceCents:69900};
const random={...source,id:gid(3),title:"Random Street Lamp",
 category:"lighting",productType:"lamp",tags:["furniture"],collections:["home"]};
const accessory={...source,id:gid(4),title:"Snowboard bindings",
 category:"bindings",productType:"accessory",tags:["accessory","winter"],
 priceCents:8800};
test("similar suggestions are comparable, not unrelated products with similar prices",()=>{
 const result=recommend({sourceId:source.id,products:[source,similar,random,accessory],
   config:{kind:"similar",mode:"ai",maxItems:5}});
 assert.deepEqual(result.items.map(x=>x.product.id),[similar.id]);
});
test("complementary suggestions avoid snowboard vs snowboard and unrelated items",()=>{
 const out=recommend({sourceId:source.id,products:[source,similar,random,accessory],
   config:{kind:"complement",mode:"ai",maxItems:5}});
 assert.deepEqual(out.items.map(x=>x.product.id),[accessory.id]);
});
test("explicit THEN rules can target a compatible cross-category product",()=>{
 const out=recommend({sourceId:source.id,products:[source,random],
   config:{kind:"complement",mode:"ai",maxItems:5,
     ruleGroups:[{logic:"AND",rules:[{field:"category",op:"equals",value:"lighting"}]}]}});
 assert.deepEqual(out.items.map(x=>x.product.id),[random.id]);
});
test("observed purchase pair outranks catalogue guesses and never invents orders",()=>{
 const pairCounts={[source.id]:{[random.id]:3}};
 const verified=recommend({sourceId:source.id,products:[source,similar,random,accessory],
   pairs:pairCounts,config:{kind:"bought_together",mode:"ai",maxItems:3}});
 assert.equal(verified.items[0].product.id,random.id);
 assert.equal(verified.items[0].evidence,"observed");
 assert.equal(verified.items[0].count,3);
 const cold=recommend({sourceId:source.id,products:[source,accessory],
   pairs:{},config:{kind:"bought_together",mode:"ai",maxItems:3}});
 assert.equal(cold.basis,"cold_start");
 assert.doesNotMatch(cold.heading,/frequently bought together/i);
});
const makeInput=(config,cartVariants)=>({
 discount:{discountClasses:["PRODUCT"],metafield:{jsonValue:config}},
 cart:{lines:cartVariants.map((v,i)=>({id:"gid://shopify/CartLine/"+i,
  quantity:1,merchandise:{__typename:"ProductVariant",id:v}}))}
});
const config={active:true,percentage:10,requiredVariantIds:[variant(11),variant(12)],
 targetVariantIds:[variant(12)],message:"SmartStack bundle"};
test("prototype Function discounts only when all configured variants are in checkout",()=>{
 const yes=runBundleDiscount(makeInput(config,[variant(11),variant(12)]));
 assert.equal(yes.operations.length,1);
 assert.equal(yes.operations[0].productDiscountsAdd.selectionStrategy,"ALL");
 assert.deepEqual(yes.operations[0].productDiscountsAdd.candidates[0].targets,
   [{cartLine:{id:"gid://shopify/CartLine/1"}}]);
 assert.equal(runBundleDiscount(makeInput(config,[variant(12)])).operations.length,0);
 assert.equal(runBundleDiscount(makeInput({...config,active:false},[
   variant(11),variant(12)])).operations.length,0);
 assert.equal(runBundleDiscount(makeInput({...config,percentage:80},[
   variant(11),variant(12)])).operations.length,0);
 assert.equal(runBundleDiscount(makeInput({...config,targetVariantIds:[variant(13)]},[
   variant(11),variant(12)])).operations.length,0);
});
test("order access is opt-in; storefront never consumes buyer PII",()=>{
 const root=resolve(import.meta.dirname,"..");
 const orderCode=readFileSync(resolve(root,"app/services/order-signals.server.ts"),"utf8");
 const proxy=readFileSync(resolve(root,"app/routes/proxy.recommendations.ts"),"utf8");
 const manifest=readFileSync(resolve(root,"shopify.app.toml"),"utf8");
 assert.match(orderCode,/read_orders/);
 assert.match(orderCode,/createHmac/);
 assert.match(orderCode,/SHOPIFY_API_SECRET/);
 assert.match(orderCode,/!hasOrderScope\(scope\)/);
 assert.doesNotMatch(manifest,/scopes\s*=\s*"[^"]*read_orders/);
 assert.doesNotMatch(proxy,/customer.*email|shippingAddress/i);
});
test("variant selectors refuse incomplete product variants and support bundle selection",()=>{
 const root=resolve(import.meta.dirname,"..");
 const js=readFileSync(resolve(root,"extensions/smartstack-recommendations/assets/smartstack.js"),"utf8");
 const catalogue=readFileSync(resolve(root,"app/services/catalogue.server.ts"),"utf8");
 assert.doesNotThrow(()=>new Function(js));
 assert.match(js,/variantsComplete===false/);
 assert.match(js,/makeVariantSelect/);
 assert.match(js,/money\(variant.priceMinor,item.currencyCode\)/);
 assert.match(js,/chosen.length\+1/);
 assert.match(catalogue,/variantsComplete:!product.variants.pageInfo.hasNextPage/);
 assert.match(catalogue,/selectedOptions/);
 assert.match(catalogue,/productVariantSnapshot.createMany/);
});
