import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useActionData, useFetcher, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/catalogue.server";
import { PLANS, canCreateSet, validPlan } from "../utils/plan-limits";
import { groupsForEditor, countRuleConditions, type MatchGroup, type MatchRule } from "../utils/rule-groups";
import { CatalogueChoice } from "../components/inline-rule-editor";
import "../styles/rule-journey.css";

const TYPES = [
  { id: "similar", label: "Similar products", heading: "Similar products" },
  { id: "complement", label: "Complementary products", heading: "Pairs perfectly with" },
  { id: "bought_together", label: "Bought together", heading: "Pairs well with" },
  { id: "bundle", label: "Complete the set", heading: "Complete the set" }
] as const;
type Kind = typeof TYPES[number]["id"];
const isKind = (kind: string): kind is Kind => TYPES.some(t=>t.id===kind);
type ProductItem = {
  productId: string; title: string; imageUrl: string|null; category: string;
  priceMinor: number; currencyCode: string; available: boolean; published: boolean;
};

const FIELDS = [
  {value:"tags",label:"Product tag"},
  {value:"title",label:"Product title"},
  {value:"category",label:"Product category"},
  {value:"product_type",label:"Product type"},
  {value:"vendor",label:"Vendor"},
  {value:"collections",label:"Collection"},
  {value:"price",label:"Price"},
  {value:"available",label:"Availability"}
] as const;
const OPERATORS = [
  {value:"equals",label:"Equals"},
  {value:"not_equals",label:"Does not equal"},
  {value:"contains",label:"Contains"},
  {value:"not_contains",label:"Does not contain"},
  {value:"starts_with",label:"Starts with"},
  {value:"ends_with",label:"Ends with"},
  {value:"not_starts_with",label:"Does not start with"},
  {value:"not_ends_with",label:"Does not end with"},
  {value:"any_of",label:"Is any of (comma-separated)"},
  {value:"all_of",label:"Includes all of (comma-separated)"},
  {value:"gte",label:"Greater than or equal to"},
  {value:"lte",label:"Less than or equal to"},
  {value:"exists",label:"Has a value"},
  {value:"not_exists",label:"Has no value"}
] as const;
const selectStyle: React.CSSProperties = {
  boxSizing:"border-box", width:"100%", minHeight:40, border:"1px solid #cbd0d9",
  borderRadius:8, padding:"8px 10px", color:"#20232a", background:"#fff", font:"inherit",fontSize:14
};
const box: React.CSSProperties = {
  background:"#fff",border:"1px solid #dfe2e8",borderRadius:13,padding:22,marginTop:16
};
const muted: React.CSSProperties = {color:"#656b77",fontSize:13,lineHeight:1.55};
const labelStyle: React.CSSProperties = {fontSize:13,fontWeight:650,display:"block",marginBottom:7};
const buttonStyle: React.CSSProperties = {
  background:"#fff",border:"1px solid #cfd3d9",color:"#222",borderRadius:7,
  padding:"9px 13px",cursor:"pointer",fontSize:13,fontWeight:600
};

const strArr = (value:unknown):string[] =>
  Array.isArray(value)?value.filter((v):v is string=>typeof v==="string"):[];


