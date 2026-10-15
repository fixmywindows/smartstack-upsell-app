import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/catalogue.server";
import { PLANS, canCreateSet, validPlan } from "../utils/plan-limits";
import { countRuleConditions, normaliseRuleGroups } from "../utils/rule-groups";

const types = [
  { id: "similar", label: "Similar products", description: "Comparable alternatives for each product." },
  { id: "complement", label: "Complementary", description: "Accessories and products that work together." },
  { id: "bought_together", label: "Bought together", description: "Handpicked pairs and purchase-history recommendations." },
  { id: "bundle", label: "Complete the set", description: "Selectable sets with up to three add-ons." }
] as const;
type Kind = typeof types[number]["id"];
const isKind = (value: string): value is Kind => types.some(t => t.id === value);
const panel: React.CSSProperties = { background: "#fff", border: "1px solid #dfe2e8", borderRadius: 12, padding: 18 };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "9px 12px",
  borderRadius: 8, border: "1px solid #cfd3d9", background: "#fff", color: "#24272d",
  cursor: "pointer", textDecoration: "none", fontSize: 13, fontWeight: 600 };
const muted: React.CSSProperties = { color: "#626977", fontSize: 13 };
const asStrings = (v: unknown): string[] => Array.isArray(v) ? v.filter((x):x is string=>typeof x==="string") : [];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const url = new URL(request.url);
  const requestKind = url.searchParams.get("kind") || "similar";
  const kind: Kind = isKind(requestKind) ? requestKind : "similar";
  const showArchived = url.searchParams.get("archived") === "1";
  const [sets, products] = await Promise.all([
    db.recommendationRuleSet.findMany({where:{shopDomain:session.shop},
      orderBy:[{priority:"asc"},{createdAt:"asc"}]}),
    db.productSnapshot.findMany({where:{shopDomain:session.shop},
      take:3000,select:{productId:true,title:true,imageUrl:true}})
  ]);
  const plan = validPlan(shop.plan);
  const counts = Object.fromEntries(types.map(type => [type.id,
    sets.filter(set => set.kind===type.id&&!set.archived).length])) as Record<Kind,number>;
  return {
    kind, showArchived, rows:sets.filter(set=>set.kind===kind&&set.archived===showArchived),
    counts, productCount:products.length, products, plan, label:PLANS[plan].label,
    cap:PLANS[plan].setsPerType, canAdd:canCreateSet(plan,counts[kind]),
    activeCount:sets.filter(s=>s.enabled&&!s.archived).length,
    notice:url.searchParams.get("notice")||""
  };
};

export const action = async ({request}: ActionFunctionArgs) => {
  const {session}=await authenticate.admin(request);
  const form=await request.formData();
  const kind=String(form.get("kind")||"");
  const id=String(form.get("setId")||"").slice(0,140);
  const intent=String(form.get("intent")||"");
  if(!isKind(kind)||!id) return Response.json({error:"Invalid recommendation set."},{status:400});
  try {
    const service=await import("../services/rule-sets.server");
    if(intent==="duplicate"){
      const copy=await service.duplicateRuleSet(session.shop,id);
      return redirect("/app/sets/"+encodeURIComponent(copy.id)+"?notice=duplicated");
    }else if(intent==="archive") await service.archiveRuleSet(session.shop,id);
    else if(intent==="restore") await service.restoreRuleSet(session.shop,id);
    else if(intent==="toggle") await service.changeSetStatus(session.shop,id,form.get("enabled")==="true");
    else return Response.json({error:"Unknown action."},{status:400});
    return redirect("/app/blocks?kind="+kind+"&notice=saved");
  }catch(error){
    return Response.json({error:error instanceof Error && error.name==="FormValidationError"?
      error.message:"Unable to update set. Please try again."},{status:400});
  }
};

