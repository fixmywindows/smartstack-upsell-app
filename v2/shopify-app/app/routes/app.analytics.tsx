import type {LoaderFunctionArgs} from "react-router";
import {Form,Link,useLoaderData} from "react-router";
import {authenticate} from "../shopify.server";
import {analyticsReport,formatMoney} from "../services/analytics.server";
import "../styles/rule-journey.css";

export const loader=async({request}:LoaderFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  return analyticsReport(session.shop,session.scope,new URL(request.url));
};
const card:React.CSSProperties={
  border:"1px solid #e4e0ef",borderRadius:16,padding:20,
  background:"#fff",minWidth:0
};
const text:React.CSSProperties={fontSize:12,color:"#72748a",lineHeight:1.6};
const KIND_NAMES:Record<string,string>={
  all:"All recommendation types",similar:"Similar products",
  complement:"Complementary",bought_together:"Bought together",bundle:"Complete the set"
};
const pct=(value:number)=>value.toFixed(2)+"%";

function RowChart({daily,field,label,tone}:{
  daily:Array<{date:string;views:number;clicks:number;adds:number;units:number;revenueMinor:number}>;
  field:"views"|"clicks"|"adds"|"units"|"revenueMinor";label:string;tone:string;
}){
  const max=Math.max(1,...daily.map(row=>row[field]));
  return <div style={{marginTop:14}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
      <strong style={{fontSize:13}}>{label}</strong>
      <span style={text}>Daily totals</span>
    </div>
    <div role="img" aria-label={label+" over the reporting period"}
      style={{height:145,display:"flex",gap:3,alignItems:"flex-end",
        marginTop:16,borderBottom:"1px solid #d9d5e8"}}>
      {daily.length===0?<p style={{...text,margin:"auto"}}>No measured activity in this period.</p>:
        daily.map(day=><div key={day.date} title={day.date+": "+day[field]}
          style={{flex:1,minWidth:3,maxWidth:36,height:Math.max(2,day[field]/max*100)+"%",
            background:tone,borderRadius:"5px 5px 0 0",
            opacity:day[field]===0?.14:1,transition:"height .2s ease"}}/>)}
    </div>
    {daily.length>1&&<div style={{display:"flex",justifyContent:"space-between",...text,marginTop:7}}>
      <span>{daily[0].date}</span><span>{daily[daily.length-1].date}</span>
    </div>}
  </div>;
}

export default function SmartStackAnalytics(){
  const data=useLoaderData<typeof loader>();
  const summary=data.summary,advanced=data.advanced;
  const rate=data.plan==="free"?3:data.plan==="growth"?1.5:.5;
  const moneyRows=summary.currencies;
  const emptyOrder=!data.orderConnected;
  const base="/app/analytics";
  const active=data.days;
  const currency=advanced?.selectedCurrency||moneyRows[0]?.currencyCode||"GBP";
  return <s-page heading="SmartStack Analytics">
    <div className="ssr-workspace ssr-analytics">
      <section className="ssr-analytics-hero">
        <div>
          <span className="ssr-hero-kicker">SMARTSTACK · PERFORMANCE INTELLIGENCE</span>
          <h2>Know what your recommendations deliver.</h2>
          <p>From product views to verified basket additions and purchased products.
            No guessed revenue. No hidden commission calculations.</p>
        </div>
        <div className="ssr-analytics-plan">
          <small>CURRENT REPORT</small><strong>{data.plan==="free"?"Free":data.plan==="growth"?"Growth":"Insights"}</strong>
          <span>{data.days}-day period · {KIND_NAMES[data.selectedKind]}</span>
        </div>
      </section>

      <div className="ssr-analytics-toolbar">
        <strong>Overview</strong>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
          {[7,30,90].map(days=><Link key={days}
            className={"ssr-btn"+(active===days?" ssr-btn-primary":"")}
            to={base+"?days="+days+(data.selectedKind==="all"?"":"&kind="+data.selectedKind)}>
            {days} days
          </Link>)}
        </div>
      </div>
      <div className="ssr-analytics-kpis">
        {[
          {title:"Recommended products purchased",value:emptyOrder?"—":String(summary.units),
            unit:emptyOrder?"Order connection required":"Net units in verified orders",icon:"▣"},
          {title:"Attributed sales",value:emptyOrder?"—":
            moneyRows.length===1?formatMoney(moneyRows[0].revenueMinor,moneyRows[0].currencyCode):
            moneyRows.length===0?formatMoney(0,"GBP"):"Multiple currencies",
            unit:emptyOrder?"Not connected":"Product revenue after discounts and returns",icon:"↗"},
          {title:"Estimated commission",value:emptyOrder?"—":
            moneyRows.length===1?formatMoney(moneyRows[0].estimatedCommissionMinor,moneyRows[0].currencyCode):
            moneyRows.length===0?formatMoney(0,"GBP"):"Multiple currencies",
            unit:rate+"% proposed rate · £0 billed by this pilot",icon:"✧"}
        ].map((item,index)=><article style={card} key={item.title} className="ssr-analytics-kpi">
          <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
            <span style={{...text,fontWeight:650}}>{item.title}</span>
            <span className="ssr-analytics-icon" data-tone={index}>{item.icon}</span>
          </div>
          <strong style={{display:"block",fontSize:27,letterSpacing:"-.03em",margin:"10px 0 4px"}}>
            {item.value}
          </strong>
          <small style={text}>{item.unit}</small>
        </article>)}
      </div>
      {moneyRows.length>1&&!emptyOrder&&<div style={card}>
        <strong>Revenue and commission by currency</strong>
        <p style={text}>Currencies are reported separately rather than converted using invented exchange rates.</p>
        {moneyRows.map(row=><p key={row.currencyCode} style={text}>
          {row.currencyCode}: {row.units} units · {formatMoney(row.revenueMinor,row.currencyCode)} revenue
          · {formatMoney(row.estimatedCommissionMinor,row.currencyCode)} potential commission
        </p>)}
      </div>}
      {emptyOrder&&<div style={{...card,background:"#f9f6ff",marginTop:13}}>
        <strong>Connect verified order reporting to see purchases and revenue</strong>
        <p style={text}>SmartStack currently has no approved order access for this store.
          The analytics workspace cannot know which recommendations were purchased or calculate
          merchant charges without a verified Shopify purchase record.
          The store owner must approve the optional <code>read_orders</code> permission,
          then synchronise eligible orders.</p>
        <Link to="/app/orders">Review optional order connection →</Link>
      </div>}

      {!data.paid?<div className="ssr-analytics-locked" style={{marginTop:17}}>
        <span className="ssr-analytics-premium">GROWTH / INSIGHTS</span>
        <h3>Go beyond the numbers.</h3>
        <p>Compare CTR by product, investigate slow-performing combinations,
          filter trend graphs and understand which categories and bundles drive results.</p>
        <p style={{fontSize:12,opacity:.8}}>
          These reporting tools are included in our proposed paid tiers.
          Billing and plan upgrades are not active during this development pilot.
        </p>
        <div className="ssr-analytics-locked-grid">
          <div>◫ Daily charts and date filters</div>
          <div>↗ Best-performing cross-sells</div>
          <div>✧ Frequently paired categories and tags</div>
          <div>◇ Bundle and underperformer insights</div>
        </div>
      </div>:
      <>
        <section style={{...card,marginTop:16}}>
          <div className="ssr-analytics-section-header">
            <div><span className="ssr-home-overline">ANALYSE YOUR TRAFFIC</span>
              <h3>Recommendation funnel</h3>
              <p style={text}>Only measured interactions from shoppers who allow analytics processing.</p>
            </div>
            <Form method="get" style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap"}}>
              <input type="hidden" name="days" value={data.days}/>
              <label style={{fontSize:12,fontWeight:600,display:"grid",gap:5}}>
                Block type
                <select className="ssr-select" name="kind" defaultValue={data.selectedKind}>
                  {Object.entries(KIND_NAMES).map(([key,name])=>
                    <option key={key} value={key}>{name}</option>)}
                </select>
              </label>
              <button className="ssr-btn ssr-btn-primary" type="submit">Apply filter</button>
            </Form>
          </div>
          <div className="ssr-analytics-funnel">
            {[
              ["Rendered",summary.renders,"Cards successfully loaded"],
              ["Viewed",summary.views,"≥50% visible on screen"],
              ["Clicked",summary.clicks,"Clicked a recommendation"],
              ["Added",summary.adds,"Added via SmartStack"],
              ["Purchased",emptyOrder?null:summary.units,"Shopify-verified purchased units"]
            ].map(([name,value,description],i)=><div key={String(name)}>
              <div className="ssr-analytics-funnel-step" data-index={i}>
                <span>{name}</span><strong>{value===null?"—":value}</strong>
              </div>
              <small style={text}>{description}</small>
            </div>)}
          </div>
          <div className="ssr-analytics-rates">
            <div><strong>{pct(summary.viewRate)}</strong><span>Card view rate</span></div>
            <div><strong>{pct(summary.ctr)}</strong><span>Click-through rate / views</span></div>
            <div><strong>{pct(summary.addRate)}</strong><span>Add-to-basket / views</span></div>
            <div><strong>{emptyOrder?"—":pct(summary.purchaseToViewRatio)}</strong>
              <span>Order lines / views (not unique shoppers)</span></div>
          </div>
          <p style={{...text,fontSize:11,marginBottom:0}}>
            These rates compare recorded event counts, not unique visitors. Browser privacy preferences
            and consent affect denominators. They are directional CRO indicators, not a
            customer-level conversion rate or causal incremental lift.
          </p>
        </section>
        <div className="ssr-analytics-pair-charts">
          <section style={card}><RowChart daily={advanced?.daily||[]} field="views" label="Recommendation card views" tone="#7959d8"/></section>
          <section style={card}><RowChart daily={advanced?.daily||[]} field="clicks" label="Recommendation clicks" tone="#1aa489"/></section>
        </div>
        <section style={{...card,marginTop:14}}>
          <div className="ssr-analytics-section-header">
            <div><span className="ssr-home-overline">ACTUAL PURCHASE PERFORMANCE</span><h3>Top recommended products</h3></div>
            <small style={text}>Net revenue and units attributed via verified SmartStack line items</small>
          </div>
          {!advanced?.topProducts.length?<p style={text}>
            {emptyOrder?"Connect order permissions to unlock verified product sales.":
              "No purchases have been attributed to SmartStack recommendations yet."}
          </p>:
          <div className="ssr-analytics-product-list">
            {advanced.topProducts.map(row=><div key={row.productId+"-"+row.kind} className="ssr-analytics-product">
              {row.imageUrl?<img src={row.imageUrl} alt=""/>:<div className="ssr-analytics-img"/>}
              <div><strong>{row.title}</strong><small>{KIND_NAMES[row.kind]||row.kind} · {row.category}</small></div>
              <span>{row.units} sold</span>
              <b>{formatMoney(row.revenueMinor,row.currencyCode)}</b>
            </div>)}
          </div>}
        </section>
        <div className="ssr-analytics-pair-charts">
          <section style={card}>
            <div className="ssr-analytics-section-header"><h3>Often paired categories</h3></div>
            <p style={text}>Co-occurrences in verified eligible orders, independent of recommendation attribution.</p>
            {advanced?.categoryPairs.length?advanced.categoryPairs.map(row=>
              <div key={row.name} className="ssr-analytics-pair">
                <span>{row.name}</span><strong>{row.count} pair observations</strong></div>):
              <p style={text}>No qualifying category pairs have been observed yet.</p>}
          </section>
          <section style={card}>
            <div className="ssr-analytics-section-header"><h3>Tags frequently paired</h3></div>
            <p style={text}>Based on observed product tags in your currently synced catalogue.</p>
            {advanced?.tagPairs.length?advanced.tagPairs.map(row=>
              <div key={row.name} className="ssr-analytics-pair">
                <span>{row.name}</span><strong>{row.count} pair observations</strong></div>):
              <p style={text}>No verified tag pairings yet.</p>}
          </section>
        </div>
        <div className="ssr-analytics-pair-charts">
          <section style={card}>
            <h3>Frequently purchased bundles</h3>
            <p style={text}>Purchases linked to SmartStack's Complete the Set recommendations.</p>
            {advanced?.bundles.length?advanced.bundles.map(row=>
              <div key={row.setId+"-"+row.currencyCode} className="ssr-analytics-pair">
                <span>{row.name}</span>
                <strong>{row.units} units · {formatMoney(row.revenueMinor,row.currencyCode)}</strong>
              </div>):<p style={text}>Bundle attribution will appear after verified purchases.</p>}
          </section>
          <section style={card}>
            <h3>Combinations to review</h3>
            <p style={text}>Recommendations with at least 25 measured views but less than 1% click-through.</p>
            {advanced?.underperformers.length?advanced.underperformers.map(row=>
              <div key={row.productId+"-"+row.setId} className="ssr-analytics-pair">
                <span>{row.title}</span><strong>{row.views} views · {pct(row.ctr)} CTR</strong>
              </div>):<p style={text}>
                No underperformers meet the minimum sample threshold.
              </p>}
          </section>
        </div>
      </>}
      <p style={{...text,margin:"20px 0 0"}}>
        Commission rates shown here are proposals: Free 3%, Growth 1.5%, Insights 0.5%.
        SmartStack is not submitting billing events or charging merchants during this pilot.
        Order data must be reconciled before any future usage billing.
      </p>
    </div>
  </s-page>;
}
