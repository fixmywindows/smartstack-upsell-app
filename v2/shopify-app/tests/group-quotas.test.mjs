import test from "node:test";
import assert from "node:assert/strict";
import {recommendWithGroups} from "../app/services/group-allocation.mjs";
import {aggregateRuleSets} from "../app/services/set-matching.mjs";
import {evaluateGroups} from "../app/services/engine.mjs";
const base={id:"gid://shopify/Product/100",title:"Snowboard",category:"snowboards",
 productType:"snowboard",vendor:"Test",tags:["winter"],collections:[],
 metafields:{},available:true,published:true,priceCents:70000};
const candidates=["pro","kids","sale"].flatMap((tag,g)=>Array.from({length:3},(_,i)=>({
 ...base,id:"gid://shopify/Product/"+(101+g*3+i),title:tag+" Board "+i,tags:[tag]
})));
const rules=["pro","kids","sale"].map((tag,g)=>({logic:"AND",maxItems:g===2?2:3,
 rules:[{field:"tags",op:"equals",value:tag}]}));
const config={kind:"similar",targetMode:"allocate",mode:"ai",maxItems:8,
 ruleGroups:rules,excludeIds:[],pinnedIds:[]};
const recommendFor=(set,quota,used)=>recommendWithGroups({
 sourceId:base.id,products:[base,...candidates],
 config:{...config,ruleGroups:set.rules||rules,maxItems:quota,excludeIds:[...used]}
});
test("THEN groups contribute exactly 3+3+2 into one eight-product block",()=>{
 const result=recommendWithGroups({sourceId:base.id,products:[base,...candidates],config});
 assert.deepEqual(result.groupContributions.map(x=>x.contributed),[3,3,2]);
 assert.equal(result.items.length,8);
 assert.equal(new Set(result.items.map(x=>x.product.id)).size,8);
});
test("exclusions remove candidates and never fill a restricted group with unrelated items",()=>{
 const result=recommendWithGroups({sourceId:base.id,products:[base,...candidates],
  config:{...config,excludeIds:[candidates[0].id]}});
 assert.deepEqual(result.groupContributions.map(x=>x.contributed),[2,3,2]);
 assert.equal(result.items.length,7);
});
test("existing matching mode still applies AND/OR between groups",()=>{
 const result=recommendWithGroups({sourceId:base.id,products:[base,...candidates],
  config:{...config,targetMode:"filter",ruleOuterLogic:"AND",ruleGroups:rules}});
 assert.equal(result.items.length,0);
});
test("different IF→THEN sets cannot exceed eight or repeat the same product",()=>{
 const first={id:"a",name:"A",enabled:true,archived:false,sourceMatch:"all",
   priority:1,maxItems:5,createdAt:new Date(0),rules:[rules[0]]};
 const second={...first,id:"b",name:"B",priority:2,rules:[rules[1]]};
 const result=aggregateRuleSets({sets:[first,second],source:base,sourceId:base.id,
  max:8,normaliseGroups:x=>x,evaluateGroups,
  recommendForSet:recommendFor});
 assert.equal(result.items.length,6);
 assert.equal(new Set(result.items.map(x=>x.product.id)).size,6);
});
