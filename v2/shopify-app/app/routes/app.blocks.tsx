import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/catalogue.server";
import { PLANS, canCreateSet, validPlan } from "../utils/plan-limits";
import { countRuleConditions, groupsForEditor, normaliseRuleGroups, type MatchGroup } from "../utils/rule-groups";
import { InlineRuleEditor, type RowSet } from "../components/inline-rule-editor";
import "../styles/rule-journey.css";

const TYPES=[
  {id:"similar",name:"Similar products",short:"Similar",icon:"◇",
    description:"Show alternatives that match the shopper's interests."},
  {id:"complement",name:"Complementary products",short:"Complementary",icon:"✣",
    description:"Pair products with accessories that make sense."},
  {id:"bought_together",name:"Bought together",short:"Bought together",icon:"↗",
    description:"Create purchase pairings and curated cross-sells."},
  {id:"bundle",name:"Complete the set",short:"Bundles",icon:"⊞",
    description:"Build selectable bundles, without a live discount yet."}
] as const;
type Kind=typeof TYPES[number]["id"];
const validKind=(v:string):v is Kind=>TYPES.some(t=>t.id===v);
const strings=(v:unknown):string[]=>Array.isArray(v)?
  v.filter((x):x is string=>typeof x==="string"):[];
const DISPLAY_FIELDS:Record<string,string>={
  title:"Title",tags:"Tag",category:"Category",product_type:"Product type",vendor:"Vendor",
  collections:"Collection",price:"Price",available:"Availability"
};
const DISPLAY_OPS:Record<string,string>={
  equals:"equals",not_equals:"is not",contains:"contains",not_contains:"excludes",
  starts_with:"starts with",ends_with:"ends with",not_starts_with:"doesn't start with",
  not_ends_with:"doesn't end with",any_of:"contains any of",all_of:"contains all of",
  gte:"at least",lte:"at most",exists:"is present",not_exists:"is missing"
};
function summaryRules(value:unknown,outer:string):string{
  const groups=groupsForEditor(value,outer);
  if(!groups.length)return "";
  const ruleText=(r:{field:string;op:string;value:string|number})=>{
    const field=DISPLAY_FIELDS[r.field]||r.field.replace(/^metafield:/,"Metafield ");
    return field+" "+(DISPLAY_OPS[r.op]||r.op)+
      (["exists","not_exists"].includes(r.op)?"":' "'+String(r.value)+'"');
  };
  return groups.map(g=>g.rules.map(ruleText).join(g.logic==="OR"?" OR ":" AND "))
    .join(outer==="OR"?"  OR  ":"  AND  ").slice(0,230);
}

export const loader=async({request}:LoaderFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  const shop=await ensureShop(session.shop);
  const url=new URL(request.url);
  const q=url.searchParams.get("kind")||"similar";
  const kind:Kind=validKind(q)?q:"similar";
  const archived=url.searchParams.get("archived")==="1";
  const edit=url.searchParams.get("edit")||"";
  const [sets,products,keys]=await Promise.all([
    db.recommendationRuleSet.findMany({
      where:{shopDomain:session.shop},
      orderBy:[{priority:"asc"},{createdAt:"asc"}]
    }),
    db.productSnapshot.findMany({where:{shopDomain:session.shop},
      take:3000,orderBy:{title:"asc"},
      select:{productId:true,title:true,imageUrl:true,category:true}})
    ,
    db.productSnapshot.findMany({where:{shopDomain:session.shop},take:400,
      select:{metafields:true,category:true}})
  ]);
  const plan=validPlan(shop.plan);
  const counts=Object.fromEntries(TYPES.map(type=>[type.id,
    sets.filter(s=>s.kind===type.id&&!s.archived).length])) as Record<Kind,number>;
  const active=sets.filter(s=>s.enabled&&!s.archived);
  const current=sets.filter(s=>s.kind===kind&&s.archived===archived);
  const categories=[...new Set(products.map(p=>p.category).filter(Boolean))].sort();
  const metafields=[...new Set(keys.flatMap(p=>{
    const m=p.metafields;
    return m&&typeof m==="object"&&!Array.isArray(m)?Object.keys(m):[];
  }))].sort();
  const budget=kind==="bundle"?7:8;
  const potential=Math.min(8,(kind==="bundle"?1:0)+current
    .filter(row=>row.enabled&&!row.archived)
    .reduce((sum,row)=>sum+Math.min(row.maxItems,budget),0));
  return {
    shop:session.shop,kind,archived,edit,rows:current,counts,products,categories,metafields,
    currentPlan:plan,planLabel:PLANS[plan].label,
    ruleCap:PLANS[plan].rulesPerSet,cap:PLANS[plan].setsPerType,
    canAdd:canCreateSet(plan,counts[kind]),
    productCount:products.length,activeCount:active.length,potential,
    notice:url.searchParams.get("notice")||""
  };
};

