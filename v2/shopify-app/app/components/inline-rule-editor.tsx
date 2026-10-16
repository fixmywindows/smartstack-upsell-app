import { useState, useMemo } from "react";
import { Link, useFetcher } from "react-router";
import { groupsForEditor, countRuleConditions, type MatchGroup, type MatchRule } from "../utils/rule-groups";

type Item={productId:string;title:string;imageUrl:string|null;category:string;priceMinor?:number;currencyCode?:string};
export type RowSet={
  id:string;kind:string;name:string;heading:string;enabled:boolean;priority:number;
  maxItems:number;sourceMatch:string;sourceProductIds:unknown;sourceRules:unknown;sourceLogic:string;
  selectionMode:string;pinnedIds:unknown;targetRules:unknown;targetLogic:string;
  excludeRules:unknown;fallbackMode:string;
};
const OPTIONS=[
  ["title","Product title"],["tags","Product tag"],["category","Category"],
  ["product_type","Product type"],["vendor","Vendor"],["collections","Collection"],["price","Price"]
] as const;
const OPS=[
  ["equals","Equals"],["not_equals","Does not equal"],
  ["contains","Contains"],["not_contains","Does not contain"],
  ["starts_with","Starts with"],["ends_with","Ends with"],
  ["not_starts_with","Does not start with"],["not_ends_with","Does not end with"],
  ["any_of","Any of (comma-separated)"],["all_of","All of (comma-separated)"],
  ["gte","At least"],["lte","At most"],["exists","Has value"],["not_exists","Is missing"]
] as const;
const strings=(val:unknown):string[]=>Array.isArray(val)?
  val.filter((x):x is string=>typeof x==="string"):[];
const joinLogic=(s:string)=>s==="OR"?"OR":"AND";

function Toggle({options,value,onChange,label}:{
  options:ReadonlyArray<[string,string]>;value:string;onChange:(next:string)=>void;label:string
}) {
  return <div role="group" aria-label={label} className="ssr-chooser">
    {options.map(([id,name])=><button key={id} type="button" aria-pressed={value===id}
      onClick={()=>onChange(id)}>{name}</button>)}
  </div>;
}

