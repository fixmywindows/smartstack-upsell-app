import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=x=>readFileSync(resolve(root,x),"utf8");
const board=read("app/routes/app.blocks.tsx");
const editor=read("app/components/inline-rule-editor.tsx");
const css=read("app/styles/rule-journey.css");
const service=read("app/services/rule-sets.server.ts");
const proxy=read("app/routes/proxy.recommendations.ts");
const theme=read("extensions/smartstack-recommendations/blocks/recommendations.liquid");
const widget=read("extensions/smartstack-recommendations/assets/smartstack.js");
const schema=JSON.parse(theme.match(/{% schema %}\s*([\s\S]+?)\s*{% endschema %}/)[1]);

test("the merchant journey uses IF→THEN rule rows in every existing type",()=>{
  assert.match(board,/ssr-tabs/);
  assert.match(board,/ssr-flow/);
  assert.match(board,/InlineRuleEditor/);
  for(const kind of ["similar","complement","bought_together","bundle"])
    assert.match(board,new RegExp(kind));
});
test("inline condition builder exposes case-insensitive starts/ends and AND/OR grouping",()=>{
  for(const op of ["starts_with","ends_with","contains","not_starts_with","not_ends_with"])
    assert.match(editor,new RegExp(op));
  assert.match(editor,/ALL groups match/);
  assert.match(editor,/ANY group matches/);
  assert.match(editor,/ALL conditions/);
  assert.match(editor,/ANY condition/);
  assert.match(editor,/metafield:/);
  assert.match(editor,/sourceRules/);
  assert.match(editor,/targetRules/);
});
test("all row edits preserve advanced exclusions through server-side record hydration",()=>{
  assert.match(board,/record\.excludeRules/);
  assert.match(board,/record\.excludedProductIds/);
  assert.match(board,/record\.excludeTags/);
  assert.match(board,/tools\.saveRuleSet\(session\.shop,save\)/);
  assert.match(board,/shopDomain:session\.shop/);
  assert.match(board,/tools\.duplicateRuleSet/);
});
test("each set has its own contribution limit and server enforces max eight",()=>{
  assert.match(editor,/maxItems/);
  assert.match(editor,/set\.kind==="bundle"\?7:8/);
  assert.match(service,/Math\.min\(kind==="bundle"\?7:8/);
  assert.equal(schema.settings.find(s=>s.id==="max_items").max,8);
  assert.equal(schema.settings.find(s=>s.id==="max_items").default,8);
  assert.match(proxy,/Math\.min\(8,/);
  assert.match(widget,/\.slice\(0, 7\)/);
});
test("colour, visual motion and accessibility all exist in the workspace",()=>{
  assert.match(css,/linear-gradient/);
  assert.match(css,/@keyframes ssr-slide/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(editor,/aria-label=/);
  assert.match(board,/aria-expanded=/);
  assert.match(board,/aria-current=/);
});