export const loader = async ({request,params}:LoaderFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  const shop=await ensureShop(session.shop);
  const setId=params.setId||"new";
  const existing=setId==="new"?null:await db.recommendationRuleSet.findFirst({
    where:{shopDomain:session.shop,id:setId,archived:false}
  });
  if(setId!=="new"&&!existing)throw new Response("This set was not found",{status:404});
  const queryKind=new URL(request.url).searchParams.get("kind")||"similar";
  const kind=existing?.kind||queryKind;
  if(!isKind(kind))throw new Response("Invalid block type",{status:400});
  const plan=validPlan(shop.plan);
  const count=await db.recommendationRuleSet.count({
    where:{shopDomain:session.shop,kind,archived:false}
  });
  if(!existing&&!canCreateSet(plan,count))throw new Response(
    "Your plan's set limit has been reached. Return to Recommendation sets.",{status:403}
  );
  const selectedIds=[...new Set([
    ...strArr(existing?.pinnedIds),...strArr(existing?.sourceProductIds),
    ...strArr(existing?.excludedProductIds)
  ])];
  const [recent, selected, attributes] = await Promise.all([
    db.productSnapshot.findMany({
      where:{shopDomain:session.shop},orderBy:{title:"asc"},take:60,
      select:{productId:true,title:true,imageUrl:true,category:true,priceMinor:true,
        currencyCode:true,available:true,published:true}
    }),
    selectedIds.length?db.productSnapshot.findMany({
      where:{shopDomain:session.shop,productId:{in:selectedIds}},
      select:{productId:true,title:true,imageUrl:true,category:true,priceMinor:true,
        currencyCode:true,available:true,published:true}
    }):Promise.resolve([]),
    db.productSnapshot.findMany({
      where:{shopDomain:session.shop},take:300,select:{metafields:true,category:true}
    })
  ]);
  const keys=[...new Set(attributes.flatMap(p=>
    p.metafields&&typeof p.metafields==="object"&&!Array.isArray(p.metafields)?
    Object.keys(p.metafields):[]))].sort();
  const categories=[...new Set(attributes.map(p=>p.category).filter(Boolean))].sort();
  return {
    existing, kind, plan, count, cap:PLANS[plan].setsPerType,
    ruleCap:PLANS[plan].rulesPerSet, products:[...new Map([...recent,...selected].map(p=>[p.productId,p])).values()],
    metafieldKeys:keys,categories,
    label:TYPES.find(t=>t.id===kind)!.label
  };
};

export const action=async({request,params}:ActionFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  const form=await request.formData();
  if(params.setId!=="new")form.set("setId",params.setId||"");
  else form.delete("setId");
  try {
    const {saveRuleSet}=await import("../services/rule-sets.server");
    const saved=await saveRuleSet(session.shop,form);
    return redirect("/app/blocks?kind="+encodeURIComponent(saved.kind)+"&notice=saved");
  }catch(error){
    const message=error instanceof Error&&error.name==="FormValidationError"?error.message:
      "Couldn't save this set. Check the fields and try again.";
    return Response.json({error:message},{status:400});
  }
};