function ConditionGroups({groups,onChange,outer,setOuter,metafields,categories,remaining,side}:{
  groups:MatchGroup[];onChange:(next:MatchGroup[])=>void;
  outer:string;setOuter:(value:string)=>void;metafields:string[];categories:string[];
  remaining:number|null;side:"if"|"then"
}) {
  const attributeOptions=[...OPTIONS,...metafields.map(key=>["metafield:"+key,"Metafield: "+key] as const)];
  const updateGroup=(gi:number,patch:MatchGroup)=>onChange(groups.map((g,i)=>i===gi?patch:g));
  const updateRule=(gi:number,ri:number,patch:Partial<MatchRule>)=>{
    const group=groups[gi];
    updateGroup(gi,{...group,rules:group.rules.map((r,i)=>i===ri?{...r,...patch}:r)});
  };
  const removeRule=(gi:number,ri:number)=>{
    const group=groups[gi];
    if(group.rules.length===1)onChange(groups.filter((_,i)=>i!==gi));
    else updateGroup(gi,{...group,rules:group.rules.filter((_,i)=>i!==ri)});
  };
  const canAdd=remaining===null||remaining>0;
  return <div className="ssr-logic-groups">
    {groups.length>1&&<label className="ssr-field">
      Join groups
      <select className="ssr-select" value={outer} onChange={e=>setOuter(e.target.value)}>
        <option value="AND">ALL groups match</option><option value="OR">ANY group matches</option>
      </select>
    </label>}
    {groups.map((group,gi)=><div key={gi} className="ssr-group">
      <div className="ssr-group-head">
        <strong>Group {gi+1}</strong>
        <div className="ssr-actions">
          <select className="ssr-select" style={{width:148,minHeight:31,padding:"5px 8px"}}
            aria-label={"Group "+(gi+1)+" logic"} value={group.logic}
            onChange={e=>updateGroup(gi,{...group,logic:joinLogic(e.target.value)})}>
            <option value="AND">ALL conditions</option><option value="OR">ANY condition</option>
          </select>
          <button type="button" className="ssr-btn ssr-btn-minimal"
            onClick={()=>onChange(groups.filter((_,i)=>i!==gi))}>Remove group</button>
        </div>
      </div>
      {group.rules.map((r,ri)=><div className="ssr-condition" key={ri}>
        <select className="ssr-select" value={r.field} aria-label={"Condition attribute "+(ri+1)}
          onChange={e=>updateRule(gi,ri,{field:e.target.value,op:"contains",value:""})}>
          {attributeOptions.map(([value,name])=><option key={value} value={value}>{name}</option>)}
        </select>
        <select className="ssr-select" value={r.op} aria-label={"Condition operator "+(ri+1)}
          onChange={e=>updateRule(gi,ri,{op:e.target.value})}>
          {OPS.filter(([op])=>!["gte","lte"].includes(op)||r.field==="price"||
            r.field.startsWith("metafield:")).map(([op,name])=>
            <option key={op} value={op}>{name}</option>)}
        </select>
        {["exists","not_exists"].includes(r.op)?
          <span className="ssr-caption">No value needed</span>:
        r.field==="category"?
          <select aria-label={"Category "+(ri+1)} className="ssr-select" value={String(r.value)}
            onChange={e=>updateRule(gi,ri,{value:e.target.value})}>
            <option value="">Select category</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
            {r.value&&!categories.includes(String(r.value))&&
              <option value={String(r.value)}>{String(r.value)}</option>}
          </select>:
          <input className="ssr-input" aria-label={"Condition value "+(ri+1)}
            type={r.field==="price"?"number":"text"} min={r.field==="price"?"0":undefined}
            step={r.field==="price"?"0.01":undefined} value={String(r.value)}
            onChange={e=>updateRule(gi,ri,{value:e.target.value})}
            placeholder={r.field.startsWith("metafield:")?"Metafield value":"Enter value"}/>}
        <button type="button" className="ssr-btn ssr-btn-minimal ssr-btn-danger"
          onClick={()=>removeRule(gi,ri)}>×</button>
      </div>)}
      <button type="button" className="ssr-btn ssr-btn-minimal" disabled={!canAdd}
        onClick={()=>updateGroup(gi,{...group,rules:[...group.rules,
          {field:"tags",op:"contains",value:""}]})}>+ {group.rules.length?"Add AND/OR condition":"Add condition"}</button>
    </div>)}
    <button type="button" className="ssr-btn ssr-btn-minimal" style={{justifySelf:"start"}}
      disabled={!canAdd}
      onClick={()=>onChange([...groups,{logic:"AND",rules:[{field:"tags",op:"contains",value:""}]}])}>
      + Add {side==="if"?"IF":"THEN"} condition group
    </button>
    {remaining!==null&&<span className="ssr-caption">
      {remaining} of your plan's additional condition slots available
    </span>}
  </div>;
}

function ProductPicker({selected,onChange,products,label}:{
  selected:string[];onChange:(ids:string[])=>void;products:Item[];label:string
}) {
  const [query,setQuery]=useState("");
  const map=useMemo(()=>new Map(products.map(p=>[p.productId,p])),[products]);
  const displayed=useMemo(()=>products.filter(p=>p.title.toLowerCase().includes(query.toLowerCase())||
    p.category.toLowerCase().includes(query.toLowerCase())).slice(0,35),[products,query]);
  const toggle=(id:string)=>onChange(selected.includes(id)?selected.filter(item=>item!==id):[...selected,id]);
  return <div className="ssr-product-search">
    <div className="ssr-selected">
      {selected.map(id=>{
        const product=map.get(id);
        return <span className="ssr-chip" key={id}>
          {product?.imageUrl&&<img src={product.imageUrl} alt=""/>}
          <span>{product?.title||"Selected product"}</span>
          <button type="button" aria-label={"Remove "+(product?.title||"product")}
            onClick={()=>toggle(id)} style={{border:0,background:"none",cursor:"pointer"}}>×</button>
        </span>;
      })}
    </div>
    <input className="ssr-input" aria-label={"Search "+label} value={query}
      placeholder={"Search "+label+" by name or category"}
      onChange={e=>setQuery(e.target.value)}/>
    <div className="ssr-product-list">
      {displayed.map(p=><label key={p.productId} className="ssr-product-line">
        <input type="checkbox" checked={selected.includes(p.productId)}
          onChange={()=>toggle(p.productId)} aria-label={"Select "+p.title}/>
        {p.imageUrl?<img className="ssr-product-img" src={p.imageUrl} alt=""/>:
          <span className="ssr-product-img" aria-hidden="true"/>}
        <span className="ssr-product-text"><strong>{p.title}</strong><small>{p.category}</small></span>
      </label>)}
      {displayed.length===0&&<p className="ssr-caption" style={{padding:10}}>No matching products in your synced catalogue.</p>}
    </div>
    <span className="ssr-caption">{selected.length} selected</span>
  </div>;
}

