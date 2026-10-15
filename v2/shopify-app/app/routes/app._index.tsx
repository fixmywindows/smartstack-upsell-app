import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/catalogue.server";
import { PLANS, validPlan } from "../utils/plan-limits";

const blocks = [
  { kind: "similar", label: "Similar products", description: "Show relevant alternatives", icon: "◈" },
  { kind: "complement", label: "Complementary", description: "Recommend matching accessories", icon: "✣" },
  { kind: "bought_together", label: "Bought together", description: "Curate product pairings", icon: "▧" },
  { kind: "bundle", label: "Complete the set", description: "Let customers select add-ons", icon: "⊞" },
] as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const [productCount, sets] = await Promise.all([
    db.productSnapshot.count({ where: { shopDomain: session.shop } }),
    db.recommendationRuleSet.findMany({
      where: { shopDomain: session.shop, archived: false },
      select: { kind: true, enabled: true },
    }),
  ]);
  const plan = validPlan(shop.plan);
  const perKind = Object.fromEntries(blocks.map(block => [block.kind, {
    total: sets.filter(set => set.kind===block.kind).length,
    active: sets.filter(set => set.kind===block.kind && set.enabled).length,
  }])) as Record<typeof blocks[number]["kind"], { total:number; active:number }>;
  return {
    shop: session.shop, productCount, plan: PLANS[plan].label,
    allowance: PLANS[plan].setsPerType,
    totalSets: sets.length,
    activeSets: sets.filter(set=>set.enabled).length,
    perKind,
  };
};

const card: React.CSSProperties = {
  background:"#fff",border:"1px solid #dfe2e8",borderRadius:13,padding:20
};
const small: React.CSSProperties = {color:"#646b76",fontSize:13,lineHeight:1.6};
const linkButton: React.CSSProperties = {
  background:"#202124",color:"#fff",padding:"11px 15px",
  borderRadius:8,display:"inline-block",textDecoration:"none",
  fontWeight:600,fontSize:13
};

export default function Dashboard(){
  const data=useLoaderData<typeof loader>();
  return <s-page heading="SmartStack">
    <s-section heading="Smarter recommendations, simpler merchandising">
      <p style={{...small,maxWidth:650,marginBottom:17}}>
        Control what customers see with hand-picked products, automatic matching and product rules.
        Start with a recommendation type, create a set, then preview it before publishing.
      </p>
      <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
        <Link to="/app/blocks" style={linkButton}>Manage recommendation sets →</Link>
        <Link to="/app/preview" style={{...linkButton,background:"#fff",color:"#24272d",
          border:"1px solid #cfd4db"}}>Preview product matches</Link>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",
        gap:12,marginTop:20}}>
        {[
          ["Products synced",data.productCount],
          ["Recommendation sets",data.totalSets],
          ["Active sets",data.activeSets],
          ["Current plan",data.plan]
        ].map(([name,value])=><div key={String(name)} style={card}>
          <div style={small}>{name}</div>
          <div style={{fontWeight:750,fontSize:25,marginTop:3}}>{value}</div>
        </div>)}
      </div>
    </s-section>
    <s-section heading="Your recommendation types">
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}>
        {blocks.map(block=><Link key={block.kind} to={"/app/blocks?kind="+block.kind}
          style={{...card,textDecoration:"none",color:"#24272d",display:"flex",gap:12}}>
          <div style={{width:38,height:38,display:"grid",placeItems:"center",
            background:"#f2f3f8",borderRadius:10,fontSize:23,flexShrink:0}}>{block.icon}</div>
          <div style={{minWidth:0}}>
            <strong style={{fontSize:15}}>{block.label}</strong>
            <div style={{...small,marginTop:5}}>{block.description}</div>
            <div style={{...small,marginTop:10}}>
              <strong>{data.perKind[block.kind].total}</strong> / {data.allowance??"∞"} sets
              {" · "}{data.perKind[block.kind].active} active
            </div>
          </div>
        </Link>)}
      </div>
    </s-section>
    <s-section heading="Get your first set live">
      <div style={{...card,maxWidth:860}}>
        {[
          ["1","Sync products","Import your catalogue, including tags, metafields, images and availability.","/app/catalogue"],
          ["2","Create a recommendation set","Pick the source products and matching strategy, then save a draft.","/app/blocks"],
          ["3","Preview matched products","Check suitability and make changes before visitors see it.","/app/preview"],
          ["4","Add a theme block","In Shopify's theme editor, place Smart recommendations on a product page.","/app/blocks"]
        ].map(([number,title,description,url],index)=><div key={number} style={{
          display:"flex",gap:13,padding:"12px 2px",alignItems:"start",
          borderBottom:index<3?"1px solid #e6e8eb":"none"}}>
          <span style={{width:29,height:29,borderRadius:"50%",background:"#edf0f3",
            display:"grid",placeItems:"center",fontWeight:650,fontSize:13,flexShrink:0}}>{number}</span>
          <div style={{flex:1}}>
            <Link to={url} style={{fontWeight:650,fontSize:14}}>{title}</Link>
            <p style={{...small,margin:"4px 0 0"}}>{description}</p>
          </div>
        </div>)}
      </div>
      <p style={{...small,marginTop:14}}>
        Connected development store: {data.shop}. Automatic suggestions currently use catalogue matching,
        not an external AI model. Bundle discounts, attribution and billing remain disabled.
      </p>
    </s-section>
  </s-page>;
}