const arrayValue=(v:unknown):string=>JSON.stringify(strings(v));

export const action=async({request}:ActionFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  if(request.method!=="POST")return Response.json({error:"Unsupported method"},{status:405});
  const form=await request.formData();
  const kind=String(form.get("kind")||"");
  const intent=String(form.get("intent")||"");
  if(!validKind(kind))return Response.json({error:"Invalid recommendation type."},{status:400});
  const tools=await import("../services/rule-sets.server");
  try{
    if(intent==="create_draft"){
      const f=new FormData();
      const settings={
        kind,name:"New "+TYPES.find(t=>t.id===kind)!.short+" rule",
        heading:TYPES.find(t=>t.id===kind)!.name,
        enabled:"",priority:"50",sourceMatch:"all",sourceProductIds:"[]",
        sourceRules:"[]",sourceLogic:"AND",selectionMode:"hybrid",pinnedIds:"[]",
        targetRules:"[]",targetLogic:"AND",excludeRules:"[]",excludeLogic:"OR",
        excludeTags:"",excludedProductIds:"[]",fallbackMode:"next",
        maxItems:kind==="bundle"?"2":"3"
      };
      Object.entries(settings).forEach(([k,v])=>f.set(k,v));
      const created=await tools.saveRuleSet(session.shop,f);
      return redirect("/app/blocks?kind="+kind+"&edit="+encodeURIComponent(created.id)+"&notice=created");
    }
    const setId=String(form.get("setId")||"").slice(0,140);
    if(!setId)return Response.json({error:"Please select a saved rule."},{status:400});
    const record=await db.recommendationRuleSet.findFirst({
      where:{shopDomain:session.shop,id:setId,kind,archived:false}
    });
    if(!record&&intent!=="restore")return Response.json({error:"Rule not found."},{status:404});
    if(intent==="inline_save"){
      if(!record)return Response.json({error:"Rule not found."},{status:404});
      // Critical: preserve every advanced condition/exclusion not shown by
      // the compact editor. Revalidate entire record through the same
      // server-side validator and plan quotas used by the full editor.
      const save=new FormData();
      const values:Record<string,string>={
        setId:record.id,kind:record.kind,name:String(form.get("name")||record.name),
        heading:record.heading,
        enabled:form.get("enabled")==="on"?"on":"",
        priority:String(form.get("priority")??record.priority),
        sourceMatch:String(form.get("sourceMatch")??record.sourceMatch),
        sourceProductIds:String(form.get("sourceProductIds")??arrayValue(record.sourceProductIds)),
        sourceRules:String(form.get("sourceRules")??JSON.stringify(groupsForEditor(record.sourceRules,record.sourceLogic))),
        sourceLogic:String(form.get("sourceLogic")??record.sourceLogic),
        selectionMode:String(form.get("selectionMode")??record.selectionMode),
        pinnedIds:String(form.get("pinnedIds")??arrayValue(record.pinnedIds)),
        targetRules:String(form.get("targetRules")??JSON.stringify(groupsForEditor(record.targetRules,record.targetLogic))),
        targetLogic:String(form.get("targetLogic")??record.targetLogic),
        excludeTags:strings(record.excludeTags).join(","),
        excludedProductIds:arrayValue(record.excludedProductIds),
        excludeRules:JSON.stringify(groupsForEditor(record.excludeRules,record.excludeLogic)),
        excludeLogic:record.excludeLogic,
        fallbackMode:String(form.get("fallbackMode")??record.fallbackMode),
        maxItems:String(form.get("maxItems")??record.maxItems)
      };
      Object.entries(values).forEach(([k,v])=>save.set(k,v));
      await tools.saveRuleSet(session.shop,save);
      return Response.json({saved:true});
    }
    if(intent==="duplicate"){
      const copy=await tools.duplicateRuleSet(session.shop,setId);
      return redirect("/app/blocks?kind="+kind+"&edit="+encodeURIComponent(copy.id)+"&notice=duplicated");
    }
    if(intent==="archive")await tools.archiveRuleSet(session.shop,setId);
    else if(intent==="restore")await tools.restoreRuleSet(session.shop,setId);
    else if(intent==="toggle")await tools.changeSetStatus(session.shop,setId,form.get("enabled")==="true");
    else return Response.json({error:"Unknown action"},{status:400});
    return redirect("/app/blocks?kind="+kind+"&notice=saved");
  }catch(error){
    return Response.json({error:error instanceof Error&&error.name==="FormValidationError"?
      error.message:"Unable to save. Check your rule and try again."},{status:400});
  }
};