export function InlineRuleEditor({set,products,metafields,categories,ruleCap,onClose}:{
  set:RowSet;products:Item[];metafields:string[];categories:string[];
  ruleCap:number|null;onClose:()=>void;
}) {
  const fetcher=useFetcher<{saved?:boolean;error?:string}>();
  const [name,setName]=useState(set.name);
  const [sourceMatch,setSourceMatch]=useState(set.sourceMatch);
  const [sourceIds,setSourceIds]=useState(strings(set.sourceProductIds));
  const [sourceRules,setSourceRules]=useState<MatchGroup[]>(groupsForEditor(set.sourceRules,set.sourceLogic));
  const [sourceLogic,setSourceLogic]=useState(joinLogic(set.sourceLogic));
  const [selectionMode,setSelectionMode]=useState(set.selectionMode);
  const [pinnedIds,setPinnedIds]=useState(strings(set.pinnedIds));
  const [targetRules,setTargetRules]=useState<MatchGroup[]>(groupsForEditor(set.targetRules,set.targetLogic));
  const [targetLogic,setTargetLogic]=useState(joinLogic(set.targetLogic));
  const [priority,setPriority]=useState(set.priority);
  const [maxItems,setMaxItems]=useState(Math.min(set.kind==="bundle"?7:8,Math.max(1,set.maxItems)));
  const [fallback,setFallback]=useState(set.fallbackMode==="stop"?"stop":"next");
  const [enabled,setEnabled]=useState(set.enabled);
  const otherCount=countRuleConditions(groupsForEditor(set.excludeRules));
  const used=(sourceMatch==="rules"?countRuleConditions(sourceRules):0)+
    countRuleConditions(targetRules)+otherCount;
  const remaining=ruleCap===null?null:Math.max(0,ruleCap-used);
  const invalid=ruleCap!==null&&used>ruleCap;
  const missingSource=sourceMatch==="products"&&!sourceIds.length||
    sourceMatch==="rules"&&!countRuleConditions(sourceRules);
  const missingOutput=selectionMode==="manual"&&!pinnedIds.length;
  return <fetcher.Form className="ssr-expanded" method="post">
    <div className="ssr-expanded-top">
      <h4>Fine-tune this recommendation row</h4>
      <button type="button" className="ssr-btn" onClick={onClose}>Close</button>
    </div>
    <input type="hidden" name="intent" value="inline_save"/>
    <input type="hidden" name="kind" value={set.kind}/>
    <input type="hidden" name="setId" value={set.id}/>
    <input type="hidden" name="sourceMatch" value={sourceMatch}/>
    <input type="hidden" name="sourceProductIds" value={JSON.stringify(sourceIds)}/>
    <input type="hidden" name="sourceRules" value={JSON.stringify(sourceMatch==="rules"?sourceRules:[])}/>
    <input type="hidden" name="sourceLogic" value={sourceLogic}/>
    <input type="hidden" name="selectionMode" value={selectionMode}/>
    <input type="hidden" name="pinnedIds" value={JSON.stringify(pinnedIds)}/>
    <input type="hidden" name="targetRules" value={JSON.stringify(targetRules)}/>
    <input type="hidden" name="targetLogic" value={targetLogic}/>
    <input type="hidden" name="enabled" value={enabled?"on":""}/>
    <input type="hidden" name="fallbackMode" value={fallback}/>
    <div className="ssr-expanded-title">
      <label className="ssr-field">Rule name
        <input className="ssr-input" name="name" value={name} onChange={e=>setName(e.target.value)}
          maxLength={80} required/>
      </label>
      <label className="ssr-field">Priority
        <input className="ssr-input" name="priority" type="number" min={1} max={100}
          value={priority} onChange={e=>setPriority(Number(e.target.value))}/>
      </label>
      <label className="ssr-boolean">
        <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>
        Rule active
      </label>
    </div>
    <div className="ssr-two-col">
      <section className="ssr-panel ssr-panel-if">
        <div className="ssr-panel-head"><strong>IF</strong><span className="ssr-caption">Which product page?</span></div>
        <p>Choose which products will trigger this recommendation rule.</p>
        <Toggle label="Source targeting" value={sourceMatch} onChange={setSourceMatch}
          options={[["rules","Matches conditions"],["products","Selected products"],["all","All products"]]}/>
        {sourceMatch==="rules"&&<ConditionGroups side="if" groups={sourceRules} onChange={setSourceRules}
          outer={sourceLogic} setOuter={setSourceLogic} remaining={remaining}
          metafields={metafields} categories={categories}/>}
        {sourceMatch==="products"&&<ProductPicker selected={sourceIds} onChange={setSourceIds}
          products={products} label="trigger products"/>}
        {sourceMatch==="all"&&<p className="ssr-caption">
          Every eligible product will trigger this row. Place general fallback rows at a lower priority.
        </p>}
      </section>
      <div className="ssr-panel-arrow" aria-hidden="true">→</div>
      <section className="ssr-panel ssr-panel-then">
        <div className="ssr-panel-head"><strong>THEN</strong><span className="ssr-caption">What do we recommend?</span></div>
        <p>Show products meeting these conditions, or choose products yourself.</p>
        <Toggle label="Recommendation source" value={selectionMode} onChange={setSelectionMode}
          options={[["ai","By attributes"],["manual","Handpicked"],["hybrid","Both"]]}/>
        {selectionMode!=="ai"&&<ProductPicker selected={pinnedIds} onChange={setPinnedIds}
          products={products} label="recommended products"/>}
        <div className="ssr-field" style={{marginTop:12,marginBottom:9}}>
          Candidate matching conditions
        </div>
        <ConditionGroups side="then" groups={targetRules} onChange={setTargetRules}
          outer={targetLogic} setOuter={setTargetLogic} remaining={remaining}
          metafields={metafields} categories={categories}/>
        <p>When left empty, automatic matching uses catalogue relevance signals.</p>
      </section>
    </div>
    <div className="ssr-extra">
      <label className="ssr-field">{set.kind==="bundle"?"Max add-ons from this row":"Max products from this row"}
        <select className="ssr-select" name="maxItems" value={maxItems}
          onChange={e=>setMaxItems(Number(e.target.value))}>
          {Array.from({length:set.kind==="bundle"?7:8},(_,i)=>i+1).map(n=>
            <option key={n} value={n}>{n} {n===1?"product":"products"}</option>)}
        </select>
        <span className="ssr-caption">{set.kind==="bundle"?
          "A bundle includes the main product: max 7 add-ons + main = 8.":
          "All rows together share one maximum of 8 on the storefront."}</span>
      </label>
      <label className="ssr-field">When no eligible products are found
        <select className="ssr-select" value={fallback} onChange={e=>setFallback(e.target.value)}>
          <option value="next">Continue to next matching row</option>
          <option value="stop">Stop filling this block</option>
        </select>
      </label>
      <div className="ssr-field">
        <span>More options</span>
        <Link to={"/app/sets/"+encodeURIComponent(set.id)} className="ssr-btn">
          Advanced exclusions & settings ↗
        </Link>
        <span className="ssr-caption">Does not change your saved advanced exclusions.</span>
      </div>
    </div>
    {(invalid||missingSource||missingOutput)&&
      <p className="ssr-error" role="alert">{invalid?
        "You've exceeded the number of conditions allowed on your plan.":
        missingSource?"Select a valid IF trigger before saving.":
        "Choose at least one handpicked product."}</p>}
    {fetcher.data?.error&&<p className="ssr-error" role="alert">{fetcher.data.error}</p>}
    {fetcher.data?.saved&&<p className="ssr-notice" role="status">
      Saved successfully. Refresh the storefront to see changes in the combined recommendation block.
    </p>}
    <div className="ssr-footer-actions">
      <span className="ssr-caption">Rules are evaluated in priority order. Duplicate products are removed automatically.</span>
      <div className="ssr-actions">
        <button type="button" className="ssr-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="ssr-btn ssr-btn-primary"
          disabled={fetcher.state!=="idle"||invalid||missingSource||missingOutput||!name.trim()}>
          {fetcher.state!=="idle"?"Saving…":"Save rule"}
        </button>
      </div>
    </div>
  </fetcher.Form>;
}
