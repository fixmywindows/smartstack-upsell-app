import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

// Design config is a dependency-free TS module; transpile in memory to
// exercise the real implementation without installing extra test runtimes.
const root=resolve(import.meta.dirname,"..");
const code=readFileSync(resolve(root,"app/utils/design-settings.ts"),"utf8");
const compiled=ts.transpileModule(code,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
});
const design=await import("data:text/javascript;charset=utf-8,"+encodeURIComponent(compiled.outputText));
const liquid=readFileSync(resolve(root,"extensions/smartstack-recommendations/blocks/recommendations.liquid"),"utf8");
const js=readFileSync(resolve(root,"extensions/smartstack-recommendations/assets/smartstack.js"),"utf8");
const css=readFileSync(resolve(root,"extensions/smartstack-recommendations/assets/smartstack.css"),"utf8");
const schema=JSON.parse(liquid.match(/{% schema %}\s*([\s\S]+?)\s*{% endschema %}/)[1]);
const field=id=>schema.settings.find(x=>x.id===id);

test("all four block types have a theme-first default with no intrusive quick-add",()=>{
  for(const kind of design.DESIGN_KINDS){
    const actual=design.defaultDesign(kind);
    assert.equal(actual.preset,"theme");
    assert.equal(actual.showQuickAdd,false);
    assert.equal(actual.buttonStyle,"match");
    assert.equal(actual.showPrice,true);
    assert.equal(actual.buttonColor,"");
    assert.equal(actual.layout,kind==="bought_together"?"compact":"grid");
  }
});

test("preset controls are whitelisted and HTML/CSS injection values do not persist",()=>{
  const actual=design.normaliseDesign("similar",{
    preset:"bold", cardStyle:"evil", buttonColor:"red;background:url(javascript:alert(1))",
    imageFit:"contain", showQuickAdd:false,
    showVendor:"no", desktopColumns:999, cardGap:-500, unknown:"unexpected"
  });
  assert.equal(actual.cardStyle,"bordered");
  assert.equal(actual.buttonColor,"");
  assert.equal(actual.desktopColumns,4);
  assert.equal(actual.cardGap,8);
  assert.equal(actual.showQuickAdd,false);
  assert.equal(actual.showVendor,false);
  assert.ok(!("unknown" in actual));
});

test("Free plan can save theme/minimal and quick-add toggles without paying",()=>{
  for(const preset of ["theme","minimal"]){
    const d=design.defaultDesign("similar",preset);
    d.showQuickAdd=true;
    d.showVendor=true;
    d.showPrice=false;
    d.layout="carousel";
    assert.equal(design.canSaveDesign("free",d,"similar"),true);
  }
});

test("advanced design requires a paid plan; preview can still show it",()=>{
  const d=design.defaultDesign("bundle","editorial");
  assert.equal(design.isAdvancedDesign(d,"bundle"),true);
  assert.equal(design.canSaveDesign("free",d,"bundle"),false);
  assert.equal(design.canSaveDesign("growth",d,"bundle"),true);
  assert.equal(design.canSaveDesign("insights",d,"bundle"),true);
});

test("theme extension keeps previous settings and adds Studio/override controls",()=>{
  assert.equal(field("design_source").default,"studio");
  assert.deepEqual(field("quick_add_override").options.map(v=>v.value),
    ["studio","show","hide"]);
  assert.deepEqual(field("price_override").options.map(v=>v.value),
    ["studio","show","hide"]);
  assert.equal(field("quick_add").type,"checkbox");
  assert.ok(field("show_vendor")&&field("show_price"));
  assert.ok(field("layout").options.some(v=>v.value==="compact"));
  assert.ok(field("card_style").options.some(v=>v.value==="soft"));
});

test("Shopify slider fields have at least three steps",()=>{
  for(const item of schema.settings.filter(s=>s.type==="range")){
    assert.ok(item.max-item.min>=item.step*2,"Invalid Shopify range "+item.id);
  }
});

test("new storefront adapts to narrow theme placements and mobile",()=>{
  assert.match(css,/container:\s*ss-block\s*\/\s*inline-size/);
  assert.match(css,/@container ss-block \(max-width: 360px\)/);
  assert.match(css,/grid-auto-flow:\s*column/);
  assert.match(css,/data-layout="compact"/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(js,/getDesign\(block,data\.design\)/);
  assert.match(js,/themeButtons\(\)/);
  assert.match(js,/design\.showQuickAdd/);
  assert.match(js,/design\.showPrice/);
  assert.match(js,/shopify:block:select/);
});

test("CSS is namespaced to SmartStack and renderer does not introduce billing",()=>{
  assert.doesNotThrow(()=>new Function(js));
  assert.doesNotMatch(css,/^body\s*\{|^\s*button\s*\{/m);
  assert.doesNotMatch(js,/chargeUsage|billingMeter\.charge|_smartstack_token/);
  assert.match(js,/url\.origin === location\.origin/);
});


test("theme matching uses readable native typography rather than Shopify's small rem root",()=>{
  assert.doesNotMatch(css,/font-size:\s*(?:0?\.)\d+rem/);
  assert.match(css,/--ss-heading-size/);
  assert.match(css,/--ss-card-title-size/);
  assert.match(css,/--ss-price-size/);
  assert.match(js,/\.related-products h2/);
  assert.match(js,/getComputedStyle\(node\)/);
  assert.match(js,/--ss-heading-font/);
  assert.match(js,/--ss-card-title-weight/);
  assert.match(js,/--ss-price-weight/);
});
test("theme presets use native four-column shelves and compact responsive placements",()=>{
  assert.match(css,/--ss-cols:\s*4/);
  assert.match(js,/native product grid|same card grid as native related products|full-width shelf/i);
  assert.match(js,/block\.parentElement\?\.getBoundingClientRect\(\)\.width/);
  assert.match(js,/layout='grid'/);
  assert.match(css,/@container ss-block \(max-width: 420px\)/);
});
test("theme-style cart button remains outlined if its native background is transparent",()=>{
  assert.match(js,/bg='transparent'/);
  assert.match(js,/--ss-button-border/);
  assert.match(css,/--ss-button-outline/);
  assert.match(css,/color:\s*var\(--ss-button-outline\)/);
});
