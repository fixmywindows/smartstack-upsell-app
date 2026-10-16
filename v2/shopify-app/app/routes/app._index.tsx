import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/catalogue.server";
import { PLANS, validPlan } from "../utils/plan-limits";
import "../styles/rule-journey.css";

const TYPES=[
  {id:"similar",label:"Similar products",description:"Better alternatives, right where shoppers need them.",icon:"◇",color:"purple"},
  {id:"complement",label:"Complementary",description:"Accessories and products that work beautifully together.",icon:"✣",color:"teal"},
  {id:"bought_together",label:"Bought together",description:"Curated pairings, ready for your product pages.",icon:"↗",color:"peach"},
  {id:"bundle",label:"Complete the set",description:"Help customers discover the full combination.",icon:"⊞",color:"blue"}
] as const;
type Kind=typeof TYPES[number]["id"];

export const loader=async({request}:LoaderFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  const shop=await ensureShop(session.shop);
  const [products,sets,designs,recent]=await Promise.all([
    db.productSnapshot.count({where:{shopDomain:session.shop}}),
    db.recommendationRuleSet.findMany({where:{shopDomain:session.shop,archived:false},
      select:{kind:true,enabled:true,priority:true,maxItems:true}}),
    db.recommendationDesign.findMany({where:{shopDomain:session.shop},select:{kind:true}}),
    db.recommendationRuleSet.findMany({
      where:{shopDomain:session.shop,archived:false},
      orderBy:{updatedAt:"desc"},take:4,
      select:{id:true,name:true,kind:true,enabled:true,priority:true,maxItems:true,updatedAt:true}
    })
  ]);
  const plan=validPlan(shop.plan);
  const byType=Object.fromEntries(TYPES.map(t=>[t.id,{
    count:sets.filter(s=>s.kind===t.id).length,
    active:sets.filter(s=>s.kind===t.id&&s.enabled).length,
    design:designs.some(d=>d.kind===t.id),
  }])) as Record<Kind,{count:number;active:number;design:boolean}>;
  const active=sets.filter(s=>s.enabled).length;
  const designed=designs.length;
  const milestoneCount=Number(products>0)+Number(active>0)+Number(designed>0);
  return {
    shop:session.shop,products,planName:PLANS[plan].label,planLimit:PLANS[plan].setsPerType,
    active,sets:sets.length,designed,byType,milestoneCount,
    syncFinished:shop.syncFinished,
    recent:recent.map(row=>({...row,updated:row.updatedAt.toISOString()}))
  };
};