function ProductPicker({name,selected,onChange,initial}:{
  name:string;selected:string[];onChange:(next:string[])=>void;initial:ProductItem[];
}){
  const [query,setQuery]=useState("");
  const [known,setKnown]=useState<ProductItem[]>(initial);
  const fetcher=useFetcher<{products:ProductItem[]}>();
  useEffect(()=>{
    const t=setTimeout(()=>fetcher.load("/app/api/products?q="+encodeURIComponent(query)),260);
    return ()=>clearTimeout(t);
  },[query]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(fetcher.data?.products?.length){
      setKnown(prev=>[...new Map([...prev,...fetcher.data!.products].map(p=>[p.productId,p])).values()]);
    }
  },[fetcher.data]);
  const byId=useMemo(()=>new Map(known.map(p=>[p.productId,p])),[known]);
  const shown=query?(fetcher.data?.products||[]):initial;
  const toggle=(id:string)=>onChange(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]);
  return <div style={{display:"grid",gap:10}}>
    <input type="hidden" name={name} value={JSON.stringify(selected)}/>
    {selected.length>0&&<div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
      {selected.map(id=>{
        const p=byId.get(id);
        return <div key={id} style={{display:"flex",gap:7,alignItems:"center",
          border:"1px solid #dadee4",background:"#f8f8fa",padding:5,borderRadius:8,maxWidth:240}}>
          {p?.imageUrl?<img src={p.imageUrl} alt="" style={{width:34,height:34,objectFit:"contain",borderRadius:5}}/>:
            <span style={{width:34,height:34,display:"grid",placeItems:"center"}}>▧</span>}
          <span style={{fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {p?.title||"Unavailable product"}
          </span>
          <button type="button" title={"Remove "+(p?.title||"product")} aria-label={"Remove "+(p?.title||"product")}
            style={{...buttonStyle,padding:"3px 7px"}} onClick={()=>toggle(id)}>×</button>
        </div>;
      })}
    </div>}
    <input aria-label="Search store products" placeholder="Search products by name, vendor or category"
      style={selectStyle} value={query} onChange={event=>setQuery(event.target.value)}/>
    <div style={{maxHeight:300,overflowY:"auto",border:"1px solid #e3e5eb",borderRadius:9}}>
      {shown.length===0?<p style={{...muted,padding:"10px 14px"}}>No matching products.</p>:
        shown.map(p=><label key={p.productId} style={{display:"flex",alignItems:"center",gap:11,
          padding:"8px 12px",borderBottom:"1px solid #eef0f3",cursor:"pointer"}}>
          <input type="checkbox" checked={selected.includes(p.productId)} onChange={()=>toggle(p.productId)}
            aria-label={"Select "+p.title}/>
          {p.imageUrl?<img src={p.imageUrl} alt="" loading="lazy" style={{width:48,height:48,objectFit:"contain",
            borderRadius:7,background:"#f4f4f6"}}/>:
            <span style={{width:48,height:48,display:"grid",placeItems:"center",background:"#f4f4f6",borderRadius:7}}>▧</span>}
          <span style={{flex:1,minWidth:0}}>
            <strong style={{display:"block",fontSize:13,overflowWrap:"anywhere"}}>{p.title}</strong>
            <span style={{...muted,fontSize:11}}>
              {p.category} · {new Intl.NumberFormat("en-GB",{style:"currency",currency:p.currencyCode})
                .format(p.priceMinor/100)} · {p.published&&p.available?"Available":"Unavailable"}
            </span>
          </span>
        </label>)}
    </div>
    <span style={muted}>{selected.length} selected. Use search to find more products.</span>
  </div>;
}

/**
 * A merchant-friendly two-level AND/OR editor.
 * All/Any inside each group, and All/Any across groups.
 */
function RuleGroups({label,groups,onChange,outerLogic,setOuterLogic,keys,categories,remaining,excluded=false}:{
  label:string;groups:MatchGroup[];onChange:(groups:MatchGroup[])=>void;
  outerLogic:string;setOuterLogic:(v:string)=>void;keys:string[];categories:string[];
  remaining:number|null;excluded?:boolean;
}){
  const fieldOptions=[...FIELDS,{value:"metafield",label:"Metafield"}];
  const valueStyle={...selectStyle,minWidth:0};
  const canAdd=remaining===null||remaining>0;
  const updateGroup=(index:number,group:MatchGroup)=>{
    onChange(groups.map((g,i)=>i===index?group:g));
  };
  const addCondition=(index:number)=>{
    if(!canAdd)return;
    updateGroup(index,{...groups[index],rules:[...groups[index].rules,{field:"tags",op:"contains",value:""}]});
  };
  const removeCondition=(groupIndex:number,ruleIndex:number)=>{
    const group=groups[groupIndex];
    if(group.rules.length<=1)onChange(groups.filter((_,i)=>i!==groupIndex));
    else updateGroup(groupIndex,{...group,rules:group.rules.filter((_,i)=>i!==ruleIndex)});
  };
  const updateRule=(groupIndex:number,ruleIndex:number,patch:Partial<MatchRule>)=>{
    const group=groups[groupIndex];
    updateGroup(groupIndex,{...group,rules:group.rules.map((r,i)=>i===ruleIndex?{...r,...patch}:r)});
  };
  return <div style={{display:"grid",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <strong style={{fontSize:14}}>{label}</strong>
      {groups.length>1&&<label style={{fontSize:12,display:"flex",alignItems:"center",gap:8}}>
        Across groups:
        <select aria-label={label+" across groups"} style={{...selectStyle,width:166}}
          value={outerLogic} onChange={e=>setOuterLogic(e.target.value)}>
          <option value="AND">Match ALL groups</option>
          <option value="OR">Match ANY group</option>
        </select>
      </label>}
    </div>
    {groups.length===0&&<p style={{...muted,margin:0}}>
      {excluded?"No additional attribute exclusions.":"No conditions yet — all eligible products can match."}
    </p>}
    {groups.map((group,gi)=><div key={gi} style={{
      background:"#f8f9fb",border:"1px solid #e0e3e9",borderRadius:10,padding:15,display:"grid",gap:11
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <strong style={{fontSize:13}}>Group {gi+1}</strong>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{...muted,fontSize:12}}>Within group</span>
          <select aria-label={"Group "+(gi+1)+" logic"} style={{...selectStyle,width:148}}
            value={group.logic} onChange={e=>updateGroup(gi,{...group,logic:e.target.value==="OR"?"OR":"AND"})}>
            <option value="AND">All conditions</option>
            <option value="OR">Any condition</option>
          </select>
          <button type="button" style={{...buttonStyle,color:"#a43731",padding:"8px 10px"}}
            onClick={()=>onChange(groups.filter((_,i)=>i!==gi))}>Remove group</button>
        </div>
      </div>
      {group.rules.map((rule,ri)=><div key={ri} style={{display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:9,alignItems:"center"}}>
        <select aria-label={"Group "+(gi+1)+" attribute "+(ri+1)}
          style={valueStyle} value={rule.field.startsWith("metafield:")?"metafield":rule.field}
          onChange={e=>updateRule(gi,ri,{field:e.target.value==="metafield"?"metafield:":e.target.value,
            value:"",op:"contains"})}>
          {fieldOptions.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        {rule.field.startsWith("metafield:")&&
          <CatalogueChoice kind="metafields" label="metafield key"
            value={rule.field.slice(10)} fallback={keys}
            onChange={key=>updateRule(gi,ri,{field:"metafield:"+key,value:""})}/>}
        <select aria-label={"Group "+(gi+1)+" operator "+(ri+1)}
          style={valueStyle} value={rule.op}
          onChange={e=>updateRule(gi,ri,{op:e.target.value})}>
          {OPERATORS.filter(op=>!["gte","lte"].includes(op.value) ||
            rule.field==="price" || rule.field.startsWith("metafield:")).map(op=>
            <option key={op.value} value={op.value}>{op.label}</option>)}
        </select>
        {["exists","not_exists"].includes(rule.op)
          ?<span style={{...muted,padding:"8px 3px"}}>No value needed</span>
          :rule.field==="available"?
          <select aria-label={"Availability value "+(ri+1)} style={valueStyle}
            value={String(rule.value)} onChange={e=>updateRule(gi,ri,{value:e.target.value})}>
            <option value="">Choose availability</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
          :rule.field==="price"||rule.field.startsWith("metafield:")&&["gte","lte"].includes(rule.op)?
          <input aria-label={"Numeric condition "+(ri+1)} style={valueStyle}
            type={rule.field==="price"?"number":"text"}
            step={rule.field==="price"?"0.01":undefined} min={rule.field==="price"?"0":undefined}
            value={String(rule.value)} placeholder={rule.field==="price"?"Price in store currency":"Numeric metafield value"}
            onChange={e=>updateRule(gi,ri,{value:e.target.value})}/>
          :(["tags","collections","category","vendor","product_type"].includes(rule.field)||
            rule.field.startsWith("metafield:"))?
          <CatalogueChoice key={rule.field}
            kind={rule.field.startsWith("metafield:")?"values":rule.field as
              "tags"|"collections"|"category"|"vendor"|"product_type"}
            metafieldKey={rule.field.startsWith("metafield:")?rule.field.slice(10):""}
            fallback={rule.field==="category"?categories:[]}
            label={rule.field.startsWith("metafield:")?"metafield value":rule.field==="collections"?
              "collection":rule.field==="tags"?"tag":rule.field.replace("_"," ")}
            value={String(rule.value)} onChange={value=>updateRule(gi,ri,{value})}/>
          :<input aria-label={"Condition value "+(ri+1)} style={valueStyle}
            type="text" value={String(rule.value)} maxLength={160}
            placeholder="Enter text or fragment"
            onChange={e=>updateRule(gi,ri,{value:e.target.value})}/>}
        <button type="button" style={{...buttonStyle,color:"#a43731"}}
          onClick={()=>removeCondition(gi,ri)} aria-label={"Remove condition "+(ri+1)}>
          Remove
        </button>
      </div>)}
      <button type="button" disabled={!canAdd} style={{...buttonStyle,justifySelf:"start"}}
        onClick={()=>addCondition(gi)}>+ Add condition</button>
    </div>)}
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <button type="button" disabled={!canAdd} style={{...buttonStyle,justifySelf:"start"}}
        onClick={()=>onChange([...groups,{logic:"AND",rules:[{field:"tags",op:"contains",value:""}]}])}>
        + Add condition group
      </button>
      <span style={muted}>
        {remaining===null?"Unlimited conditions available":remaining+" condition(s) remaining"}
      </span>
    </div>
  </div>;
}

export default function SetEditor(){
  const data=useLoaderData<typeof loader>();
  const action=useActionData<{error?:string}>();
  const navigation=useNavigation();
  const existing=data.existing;
  const type=TYPES.find(t=>t.id===data.kind)!;
  const [name,setName]=useState(existing?.name||"");
  const [heading,setHeading]=useState(existing?.heading||type.heading);
  const [enabled,setEnabled]=useState(Boolean(existing?.enabled));
  const [priority,setPriority]=useState(Number(existing?.priority??50));
  const [sourceMatch,setSourceMatch]=useState(existing?.sourceMatch||"all");
  const [selectionMode,setSelectionMode]=useState(existing?.selectionMode||"hybrid");
  const [maxItems,setMaxItems]=useState(Number(existing?.maxItems??(data.kind==="bundle"?3:3)));
  const [sourceProductIds,setSourceProductIds]=useState(strArr(existing?.sourceProductIds));
  const [pinnedIds,setPinnedIds]=useState(strArr(existing?.pinnedIds));
  const [sourceGroups,setSourceGroups]=useState<MatchGroup[]>(groupsForEditor(existing?.sourceRules,existing?.sourceLogic));
  const [targetGroups,setTargetGroups]=useState<MatchGroup[]>(groupsForEditor(existing?.targetRules,existing?.targetLogic));
  const [excludeGroups,setExcludeGroups]=useState<MatchGroup[]>(groupsForEditor(existing?.excludeRules,existing?.excludeLogic));
  const [sourceLogic,setSourceLogic]=useState(existing?.sourceLogic||"AND");
  const [targetLogic,setTargetLogic]=useState(existing?.targetLogic||"AND");
  const [excludeTags,setExcludeTags]=useState(strArr(existing?.excludeTags).join(", "));
  const [excludedProductIds,setExcludedProductIds]=useState(strArr(existing?.excludedProductIds));
  const [excludeLogic,setExcludeLogic]=useState(existing?.excludeLogic||"OR");
  const [fallbackMode,setFallbackMode]=useState(existing?.fallbackMode||"next");
  const rulesUsed=(sourceMatch==="rules"?countRuleConditions(sourceGroups):0)
    +countRuleConditions(targetGroups)+countRuleConditions(excludeGroups);
  const freeSlots=data.ruleCap===null?null:Math.max(0,data.ruleCap-rulesUsed);
  const saving=navigation.state!=="idle";
  const pickerTitle=(title:string,description:string)=><div style={{marginBottom:13}}>
    <h3 style={{margin:"0 0 5px",fontSize:17}}>{title}</h3>
    <p style={{...muted,margin:0}}>{description}</p>
  </div>;
  return <s-page heading={existing?"Edit recommendation set":"New recommendation set"}>
    <s-section heading={type.label}>
      <p style={{...muted,margin:"3px 0 12px"}}><Link to={"/app/blocks?kind="+data.kind}>← Back to {type.label}</Link>
        {" · "}{data.plan.toUpperCase()} plan — {data.cap??"Unlimited"} sets per type,
        {data.ruleCap??"unlimited"} conditions per set.
      </p>
      {action?.error&&<p role="alert" style={{background:"#fff2f0",color:"#9f2422",padding:14,borderRadius:9}}>
        {action.error}</p>}
      <Form method="post" style={{maxWidth:1030}}>
        <input type="hidden" name="kind" value={data.kind}/>
        <input type="hidden" name="sourceProductIds" value={JSON.stringify(sourceProductIds)}/>
        <input type="hidden" name="pinnedIds" value={JSON.stringify(pinnedIds)}/>
        <input type="hidden" name="sourceRules" value={JSON.stringify(sourceMatch==="rules"?sourceGroups:[])}/>
        <input type="hidden" name="targetRules" value={JSON.stringify(targetGroups)}/>
        <input type="hidden" name="excludeRules" value={JSON.stringify(excludeGroups)}/>
        <input type="hidden" name="excludeLogic" value={excludeLogic}/>
        <input type="hidden" name="excludedProductIds" value={JSON.stringify(excludedProductIds)}/>
        <input type="hidden" name="sourceLogic" value={sourceLogic}/>
        <input type="hidden" name="targetLogic" value={targetLogic}/>
        <section style={box}>
          {pickerTitle("1. Name and availability","Give this recommendation set an internal name and decide whether to make it active.")}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
            <label style={labelStyle}>Set name
              <input required maxLength={80} name="name" style={{...selectStyle,marginTop:6}}
                value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Snowboard accessories"/>
            </label>
            <label style={labelStyle}>Heading customers see
              <input maxLength={100} name="heading" style={{...selectStyle,marginTop:6}}
                value={heading} onChange={e=>setHeading(e.target.value)}/>
            </label>
          </div>
          <label style={{display:"inline-flex",alignItems:"center",gap:9,marginTop:18,fontWeight:600,fontSize:14}}>
            <input type="checkbox" name="enabled" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>
            Enable this set
          </label>
          <p style={{...muted,margin:"8px 0 0"}}>New sets start as drafts. Enabling a set makes it eligible to appear wherever this block type is placed.</p>
        </section>
        <section style={box}>
          {pickerTitle("2. Where should this appear?","Choose which source products should trigger the recommendations.")}
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16}}>
            {[["all","All products"],["products","Selected products"],["rules","Matching attributes"]].map(([value,title])=>
              <label key={value} style={{display:"flex",alignItems:"center",gap:7,fontSize:14}}>
                <input type="radio" name="sourceMatch" value={value} checked={sourceMatch===value}
                  onChange={()=>setSourceMatch(value)}/>{title}
              </label>)}
          </div>
          {sourceMatch==="products"&&<ProductPicker name="_unused_source" initial={data.products}
            selected={sourceProductIds} onChange={setSourceProductIds}/>}
          {sourceMatch==="rules"&&<RuleGroups label="Trigger conditions" groups={sourceGroups}
            onChange={setSourceGroups} outerLogic={sourceLogic} setOuterLogic={setSourceLogic}
            keys={data.metafieldKeys} categories={data.categories} remaining={freeSlots}/>}
          {sourceMatch==="all"&&<p style={{...muted,background:"#f7f7f9",padding:12,borderRadius:7}}>
            This set is a general fallback. Give more specific sets a smaller priority number.</p>}
        </section>
        <section style={box}>
          {pickerTitle("3. Which products should we recommend?","Choose automatic recommendations, hand-picked products or a combination.")}
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16}}>
            {[["ai","Automatic matching"],["manual","Hand-picked only"],["hybrid","Hand-picked + automatic"]].map(([value,title])=>
              <label key={value} style={{display:"flex",alignItems:"center",gap:7,fontSize:14}}>
                <input type="radio" name="selectionMode" value={value} checked={selectionMode===value}
                  onChange={()=>setSelectionMode(value)}/>{title}
              </label>)}
          </div>
          <p style={{...muted,marginTop:0}}>Automatic currently uses catalogue attributes and compatibility rules. The semantic AI service is not connected yet.</p>
          {selectionMode!=="ai"&&<>
            <label style={labelStyle}>Pinned products (highest priority)</label>
            <ProductPicker name="_unused_pinned" initial={data.products}
              selected={pinnedIds} onChange={setPinnedIds}/>
          </>}
          {pickerTitle("Optional candidate filters","Filter eligible recommendations by categories, product tags, metafields, titles and more.")}
          <RuleGroups label="Recommended product conditions" groups={targetGroups} onChange={setTargetGroups}
            outerLogic={targetLogic} setOuterLogic={setTargetLogic} keys={data.metafieldKeys}
            categories={data.categories} remaining={freeSlots}/>
          <label style={{...labelStyle,marginTop:18}}>Exclude products carrying these tags
            <input name="excludeTags" style={{...selectStyle,marginTop:6}} value={excludeTags}
              onChange={e=>setExcludeTags(e.target.value)} placeholder="clearance, discontinued"/>
          </label>
          <p style={muted}>Separate tags with commas. Unavailable and unpublished products are excluded automatically.</p>
          <details style={{marginTop:20,padding:14,border:"1px solid #e1e4eb",borderRadius:10}}>
            <summary style={{cursor:"pointer",fontWeight:650,fontSize:14}}>Advanced exclusions</summary>
            <p style={muted}>These hard exclusions always win, even for manually pinned products.</p>
            <label style={labelStyle}>Never recommend these products</label>
            <ProductPicker name="_unused_exclusions" initial={data.products}
              selected={excludedProductIds} onChange={setExcludedProductIds}/>
            <div style={{marginTop:18}}>
              <RuleGroups label="Exclude products when these conditions match" groups={excludeGroups}
                onChange={setExcludeGroups} outerLogic={excludeLogic} setOuterLogic={setExcludeLogic}
                keys={data.metafieldKeys} categories={data.categories} remaining={freeSlots} excluded/>
            </div>
          </details>
        </section>
        <section style={box}>
          {pickerTitle("4. Display and prioritise","Fine-tune this set's selection order and number of add-ons.")}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16}}>
            <label style={labelStyle}>Set priority (1 = first)
              <input type="number" name="priority" style={{...selectStyle,marginTop:6}}
                min={1} max={100} value={priority} onChange={e=>setPriority(Number(e.target.value))}/>
            </label>
            <label style={labelStyle}>Maximum add-ons
              <input type="number" name="maxItems" style={{...selectStyle,marginTop:6}}
                min={1} max={data.kind==="bundle"?7:8} value={maxItems}
                onChange={e=>setMaxItems(Number(e.target.value))}/>
            </label>
          </div>
          <label style={{...labelStyle,marginTop:16}}>If this set finds no eligible recommendations
            <select name="fallbackMode" style={{...selectStyle,marginTop:6}} value={fallbackMode}
              onChange={e=>setFallbackMode(e.target.value)}>
              <option value="next">Try the next matching recommendation set</option>
              <option value="stop">Show nothing for this block</option>
            </select>
          </label>
          <p style={muted}>Smaller priority numbers run first. Sets with the same priority favour
            selected products, then attribute rules, then all-products fallbacks. General fallbacks should use priority 100.
            Bundle discounts and commission billing remain disabled during testing.</p>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginTop:24}}>
            <div style={{display:"flex",gap:9}}>
              <button type="submit" disabled={saving} style={{...buttonStyle,background:"#202124",borderColor:"#202124",color:"white",padding:"12px 22px"}}>
                {saving?"Saving…":existing?"Save changes":"Create set"}
              </button>
              <Link to={"/app/blocks?kind="+data.kind} style={{...buttonStyle,textDecoration:"none"}}>Cancel</Link>
            </div>
            <Link to={"/app/preview?kind="+data.kind+(existing?"&set="+encodeURIComponent(existing.id):"")} style={{color:"#4540a4",fontSize:13}}>
              {existing?"Preview this saved set →":"Save the set to preview matches →"}
            </Link>
          </div>
        </section>
      </Form>
    </s-section>
  </s-page>;
}
