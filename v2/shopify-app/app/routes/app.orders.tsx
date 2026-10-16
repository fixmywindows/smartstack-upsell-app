import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { hasOrderScope, syncRecentOrderSignals } from "../services/order-signals.server";

export const loader=async({request}:LoaderFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  const [state,observations,pairs]=await Promise.all([
    db.orderSyncState.findUnique({where:{shopDomain:session.shop}}),
    db.orderPairObservation.count({where:{shopDomain:session.shop}}),
    db.observedProductPair.count({where:{shopDomain:session.shop,orderCount:{gte:2}}})
  ]);
  return {authorized:hasOrderScope(session.scope),state,observations,
    pairs,shop:session.shop};
};

export const action=async({request}:ActionFunctionArgs)=>{
  const {session,admin}=await authenticate.admin(request);
  if(request.method!=="POST")return Response.json({error:"Not allowed"},{status:405});
  if(!hasOrderScope(session.scope)){
    return Response.json({error:"You need to approve the optional read_orders scope first."},
      {status:403});
  }
  try{return Response.json(await syncRecentOrderSignals(admin,session.shop,session.scope));}
  catch(error){
    console.error("SmartStack product-pair sync failed",
      error instanceof Error?error.message:"unknown");
    return Response.json({error:"Could not sync order evidence. Check permissions or try again."},
      {status:503});
  }
};

const panel:React.CSSProperties={
  padding:20,border:"1px solid #e0e2e9",borderRadius:14,
  background:"#fff",marginTop:15
};
const secondary:React.CSSProperties={color:"#6c7382",fontSize:13,lineHeight:1.55};

export default function ProductPairEvidence(){
  const data=useLoaderData<typeof loader>();
  const f=useFetcher<{authorized?:boolean;error?:string;message?:string;
    added?:number;observed?:number;scanned?:number;finished?:boolean}>();
  const hasEvidence=data.pairs>0;
  return <s-page heading="Bought Together evidence">
    <s-section heading="Recommend products purchased together — with real evidence">
      <p style={{...secondary,maxWidth:790}}>
        SmartStack can analyse product IDs from the most recent 60 days of
        eligible, non-test, paid orders. It stores hashed order identifiers
        and aggregate product pairs—not customers, names, emails, addresses
        or individual order prices. Products must co-occur in at least two
        qualifying orders before we label that association as observed.
      </p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginTop:18}}>
        {[
          ["Qualified order observations",data.observations],
          ["Verified product pairs",data.pairs],
          ["Access",data.authorized?"Approved":"Not connected"]
        ].map(([title,value])=><div key={String(title)} style={panel}>
          <div style={secondary}>{title}</div>
          <strong style={{fontSize:23,display:"block",marginTop:5}}>{value}</strong>
        </div>)}
      </div>
      <div style={{...panel,background:"#f8f7ff"}}>
        <h3 style={{margin:"0 0 10px",fontSize:18}}>
          {data.authorized?"Order evidence is available":"Order permission required"}
        </h3>
        {data.authorized?<p style={secondary}>
          Refresh the most recent 60 days of order observations below.
          Sync processes up to 20 orders per request, so repeat while more
          pages remain. Updating or cancelling an order adjusts its pair
          contributions without double-counting.
        </p>:<p style={secondary}>
          This feature is opt-in. Before using real order history, the developer
          must add <code>read_orders</code> to the app's access scopes and
          ask the store owner to approve the new permission. No orders will
          be accessed until that happens. Orders older than 60 days require
          additional Shopify approval and are not used here.
        </p>}
        <f.Form method="post">
          <button type="submit" disabled={!data.authorized||f.state!=="idle"}
            style={{border:0,borderRadius:9,padding:"12px 17px",cursor:"pointer",
              color:"white",background:data.authorized?"#7155d8":"#a7a7b2",
              fontWeight:700}}>
            {f.state==="idle"?"Sync next 20 eligible orders":"Syncing…"}
          </button>
        </f.Form>
        {f.data?.error&&<p role="alert" style={{color:"#ae3939"}}>{f.data.error}</p>}
        {f.data?.message&&<p role="status" style={{...secondary,marginTop:13}}>
          {f.data.message} {f.data.finished?"The scan reached its final page.":
          "More pages may remain."}
        </p>}
        {data.state&&<p style={{...secondary,marginTop:13}}>
          Last synced: {new Date(data.state.updatedAt).toLocaleString("en-GB")}.
          Total scanned in current pass: {data.state.scanned}.
        </p>}
      </div>
      <div style={panel}>
        <strong>Recommendation status</strong>
        <p style={secondary}>
          {hasEvidence?"Verified co-purchases can influence Bought Together recommendations.":
            "No verified product pairs yet. SmartStack will show appropriately labelled catalogue suggestions instead of claiming that shoppers bought them together."}
          {" "}Manual IF → THEN product rules continue to work independently of order access.
        </p>
        <Link to="/app/blocks?kind=bought_together">Manage Bought Together rules →</Link>
      </div>
    </s-section>
  </s-page>;
}
