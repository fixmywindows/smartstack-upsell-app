import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = path => readFileSync(resolve(import.meta.dirname,'..',path),'utf8');
const liquid = read('extensions/smartstack-recommendations/blocks/recommendations.liquid');
const js = read('extensions/smartstack-recommendations/assets/smartstack.js');
const css = read('extensions/smartstack-recommendations/assets/smartstack.css');
const match = liquid.match(/{% schema %}\s*([\s\S]+?)\s*{% endschema %}/);
assert.ok(match,'Liquid schema exists');
const schema = JSON.parse(match[1]);

const setting = name => schema.settings.find(s=>s.id===name);

test('theme extension has valid setting groups and all four recommendation types',()=>{
  assert.equal(schema.target,'section');
  assert.equal(schema.stylesheet,'smartstack.css');
  assert.equal(schema.javascript,'smartstack.js');
  assert.deepEqual(setting('recommendation_type').options.map(o=>o.value),[
    'similar','complement','bought_together','bundle'
  ]);
});

test('block heading falls back to merchant configured title instead of identical defaults',()=>{
  assert.equal(setting('heading').default,undefined);
  assert.match(js,/legacyDefault/);
  assert.match(js,/data\.heading/);
});

test('merchant controls cover layout, responsive columns, quick add and card styling',()=>{
  for(const key of ['layout','card_style','desktop_columns','mobile_columns',
    'card_gap','card_radius','quick_add','accent_colour']){
    assert.ok(setting(key),'setting missing: '+key);
  }
  assert.match(css,/grid-auto-flow:\s*column/);
  assert.match(css,/@media \(max-width: 767px\)/);
});

test('theme editor retains diagnostic state and re-initialises inserted blocks',()=>{
  assert.match(liquid,/request\.design_mode/);
  assert.match(js,/MutationObserver/);
  assert.match(js,/shopify:block:select/);
  assert.match(js,/shopify:section:load/);
  assert.match(js,/No eligible recommendations for this product/);
});

test('renderer source is valid JavaScript',()=>{
  assert.doesNotThrow(()=>new Function(js));
});

test('multi-item bundle is explicit about no checkout discount and sources current product',()=>{
  assert.match(js,/No bundle discount is active/);
  assert.match(js,/data\.source/);
  assert.match(js,/Add selected set to basket/);
  assert.match(js,/addToCart\(items\)/);
});

test('all storefront product links are restricted to same-origin URL paths',()=>{
  assert.match(js,/url\.origin === location\.origin/);
});

test('requests identify separate block kinds and never bill add-to-cart',()=>{
  assert.match(js,/searchParams\.set\('kind',kind\)/);
  assert.doesNotMatch(js,/billingMeter\.charge|chargeUsage|_smartstack_token/);
});

test('Shopify range settings offer at least three selectable values', () => {
  for (const setting of schema.settings.filter(s => s.type === 'range')) {
    assert.ok(Number.isFinite(setting.step) && setting.step > 0, `Invalid step on ${setting.id}`);
    assert.ok((setting.max - setting.min) / setting.step >= 2,
      `Range ${setting.id} must have at least three steps`);
  }
  const mobile = setting('mobile_columns');
  assert.equal(mobile.type, 'select');
  assert.deepEqual(mobile.options.map(o => o.value), ['1', '2']);
});

test('every storefront block has an eight-product cap, with bundle source included',()=>{
  const limit = setting('max_items');
  assert.equal(limit.max,8);
  assert.equal(limit.default,8);
  assert.match(js,/\.slice\(0,\s*7\)/);
});
