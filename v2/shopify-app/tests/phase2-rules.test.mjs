import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGroups, evaluateRule, recommend } from "../app/services/engine.mjs";
import { resolveRuleSets, sortRuleSets } from "../app/services/set-matching.mjs";

const source = {
  id:"source",title:"Winter snowboard",category:"snowboards",productType:"snowboard",
  vendor:"Brand A",priceCents:70000,available:true,published:true,
  tags:["winter","snowboard"],collections:["winter-sports"],
  metafields:{"spec.level":"intermediate"}
};
const board = {
  id:"board",title:"Snowboard advanced",category:"snowboards",productType:"snowboard",
  vendor:"Brand B",priceCents:81000,available:true,published:true,
  tags:["premium"],collections:["winter-sports"],metafields:{"spec.level":"advanced"}
};
const cheapBoard = {
  id:"cheap",title:"Snowboard entry",category:"snowboards",productType:"snowboard",
  vendor:"Brand B",priceCents:45000,available:true,published:true,
  tags:["sale"],collections:["winter-sports"],metafields:{"spec.level":"beginner"}
};

function group(logic,...rules){return {logic,rules};}
const rule = (field,op,value)=>({field,op,value});
const sets = [
  {id:"general",name:"General",kind:"similar",priority:100,sourceMatch:"all",
    enabled:true,archived:false,fallbackMode:"next",createdAt:"2026-01-01",sourceRules:[],sourceLogic:"AND"},
  {id:"targeted",name:"Targeted",kind:"similar",priority:20,sourceMatch:"rules",
    enabled:true,archived:false,fallbackMode:"next",createdAt:"2026-01-01",
    sourceRules:[group("OR",rule("tags","contains","winter"),rule("vendor","equals","other"))],
    sourceLogic:"AND"},
];
const groups = (value,logic="AND") => Array.isArray(value) && value.length && value[0]?.field
  ? [group(logic,...value)] : value;

test("a nested ALL/ANY structure evaluates within and across groups",()=>{
  const g=[
    group("OR",rule("tags","contains","winter"),rule("title","equals","some other product")),
    group("AND",rule("price","gte",65000),rule("metafield:spec.level","exists",""))
  ];
  assert.equal(evaluateGroups(source,g,"AND"),true);
  assert.equal(evaluateGroups(cheapBoard,g,"AND"),false);
  assert.equal(evaluateGroups(cheapBoard,g,"OR"),false);
  const orGroups=[
    group("AND",rule("tags","equals","missing")),
    group("AND",rule("price","lte",50000),rule("category","equals","snowboards"))
  ];
  assert.equal(evaluateGroups(cheapBoard,orGroups,"OR"),true);
  assert.equal(evaluateGroups(cheapBoard,orGroups,"AND"),false);
  assert.equal(evaluateGroups(source,[]),true);
  assert.equal(evaluateGroups(source,[group("OR")]),false,
    "Empty groups must never behave as an unrestricted wildcard");
});

test("field existence and metafields behave as precise criteria",()=>{
  assert.equal(evaluateRule(source,rule("metafield:spec.level","equals","intermediate")),true);
  assert.equal(evaluateRule(source,rule("metafield:spec.unknown","not_exists","")),true);
  assert.equal(evaluateRule(source,rule("metafield:spec.unknown","exists","")),false);
  assert.equal(evaluateRule(source,rule("tags","all_of","winter,snowboard")),true);
  assert.equal(evaluateRule(source,rule("tags","any_of","summer,winter")),true);
});

test("hard exclusion groups prevent manually pinned products from appearing",()=>{
  const out=recommend({
    sourceId:"source", products:[source,board,cheapBoard],
    config:{
      kind:"similar",mode:"manual",pinnedIds:["board","cheap"],
      excludeIds:["cheap"],
      excludeGroups:[group("AND",rule("tags","equals","premium"))],
      excludeOuterLogic:"OR",maxItems:3,
    }
  });
  assert.equal(out.items.length,0);
});

test("recommendation target group filters all candidates including pins",()=>{
  const out=recommend({
    sourceId:"source",products:[source,board,cheapBoard],
    config:{
      kind:"similar",mode:"hybrid",pinnedIds:["cheap"],maxItems:3,
      ruleGroups:[
        group("OR",rule("tags","equals","premium"),rule("vendor","equals","Brand A")),
        group("AND",rule("price","gte",75000))
      ],ruleOuterLogic:"AND"
    }
  });
  assert.deepEqual(out.items.map(x=>x.product.id),["board"]);
});

test("specific matching sets outrank default fallback at equal priority",()=>{
  const ordered=sortRuleSets([
    {...sets[0],priority:10},
    {...sets[1],priority:10},
    {id:"pinned",name:"Selected",priority:10,sourceMatch:"products",createdAt:"2026-01-01"},
  ]);
  assert.deepEqual(ordered.map(s=>s.id),["pinned","targeted","general"]);
});

test("when the first match is empty, the next matching set can fill it",()=>{
  const result=resolveRuleSets({
    sets,source,sourceId:"source",
    evaluateGroups,normaliseGroups:groups,
    recommendForSet:set=>({items:set.id==="targeted"?[]:[{product:board}]})
  });
  assert.equal(result.selection.set.id,"general");
  assert.deepEqual(result.trace.map(x=>x.decision),["fallback","selected"]);
});

test("Stop here prevents silently falling back to unrelated products",()=>{
  const stop=[{...sets[1],fallbackMode:"stop"},sets[0]];
  const result=resolveRuleSets({
    sets:stop,source,sourceId:"source",evaluateGroups,normaliseGroups:groups,
    recommendForSet:()=>({items:[]}),
  });
  assert.equal(result.selection.set.id,"targeted");
  assert.equal(result.trace.length,1);
  assert.equal(result.trace[0].decision,"stopped_empty");
});

test("admin preview can simulate a draft without activating it",()=>{
  const draft={...sets[1],enabled:false,id:"draft",name:"Draft"};
  const result=resolveRuleSets({
    sets:[...sets,draft],source,sourceId:"source",previewSetId:"draft",
    evaluateGroups,normaliseGroups:groups,recommendForSet:()=>({items:[board]})
  });
  assert.equal(result.selection.set.id,"draft");
  assert.equal(result.trace.at(-1).decision,"selected");
});

test("disabled and archived sets are not used on a shopper page",()=>{
  const result=resolveRuleSets({
    sets:[{...sets[1],enabled:false},{...sets[0],archived:true}],
    source,sourceId:"source",evaluateGroups,normaliseGroups:groups,
    recommendForSet:()=>{throw Error("No unavailable set should be evaluated");}
  });
  assert.equal(result.selection,null);
  assert.equal(result.trace.filter(x=>x.decision==="skipped").length,2);
});

test("AND group targeting never matches a non-matching source",()=>{
  const set={...sets[1],sourceRules:[
    group("AND",rule("category","equals","snowboards"),rule("vendor","equals","different"))
  ]};
  const result=resolveRuleSets({
    sets:[set],source,sourceId:"source",evaluateGroups,normaliseGroups:groups,
    recommendForSet:()=>{throw Error("Source was not eligible");}
  });
  assert.equal(result.selection,null);
  assert.equal(result.trace[0].decision,"source_mismatch");
});
