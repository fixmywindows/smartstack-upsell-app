import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRuleSets } from "../app/services/set-matching.mjs";
import { evaluateGroups, recommend } from "../app/services/engine.mjs";

const source={id:"source",title:"Winter Snowboard",category:"snowboards",productType:"snowboard",vendor:"Test",
  tags:["snow"],collections:[],metafields:{},available:true,published:true,priceCents:10000};
const all=Array.from({length:15},(_,i)=>({
  ...source,id:"product-"+i,title:"Snowboard "+i,priceCents:10000+i*10
}));
const sets=[3,3,2,2].map((maxItems,i)=>({
  id:"set-"+i,name:"Set "+i,kind:"similar",priority:i*10,enabled:true,
  archived:false,sourceMatch:"all",maxItems,fallbackMode:"next",createdAt: new Date(2026,1,i+1)
}));
const defaultArgs={source,sourceId:source.id,evaluateGroups,
  normaliseGroups:(value)=>value||[],max:8
};
test("one 8-product block is composed from 3+3+2 IF→THEN sets",()=>{
  const result=aggregateRuleSets({...defaultArgs,sets,recommendForSet:(set,count,used)=>{
    const start=Number(set.id.split("-")[1])*3;
    const items=all.slice(start,start+count+1).filter(p=>!used.has(p.id)).slice(0,count)
      .map(p=>({product:p}));
    return {items};
  }});
  assert.equal(result.items.length,8);
  assert.deepEqual(result.contributors.map(row=>row.items.length),[3,3,2]);
  assert.equal(result.trace[3].decision,"full");
  assert.equal(new Set(result.items.map(i=>i.product.id)).size,8);
});
test("duplicates are replaced with eligible recommendations from lower priority rows",()=>{
  const result=aggregateRuleSets({...defaultArgs,sets:sets.slice(0,3),
    recommendForSet:(set,count,used)=> {
      const candidates=set.id==="set-0"?all.slice(0,3):all.filter(p=>!used.has(p.id));
      return {items:candidates.slice(0,count).map(product=>({product}))};
    }});
  assert.equal(result.items.length,8);
  assert.equal(new Set(result.items.map(i=>i.product.id)).size,8);
});
test("row quota is enforced even when scoring returns more products",()=>{
  const result=aggregateRuleSets({...defaultArgs,sets:[sets[0]],max:8,
    recommendForSet:()=>({items:all.map(product=>({product}))})});
  assert.equal(result.items.length,3);
  assert.equal(result.trace[0].requested,3);
});
test("a matching empty row with stop policy prevents later rows filling remaining slots",()=>{
  const result=aggregateRuleSets({...defaultArgs,
    sets:[sets[0],{...sets[1],fallbackMode:"stop"},sets[2]],
    recommendForSet:set=>({items:set.id==="set-0"?all.slice(0,2).map(product=>({product})):[]})});
  assert.equal(result.items.length,2);
  assert.deepEqual(result.trace.map(x=>x.decision),["contributed","stopped_empty"]);
});
test("hard exclusion and previously selected items are removed by real recommendation engine",()=>{
  const result=aggregateRuleSets({...defaultArgs,sets:[sets[0],sets[1],sets[2]],
    recommendForSet:(set,count,used)=>recommend({sourceId:source.id,
      products:[source,...all],config:{kind:"similar",mode:"ai",
        maxItems:count,excludeIds:[...used],ruleGroups:[]}})});
  assert.equal(result.items.length,8);
  assert.equal(new Set(result.items.map(x=>x.product.id)).size,8);
});
test("bundle budgets seven add-ons so source+add-ons never exceed eight",()=>{
  const result=aggregateRuleSets({...defaultArgs,sets,max:7,
    recommendForSet:(set,count,used)=>({
      items:all.filter(product=>!used.has(product.id)).slice(0,count).map(product=>({product}))
    })});
  assert.equal(result.items.length,7);
  assert.equal(result.items.length+1,8);
});
test("drafts don't contribute on storefront, but can be previewed",()=>{
  const draft={...sets[0],enabled:false};
  const storefront=aggregateRuleSets({...defaultArgs,sets:[draft],recommendForSet:()=>({items:[{product:all[0]}]})});
  assert.equal(storefront.items.length,0);
  const preview=aggregateRuleSets({...defaultArgs,sets:[draft],previewSetId:draft.id,
    recommendForSet:()=>({items:[{product:all[0]}]})});
  assert.equal(preview.items.length,1);
});
