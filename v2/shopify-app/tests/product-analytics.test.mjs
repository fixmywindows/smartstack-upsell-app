import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import ts from "typescript";
import {issueAttributionToken,verifyAttributionToken,estimateCommission}
 from "../app/services/attribution-token.mjs";
import {verifiedPurchases} from "../app/services/purchase-attribution.mjs";
const root=resolve(import.meta.dirname,"..");
const read=x=>readFileSync(resolve(root,x),"utf8");
const designModule=ts.transpileModule(read("app/utils/design-settings.ts"),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText;
const design=await import("data:text/javascript;charset=utf-8,"+encodeURIComponent(designModule));
const shop="cross-sell-361.myshopify.com";
const secret="test-only-signing-key-with-good-length";
const when=Date.parse("2026-10-16T14:00:00Z");
const sourceProduct="gid://shopify/Product/400",otherProduct="gid://shopify/Product/401";
const token=issueAttributionToken(secret,{shop,kind:"similar",
 source:sourceProduct,product:otherProduct,set:"rule-123",group:1},when-30000);

test("Free supports basic visibility but restricts advanced typography and CSS",()=>{
 const base=design.defaultDesign("similar");
 const allowed=design.normaliseDesign("similar",{...base,showPrice:false,showTitle:false,showQuickAdd:true});
 assert.equal(design.canSaveDesign("free",allowed,"similar"),true);
 const paid=design.normaliseDesign("similar",{...allowed,titleFontSize:18,headingItalic:true,
  borderColor:"#448877",customCss:".ss-title { font-size: 18px; }"});
 assert.equal(design.canSaveDesign("free",paid,"similar"),false);
 assert.equal(design.canSaveDesign("growth",paid,"similar"),true);
 assert.match(design.compileScopedCss("similar",paid.customCss),/data-block-kind="similar"/);
 assert.throws(()=>design.compileScopedCss("similar","body { color: red; }"));
 assert.throws(()=>design.compileScopedCss("similar",".ss-title { position: fixed; }"));
 assert.throws(()=>design.compileScopedCss("similar",".ss-title { color: red !important; }"));
});
test("signed recommendations are shop-specific and expire after seven days",()=>{
 assert.equal(verifyAttributionToken(secret,shop,token,when).product,otherProduct);
 assert.equal(verifyAttributionToken(secret,"unrelated.myshopify.com",token,when),null);
 assert.equal(verifyAttributionToken(secret,shop,token,when+9*86400000),null);
 assert.equal(verifyAttributionToken(secret,shop,token+"oops",when),null);
});
test("provisional fees remain unbilled estimates by Free / Growth / Insights",()=>{
 assert.equal(estimateCommission(25000,"free").amountMinor,750);
 assert.equal(estimateCommission(25000,"growth").amountMinor,375);
 assert.equal(estimateCommission(25000,"insights").amountMinor,125);
});
test("Shopify-verified order lines determine revenue; clicks cannot create purchases",()=>{
 const order={
  id:"gid://shopify/Order/222",createdAt:new Date(when).toISOString(),
  test:false,fullyPaid:true,cancelledAt:null,
  lineItems:{pageInfo:{hasNextPage:false},nodes:[{
   id:"gid://shopify/LineItem/900",product:{id:otherProduct},currentQuantity:2,
   customAttributes:[{key:"_smartstack_ref",value:token}],
   discountedUnitPriceAfterAllDiscountsSet:{shopMoney:{amount:"19.50",currencyCode:"GBP"}}
  }]}
 };
 const rows=verifiedPurchases(secret,shop,order,"free");
 assert.equal(rows.length,1);
 assert.equal(rows[0].netRevenueMinor,3900);
 assert.equal(rows[0].estimatedCommissionMinor,117);
 assert.equal(verifiedPurchases(secret,shop,{...order,test:true},"free").length,0);
 assert.equal(verifiedPurchases(secret,shop,{...order,fullyPaid:false},"free").length,0);
 assert.equal(verifiedPurchases(secret,shop,{...order,lineItems:
  {pageInfo:{hasNextPage:true},nodes:order.lineItems.nodes}},"free").length,0);
 assert.equal(verifiedPurchases(secret,shop,{...order,lineItems:
  {...order.lineItems,nodes:[{...order.lineItems.nodes[0],currentQuantity:0}]}},"free").length,0);
});
test("Analytics uses authenticated data; engagement requires confirmed privacy consent",()=>{
 const nav=read("app/routes/app.tsx");
 const ui=read("app/routes/app.analytics.tsx");
 const report=read("app/services/analytics.server.ts");
 const proxy=read("app/routes/proxy.events.ts");
 const storefront=read("extensions/smartstack-recommendations/assets/smartstack.js");
 assert.match(nav,/href="\/app\/analytics"/);
 assert.match(ui,/Directly attributed products purchased/);
 assert.match(ui,/Estimated commission/);
 assert.match(ui,/Combinations to review/);
 assert.match(report,/if\(!paid\)return/);
 assert.match(proxy,/authenticate\.public\.appProxy/);
 assert.match(proxy,/verifyAttributionToken/);
 assert.match(storefront,/analyticsProcessingAllowed/);
 assert.match(storefront,/_smartstack_ref/);
});