export default function BlockWorkspace(){
  const data=useLoaderData<typeof loader>();
  const result=useActionData<{error?:string}>();
  const current=types.find(t=>t.id===data.kind)!;
  const photoMap=new Map(data.products.map(p=>[p.productId,p]));
  return <s-page heading="Recommendation sets">
    <s-section heading="Your merchandising workspace">
      <p style={{...muted,maxWidth:700,lineHeight:1.65}}>
        Create sets that decide which products trigger a recommendation and what customers see.
        More specific sets take priority over the general fallback.
      </p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginTop:16}}>
        {[
          ["Active sets",String(data.activeCount)],
          ["Synced products",String(data.productCount)],
          ["Current plan",data.label]
        ].map(([title,value])=><div key={title} style={panel}>
          <div style={muted}>{title}</div><strong style={{fontSize:23}}>{value}</strong>
        </div>)}
      </div>
    </s-section>
    <s-section heading="Recommendation types">
      <nav aria-label="Recommendation types" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
        {types.map(type=><Link key={type.id} to={"/app/blocks?kind="+type.id}
          aria-current={data.kind===type.id?"page":undefined}
          style={{...panel,padding:14,textDecoration:"none",color:"#222",border:data.kind===type.id?
            "2px solid #303237":"1px solid #dfe2e8",background:data.kind===type.id?"#f5f6f8":"#fff"}}>
          <strong style={{fontSize:14}}>{type.label}</strong><div style={{...muted,marginTop:5}}>
            {data.counts[type.id]} / {data.cap??"∞"} sets</div>
        </Link>)}
      </nav>
      <div style={{...panel,marginTop:16}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"start"}}>
          <div><h2 style={{fontSize:20,margin:"0 0 5px"}}>{current.label}</h2>
            <p style={{...muted,margin:0}}>{current.description}</p></div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Link style={btn} to={"/app/preview?kind="+data.kind}>Preview matches</Link>
            {data.canAdd?<Link style={{...btn,background:"#202124",color:"white",borderColor:"#202124"}}
              to={"/app/sets/new?kind="+data.kind}>+ Create set</Link>:
              <span style={{...btn,cursor:"not-allowed",background:"#f3f4f7",color:"#737782"}}>
                Set limit reached</span>}
          </div>
        </div>
        {result?.error&&<p role="alert" style={{padding:12,color:"#a11e1e",background:"#fff2f0",
          borderRadius:7}}>{result.error}</p>}
        {data.notice&&<p role="status" style={muted}>Saved successfully.</p>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"22px 0 12px"}}>
          <strong style={{fontSize:14}}>{data.showArchived?"Archived sets":"Your sets"}</strong>
          <Link style={{...muted,textDecoration:"underline"}} to={"/app/blocks?kind="+data.kind+
            (data.showArchived?"":"&archived=1")}>{data.showArchived?"← Active & draft sets":"View archived"}</Link>
        </div>
        {data.rows.length===0?<div style={{textAlign:"center",padding:"36px 10px"}}>
          <h3 style={{margin:0}}>{data.showArchived?"No archived sets":"No sets yet"}</h3>
          <p style={muted}>{data.showArchived?"Archived sets appear here.":"Create your first set to start merchandising."}</p>
        </div>:<div style={{display:"grid",gap:10}}>
          {data.rows.map(set=>{
            const ids=asStrings(set.pinnedIds);
            const trigger=set.sourceMatch==="all"?"All products":set.sourceMatch==="products"?
              asStrings(set.sourceProductIds).length+" selected products":"Products matching conditions";
            const triggerCount=countRuleConditions(normaliseRuleGroups(set.sourceRules,set.sourceLogic));
            const targetCount=countRuleConditions(normaliseRuleGroups(set.targetRules,set.targetLogic));
            const excludeCount=countRuleConditions(normaliseRuleGroups(set.excludeRules,set.excludeLogic));
            const banned=asStrings(set.excludedProductIds).length;
            return <article key={set.id} style={{...panel,padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <div style={{flex:"1 1 270px",minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <strong style={{fontSize:16}}>{set.name}</strong>
                    <span style={{...muted,fontSize:11,borderRadius:20,padding:"4px 9px",
                      background:set.enabled?"#e9f4ed":"#f0f1f4",color:set.enabled?"#18653e":"#60636a"}}>
                      {set.archived?"Archived":set.enabled?"Active":"Draft / paused"}
                    </span>
                    {set.legacyBlockId&&<span style={{...muted,fontSize:11}}>Imported</span>}
                  </div>
                  <p style={{...muted,margin:"8px 0"}}>{trigger} · {set.selectionMode==="ai"?
                    "Automatic":set.selectionMode==="manual"?"Manual":"Hybrid"} · Priority {set.priority}</p>
                  <p style={{...muted,margin:"5px 0 10px"}}>
                    {triggerCount} trigger conditions · {targetCount} candidate filters ·
                    {" "}{excludeCount+banned} exclusions ·
                    {" "}{set.fallbackMode==="stop"?"Stop if empty":"Try next set if empty"}
                  </p>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    {ids.slice(0,3).map(id=>{
                      const p=photoMap.get(id);
                      return p?.imageUrl?<img key={id} src={p.imageUrl} title={p.title} alt={p.title}
                        style={{width:42,height:42,objectFit:"contain",borderRadius:6,background:"#f5f5f7"}}/>:
                      <div key={id} style={{width:42,height:42,display:"grid",placeItems:"center",background:"#f2f3f6",borderRadius:6}}>▧</div>;
                    })}
                    <span style={muted}>{ids.length?ids.length+" pinned product(s)":"Automatic product matching"}</span>
                  </div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"start"}}>
                  {!set.archived&&<>
                    <Link style={btn} to={"/app/sets/"+encodeURIComponent(set.id)}>Edit</Link>
                    <Link style={btn} to={"/app/preview?kind="+data.kind+"&set="+encodeURIComponent(set.id)}>
                      Preview
                    </Link>
                    <Form method="post"><input type="hidden" name="setId" value={set.id}/>
                      <input type="hidden" name="kind" value={data.kind}/>
                      <button style={btn} name="intent" value="duplicate" disabled={!data.canAdd}>Duplicate</button></Form>
                    <Form method="post"><input type="hidden" name="setId" value={set.id}/>
                      <input type="hidden" name="kind" value={data.kind}/>
                      <input type="hidden" name="enabled" value={String(!set.enabled)}/>
                      <button style={btn} name="intent" value="toggle">{set.enabled?"Pause":"Activate"}</button></Form>
                    <Form method="post" onSubmit={event=>{
                      if(!window.confirm("Archive this set? You can restore it later."))event.preventDefault();
                    }}><input type="hidden" name="setId" value={set.id}/>
                      <input type="hidden" name="kind" value={data.kind}/>
                      <button style={{...btn,color:"#a03b34"}} name="intent" value="archive">Archive</button></Form>
                  </>}
                  {set.archived&&<Form method="post"><input type="hidden" name="setId" value={set.id}/>
                    <input type="hidden" name="kind" value={data.kind}/>
                    <button style={btn} name="intent" value="restore" disabled={!data.canAdd}>Restore as draft</button>
                  </Form>}
                </div>
              </div>
            </article>;
          })}
        </div>}
        <p style={{...muted,margin:"16px 0 0"}}>
          Free: 3 sets/type · Growth (£15): 10 · Insights (£45): unlimited.
          Archived sets don't count. Subscription billing is disabled in this development pilot.
        </p>
      </div>
    </s-section>
  </s-page>;
}