function GroupPhotos({ids,products}:{ids:string[];products:Map<string,{title:string;imageUrl:string|null}>}){
  const selected=ids.slice(0,3);
  if(!selected.length)return null;
  return <span className="ssr-thumbs">
    {selected.map(id=>{
      const p=products.get(id);
      return p?.imageUrl?<img className="ssr-photo" alt={p.title} title={p.title}
        src={p.imageUrl} key={id}/>:
      <span key={id} className="ssr-photo" title={p?.title||"Product"}/>;
    })}
  </span>;
}

export default function MerchandisingStudio(){
  const data=useLoaderData<typeof loader>();
  const action=useActionData<{error?:string}>();
  const [open,setOpen]=useState<string|null>(data.edit||null);
  const lookup=new Map(data.products.map(p=>[p.productId,p]));
  const selectedType=TYPES.find(t=>t.id===data.kind)!;
  return <s-page heading="Recommendation rules">
    <div className="ssr-workspace">
      <div className="ssr-hero">
        <div>
          <div className="ssr-hero-kicker">SmartStack Merchandising Studio</div>
          <h2>Less setup. Smarter selling.</h2>
          <p>Build recommendations like a sentence: <strong>IF</strong> a product matches,
            <strong> THEN</strong> recommend products matching your criteria.
            Every matching row can contribute to the same storefront block.</p>
        </div>
        <div className="ssr-hero-stats">
          <div className="ssr-hero-stat"><b>{data.activeCount}</b><span>Active rules</span></div>
          <div className="ssr-hero-stat"><b>{data.productCount}</b><span>Synced products</span></div>
          <div className="ssr-hero-stat"><b>{data.planLabel}</b><span>Current plan</span></div>
        </div>
      </div>
      <nav className="ssr-tabs" aria-label="Recommendation types">
        {TYPES.map(t=><Link className="ssr-tab" data-kind={t.id} key={t.id}
          to={"/app/blocks?kind="+t.id} aria-current={t.id===data.kind?"page":undefined}>
          <span className="ssr-tab-icon">{t.icon}</span>
          <span className="ssr-tab-text">
            <strong>{t.short}</strong>
            <small>{data.counts[t.id]} / {data.cap??"∞"} rows</small>
          </span>
        </Link>)}
      </nav>
      <div className="ssr-board">
        <div className="ssr-toolbar">
          <div>
            <h3>{selectedType.name}</h3>
            <p>{selectedType.description} · {data.kind==="bundle"?
              "8 total products, including the main product.":"Up to 8 recommendations in a single storefront block."}</p>
          </div>
          <div className="ssr-actions">
            <Link className="ssr-btn" to={"/app/preview?kind="+data.kind}>Preview combined block ↗</Link>
            <Link className="ssr-btn" to={"/app/design?kind="+data.kind}>Design Studio</Link>
            {!data.archived&&data.canAdd&&<Form method="post">
              <input type="hidden" name="intent" value="create_draft"/>
              <input type="hidden" name="kind" value={data.kind}/>
              <button className="ssr-btn ssr-btn-primary" type="submit">+ Add IF → THEN row</button>
            </Form>}
            {!data.archived&&!data.canAdd&&
              <span className="ssr-caption">Plan limit reached ({data.cap} rows)</span>}
          </div>
        </div>
        {action?.error&&<p className="ssr-error" role="alert">{action.error}</p>}
        {!!data.notice&&<p className="ssr-notice" role="status">Your change was saved.</p>}
        <div className="ssr-topline">
          <strong>{data.archived?"Archived rules":"Your IF → THEN rules"}</strong>
          <div className="ssr-actions">
            <span className="ssr-caption">
              {data.kind==="bundle"?"1 main + up to 7 add-ons":"8 available product slots"}
            </span>
            <div className="ssr-slots" aria-label={data.potential+" of 8 potentially allocated"}>
              {Array.from({length:8},(_,i)=>
                <span key={i} className="ssr-slot" data-active={i<data.potential}/>)}
            </div>
            <Link to={"/app/blocks?kind="+data.kind+(data.archived?"":"&archived=1")}>
              {data.archived?"← Active rules":"View archived"}
            </Link>
          </div>
        </div>
        <div className="ssr-rows">
          {data.rows.length===0&&<div className="ssr-empty">
            <strong>{data.archived?"No archived rules":"Your first rule starts here"}</strong>
            <p>{data.archived?"Archived rules will appear here.":"Click Add IF → THEN row to create your first recommendation."}</p>
          </div>}
          {data.rows.map(set=>{
            const key=set.id;
            const source= set.sourceMatch==="all"?"Any product":set.sourceMatch==="products"?
              strings(set.sourceProductIds).length+" hand-picked trigger product(s)":
              summaryRules(set.sourceRules,set.sourceLogic)||"Choose a trigger";
            const target=summaryRules(set.targetRules,set.targetLogic);
            const pinnedIds=strings(set.pinnedIds);
            const targetText=target|| (set.selectionMode==="manual"?
              pinnedIds.length+" handpicked products":set.selectionMode==="hybrid"?
              "Handpicked + catalogue matches":"Automatic catalogue matches");
            const sourceCount=set.sourceMatch==="rules"?countRuleConditions(
              normaliseRuleGroups(set.sourceRules,set.sourceLogic)):0;
            const targetCount=countRuleConditions(normaliseRuleGroups(set.targetRules,set.targetLogic));
            const isOpen=open===key;
            return <article key={key} className="ssr-row" data-enabled={set.enabled} data-open={isOpen}>
              <div className="ssr-row-top">
                <div>
                  <div className="ssr-row-title">{set.name}
                    <span className={"ssr-pill"+(set.enabled?" ssr-pill-live":"")}>
                      {set.archived?"Archived":set.enabled?"Active":"Draft / paused"}
                    </span>
                  </div>
                  <div className="ssr-row-metadata">
                    <span>Priority {set.priority}</span><span>Up to {Math.min(set.kind==="bundle"?7:8,set.maxItems)} from this row</span>
                    <span>{sourceCount+targetCount} conditions</span>
                    {set.legacyBlockId&&<span>Imported default</span>}
                  </div>
                </div>
                <div className="ssr-row-actions">
                  {!set.archived&&<>
                    <button className="ssr-btn ssr-btn-primary" type="button"
                      onClick={()=>setOpen(isOpen?null:key)} aria-expanded={isOpen}
                      aria-controls={"rule-"+key}>{isOpen?"Close editor":"Edit rule"}</button>
                    <Link className="ssr-btn" to={"/app/preview?kind="+data.kind+"&set="+encodeURIComponent(set.id)}>
                      Preview
                    </Link>
                    <Form method="post">
                      <input type="hidden" name="setId" value={set.id}/>
                      <input type="hidden" name="kind" value={data.kind}/>
                      <input type="hidden" name="enabled" value={String(!set.enabled)}/>
                      <button className="ssr-btn" name="intent" value="toggle" type="submit">
                        {set.enabled?"Pause":"Activate"}</button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="setId" value={set.id}/>
                      <input type="hidden" name="kind" value={data.kind}/>
                      <button className="ssr-btn" name="intent" value="duplicate" disabled={!data.canAdd}>
                        Duplicate</button>
                    </Form>
                    <Form method="post" onSubmit={event=>{
                      if(!window.confirm("Archive this recommendation rule? You can restore it."))event.preventDefault();
                    }}>
                      <input type="hidden" name="setId" value={set.id}/>
                      <input type="hidden" name="kind" value={data.kind}/>
                      <button className="ssr-btn ssr-btn-danger" name="intent" value="archive">Archive</button>
                    </Form>
                  </>}
                  {set.archived&&<Form method="post">
                    <input type="hidden" name="setId" value={set.id}/>
                    <input type="hidden" name="kind" value={data.kind}/>
                    <button className="ssr-btn" name="intent" value="restore" disabled={!data.canAdd}>
                      Restore as draft
                    </button>
                  </Form>}
                </div>
              </div>
              <div className="ssr-flow">
                <div className="ssr-summary ssr-summary-if">
                  <div className="ssr-summary-label">IF · When product matches</div>
                  <div className="ssr-summary-value">{source}</div>
                  <div className="ssr-summary-hint">{set.sourceMatch==="all"?"All product pages":
                    "Controls where this rule appears"}</div>
                </div>
                <div className="ssr-flow-arrow" aria-hidden="true">→</div>
                <div className="ssr-summary ssr-summary-then">
                  <div className="ssr-summary-label">THEN · Recommend products</div>
                  <div className="ssr-summary-value">{targetText}
                    <GroupPhotos ids={pinnedIds} products={lookup}/>
                  </div>
                  <div className="ssr-summary-hint">
                    {Math.min(set.kind==="bundle"?7:8,set.maxItems)} maximum ·
                    {" "}{set.selectionMode==="ai"?"By attributes":
                    set.selectionMode==="manual"?"Handpicked":"Hybrid"}
                  </div>
                </div>
              </div>
              {isOpen&&!set.archived&&<div id={"rule-"+key}>
                <InlineRuleEditor key={key} set={set as RowSet} products={data.products}
                  metafields={data.metafields} categories={data.categories}
                  ruleCap={data.ruleCap} onClose={()=>setOpen(null)}/>
              </div>}
            </article>;
          })}
        </div>
        <p className="ssr-caption" style={{margin:"15px 3px 0"}}>
          Sets are evaluated in priority order. Each matching row contributes up to its own limit,
          and the block combines the results without duplicates until all 8 slots are filled.
          The coloured slot bar shows possible capacity; actual matches can vary by product.
        </p>
      </div>
    </div>
  </s-page>;
}