export default function SmartStackHome(){
  const data=useLoaderData<typeof loader>();
  const progress=Math.round(data.milestoneCount/3*100);
  const next=data.products===0
    ?{title:"Sync your catalogue",description:"Bring product images, tags, collections and metafields into SmartStack.",url:"/app/catalogue",button:"Sync products"}
    :data.active===0
    ?{title:"Make your first rule live",description:"Use IF → THEN rows to decide where recommendations appear and what they show.",url:"/app/blocks",button:"Build a rule"}
    :data.designed===0
    ?{title:"Make SmartStack match your store",description:"Open Design Studio to review theme-matched product cards.",url:"/app/design",button:"Style your blocks"}
    :{title:"Preview your full recommendation block",description:"Check which rules contribute to one eight-product shelf.",url:"/app/preview",button:"Open live preview"};
  return <s-page heading="SmartStack">
    <div className="ssr-workspace ssr-home">
      <header className="ssr-home-hero">
        <div className="ssr-home-hero-copy">
          <div className="ssr-home-eyebrow"><span className="ssr-home-spark">✦</span> SMARTSTACK · MERCHANDISING CONTROL</div>
          <h2>Every product page deserves a better next move.</h2>
          <p>Build smarter recommendations without a complicated setup.
            You decide <strong>IF</strong> products match, <strong>THEN</strong> what shoppers see.
            SmartStack handles the rest.</p>
          <div className="ssr-home-hero-actions">
            <Link className="ssr-home-primary" to="/app/blocks">✣ Open Rule Builder <span aria-hidden="true">↗</span></Link>
            <Link className="ssr-home-secondary" to="/app/preview">Preview recommendations →</Link>
          </div>
        </div>
        <div className="ssr-home-hero-art" aria-label="Example of one recommendation block filled by multiple rules">
          <div className="ssr-home-art-caption">EXAMPLE · ONE SMARTER PRODUCT SHELF</div>
          <div className="ssr-home-art-row"><span>IF</span> Snowboard products <b>→</b><strong>3 matches</strong></div>
          <div className="ssr-home-art-row"><span>IF</span> Outdoor accessories <b>→</b><strong>3 matches</strong></div>
          <div className="ssr-home-art-row"><span>IF</span> General fallback <b>→</b><strong>2 matches</strong></div>
          <div className="ssr-home-art-slots" aria-label="Eight recommendation slots">
            {Array.from({length:8},(_,i)=><span key={i} data-tint={i<3?"purple":i<6?"mint":"orange"}/>)}
          </div>
          <small>Up to 8 different products · 1 storefront block</small>
        </div>
      </header>

      <div className="ssr-home-stats">
        {[
          {label:"Synced products",value:data.products,icon:"▧",helper:data.syncFinished?"Catalogue scan complete":"More products may need syncing"},
          {label:"Active rules",value:data.active,icon:"✣",helper:data.sets+" total saved rules"},
          {label:"Block types in use",value:TYPES.filter(t=>data.byType[t.id].active>0).length+" / 4",icon:"◇",helper:"Distinct recommendation types"},
          {label:"Your plan",value:data.planName,icon:"◈",helper:(data.planLimit??"Unlimited")+" rules per block type"},
        ].map(item=><div className="ssr-home-stat" key={item.label}>
          <span className="ssr-home-stat-symbol" aria-hidden="true">{item.icon}</span>
          <div className="ssr-home-stat-label">{item.label}</div>
          <strong>{item.value}</strong>
          <div className="ssr-home-stat-helper">{item.helper}</div>
        </div>)}
      </div>

      <div className="ssr-home-main">
        <section className="ssr-home-panel ssr-home-setup">
          <div className="ssr-home-section-title">
            <div>
              <span className="ssr-home-overline">YOUR NEXT MOVE</span>
              <h3>Keep your store selling smarter</h3>
              <p>We'll guide the setup. The recommendations remain yours to control.</p>
            </div>
            <span className="ssr-home-progress-label">{data.milestoneCount} of 3 configured</span>
          </div>
          <div className="ssr-home-progress-track" role="progressbar" aria-valuenow={data.milestoneCount}
            aria-valuemin={0} aria-valuemax={3} aria-label="SmartStack setup milestones">
            <span style={{width:progress+"%"}}/>
          </div>
          <div className="ssr-home-checklist">
            {[
              {number:"01",name:"Connect your catalogue",detail:"Tags, collections, products and metafields",
                done:data.products>0,href:"/app/catalogue",cta:"Manage catalogue"},
              {number:"02",name:"Activate recommendation rules",detail:"Write IF → THEN rows, preview, then enable",
                done:data.active>0,href:"/app/blocks",cta:"Edit rules"},
              {number:"03",name:"Review storefront design",detail:"Match your theme or choose a visual preset",
                done:data.designed>0,href:"/app/design",cta:"Open Design Studio"},
            ].map(row=><div className="ssr-home-check" key={row.number}>
              <span className={"ssr-home-check-circle"+(row.done?" ssr-home-check-done":"")}>
                {row.done?"✓":row.number}
              </span>
              <div><strong>{row.name}</strong><small>{row.detail}</small></div>
              <Link to={row.href}>{row.cta} →</Link>
            </div>)}
          </div>
          <div className="ssr-home-next">
            <div className="ssr-home-next-icon" aria-hidden="true">↗</div>
            <div><span>RECOMMENDED NEXT</span><strong>{next.title}</strong>
              <p>{next.description}</p></div>
            <Link className="ssr-home-next-button" to={next.url}>{next.button} →</Link>
          </div>
          <p className="ssr-home-footnote">Theme placement must also be checked in Shopify's Online Store theme editor.
            SmartStack doesn't currently detect whether your theme app block is published.</p>
        </section>

        <section className="ssr-home-panel">
          <div className="ssr-home-section-title">
            <div><span className="ssr-home-overline">YOUR TOOLS</span>
              <h3>Four ways to sell more</h3>
              <p>Each type has its own rules and appearance.</p></div>
          </div>
          <div className="ssr-home-type-list">
            {TYPES.map(type=><Link to={"/app/blocks?kind="+type.id} key={type.id}
              className="ssr-home-type" data-tone={type.color}>
              <span className="ssr-home-type-icon" aria-hidden="true">{type.icon}</span>
              <span className="ssr-home-type-content"><strong>{type.label}</strong>
                <small>{type.description}</small>
                <span>{data.byType[type.id].count} saved · {data.byType[type.id].active} active</span>
              </span>
              <span className="ssr-home-type-arrow" aria-hidden="true">↗</span>
            </Link>)}
          </div>
        </section>
      </div>
      <section className="ssr-home-panel ssr-home-recent">
        <div className="ssr-home-section-title">
          <div><span className="ssr-home-overline">PICK UP WHERE YOU LEFT OFF</span>
            <h3>Recently edited rules</h3>
            <p>Jump straight back into your merchandising rows.</p></div>
          <Link className="ssr-home-section-link" to="/app/blocks">View all rules →</Link>
        </div>
        {data.recent.length?
          <div className="ssr-home-recent-list">
            {data.recent.map(row=><Link key={row.id}
              to={"/app/blocks?kind="+row.kind+"&edit="+encodeURIComponent(row.id)}
              className="ssr-home-recent-row">
              <div className="ssr-home-recent-bullet">✣</div>
              <div className="ssr-home-recent-copy">
                <strong>{row.name}</strong>
                <small>{TYPES.find(t=>t.id===row.kind)?.label||row.kind}
                  {" · "}Priority {row.priority}{" · "}Up to {row.maxItems} products
                </small>
              </div>
              <span className={"ssr-home-recent-state"+(row.enabled?" active":"")}>
                {row.enabled?"Active":"Draft / paused"}
              </span>
              <span className="ssr-home-recent-open">Open ↗</span>
            </Link>)}
          </div>:
          <div className="ssr-home-recent-empty">
            <strong>Your rules will appear here.</strong>
            Start by creating your first IF → THEN row in the Rule Builder.
          </div>}
      </section>
      <div style={{background:"#f5f2ff",border:"1px solid #e3dafc",borderRadius:14,
        padding:17,display:"flex",flexWrap:"wrap",alignItems:"center",
        justifyContent:"space-between",gap:14,marginTop:15}}>
        <div>
          <strong style={{display:"block",fontSize:15,color:"#332a60"}}>
            Bought Together can now use verified order evidence
          </strong>
          <span style={{display:"block",fontSize:12,color:"#6b6685",marginTop:5}}>
            Optional read_orders permission is required. Nothing is read until
            the store owner approves it. Test orders never count as real evidence.
          </span>
        </div>
        <Link to="/app/orders" className="ssr-home-primary"
          style={{background:"#7057d5",color:"#fff",whiteSpace:"nowrap"}}>
          Review order evidence →
        </Link>
      </div>
      <div style={{background:"linear-gradient(120deg,#f2efff,#ebf8f2)",
        border:"1px solid #dfd9f3",borderRadius:14,padding:17,marginTop:13,
        display:"flex",justifyContent:"space-between",alignItems:"center",gap:15,flexWrap:"wrap"}}>
        <div><strong style={{color:"#332c65"}}>SmartStack Analytics</strong>
          <p style={{fontSize:12,color:"#716d86",lineHeight:1.5,margin:"5px 0 0"}}>
            View recommendation interactions and, when verified Shopify order access
            is connected, directly attributed purchased products, revenue and commission estimates.
          </p>
        </div>
        <Link to="/app/analytics" className="ssr-home-primary"
          style={{background:"#7357d8",color:"white",whiteSpace:"nowrap"}}>
          Open Analytics →
        </Link>
      </div>
      <div className="ssr-home-note">
        <span>✦</span> Automatic suggestions currently use catalogue attributes, not a connected AI model.
        Subscription billing, real bundle discounts and commission collection remain disabled in this development pilot.
      </div>
    </div>
  </s-page>;
}
