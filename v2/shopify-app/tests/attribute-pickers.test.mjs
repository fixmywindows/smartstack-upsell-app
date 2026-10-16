import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const sql=read("app/services/attribute-facets.server.ts");
const route=read("app/routes/app.api.attributes.ts");
const inline=read("app/components/inline-rule-editor.tsx");
const advanced=read("app/routes/app.sets.$setId.tsx");
const home=read("app/routes/app._index.tsx");
const styles=read("app/styles/rule-journey.css");

test("attribute API is shop-authenticated and never accepts an arbitrary shop parameter",()=>{
  assert.match(route,/authenticate\.admin\(request\)/);
  assert.match(route,/listAttributeChoices\(session\.shop,/);
  assert.doesNotMatch(route,/searchParams\.get\("shop"\)/);
  assert.match(route,/private,no-store/);
});

test("catalogue faceting is parameterised, capped and scoped to ProductSnapshot",()=>{
  assert.match(sql,/Prisma\.sql/);
  assert.match(sql,/WHERE p\."shopDomain"=\$\{shopDomain\}/);
  assert.match(sql,/const LIMIT = 65/);
  assert.match(sql,/jsonb_array_elements_text/);
  assert.match(sql,/jsonb_each/);
  assert.match(sql,/jsonb_typeof/);
  assert.match(sql,/metafieldKey/);
  assert.match(sql,/validKey/);
  assert.doesNotMatch(sql,/queryRawUnsafe/);
});

test("IF and THEN rule editor expose searchable collections, tags, metafield keys and values",()=>{
  assert.match(inline,/CatalogueChoice/);
  assert.match(inline,/app\/api\/attributes/);
  assert.match(inline,/kind="metafields"/);
  assert.match(inline,/r\.field\.startsWith\("metafield:"\)\?"values"/);
  assert.match(inline,/r\.field==="collections"/);
  assert.match(inline,/r\.field==="tags"/);
  assert.match(inline,/Enter a custom value/);
  assert.match(inline,/Select /);
  assert.match(inline,/aria-label/);
});

test("full advanced editor offers the same facet choices without rewriting saved rules",()=>{
  assert.match(advanced,/CatalogueChoice/);
  assert.match(advanced,/kind="metafields"/);
  assert.match(advanced,/rule\.field==="collections"/);
  assert.match(advanced,/fallback=\{keys\}/);
  assert.match(advanced,/groupsForEditor/);
});

test("home dashboard exposes real product/rule/design data, with honest theme status",()=>{
  assert.match(home,/db\.productSnapshot\.count/);
  assert.match(home,/db\.recommendationRuleSet\.findMany/);
  assert.match(home,/db\.recommendationDesign\.findMany/);
  assert.match(home,/Your next move|YOUR NEXT MOVE/i);
  assert.match(home,/ssr-home-type/);
  assert.match(home,/ssr-home-recent/);
  assert.match(home,/doesn't currently detect whether your theme app block is published/);
  assert.doesNotMatch(home,/attributed revenue|conversion rate|lift\s*%/i);
  assert.match(styles,/prefers-reduced-motion:reduce/);
  assert.match(styles,/ssr-home-hero/);
});
