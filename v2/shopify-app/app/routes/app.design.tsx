import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../services/catalogue.server";
import { validPlan } from "../utils/plan-limits";
import {
  DESIGN_KINDS, defaultDesign, normaliseDesign, presets, isAdvancedDesign,
  canSaveDesign, type DesignKind, type DesignPreset, type DesignSettings,
} from "../utils/design-settings";

const types=[
  {id:"similar",title:"Similar products"},
  {id:"complement",title:"Complementary"},
  {id:"bought_together",title:"Bought together"},
  {id:"bundle",title:"Complete the set"}
] as const;
const surface:React.CSSProperties={background:"#fff",border:"1px solid #e0e4ea",borderRadius:12,padding:17};
const label:React.CSSProperties={display:"grid",gap:6,fontSize:13,fontWeight:600};
const small:React.CSSProperties={fontSize:13,color:"#646d7a",lineHeight:1.55};
const control:React.CSSProperties={width:"100%",minHeight:39,padding:"7px 10px",border:"1px solid #cbd0da",borderRadius:8,background:"#fff",color:"#25252c",boxSizing:"border-box"};
const actionButton:React.CSSProperties={padding:"9px 14px",border:"1px solid #cbd0da",background:"#fff",color:"#24252b",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:8};

export const loader=async({request}:LoaderFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  const shop=await ensureShop(session.shop);
  const requested=new URL(request.url).searchParams.get("kind")||"similar";
  const kind=DESIGN_KINDS.includes(requested as DesignKind)?requested as DesignKind:"similar";
  const [saved,products]=await Promise.all([
    db.recommendationDesign.findUnique({where:{shopDomain_kind:{shopDomain:session.shop,kind}}}),
    db.productSnapshot.findMany({where:{shopDomain:session.shop,published:true},
      orderBy:{title:"asc"},take:5,
      select:{productId:true,title:true,vendor:true,imageUrl:true,priceMinor:true,currencyCode:true,available:true}})
  ]);
  return {kind,settings:normaliseDesign(kind,saved?.settings),
    products,plan:validPlan(shop.plan),saved:!!saved};
};

export const action=async({request}:ActionFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  const form=await request.formData();
  const kind=String(form.get("kind")||"");
  if(!DESIGN_KINDS.includes(kind as DesignKind))return Response.json({error:"Invalid recommendation type"},{status:400});
  const raw=String(form.get("settings")||"");
  if(raw.length>8000)return Response.json({error:"Invalid configuration length"},{status:400});
  let value:unknown;
  try{value=JSON.parse(raw);}catch{return Response.json({error:"Invalid design configuration"},{status:400});}
  const shop=await ensureShop(session.shop);
  const settings=normaliseDesign(kind as DesignKind,value);
  if(!canSaveDesign(validPlan(shop.plan),settings,kind as DesignKind))return Response.json({
    error:"Advanced design controls are reserved for Growth and Insights. Choose Match my store or Minimal to save on Free."
  },{status:403});
  await db.recommendationDesign.upsert({
    where:{shopDomain_kind:{shopDomain:session.shop,kind}},
    create:{shopDomain:session.shop,kind,settings},
    update:{settings}
  });
  return Response.json({saved:true});
};

export default function DesignStudio(){
  const data=useLoaderData<typeof loader>();
  const status=useActionData<{saved?:boolean;error?:string}>();
  const nav=useNavigation();
  const [design,setDesign]=useState<DesignSettings>(data.settings);
  const [device,setDevice]=useState<"desktop"|"mobile">("desktop");
  const [advanced,setAdvanced]=useState(false);
  useEffect(()=>{setDesign(data.settings);setAdvanced(false);},[data.kind,data.settings]);
  const set=<K extends keyof DesignSettings>(key:K,value:DesignSettings[K])=>setDesign(prev=>({...prev,[key]:value}));
  const fullAccess=data.plan!=="free";
  const restricted=isAdvancedDesign(design,data.kind)&&!fullAccess;
  const shown=data.products.filter(p=>p.available).slice(0,4);
  const money=(value:number,currency:string)=>new Intl.NumberFormat("en-GB",{style:"currency",currency}).format(value/100);
  const options=(field:keyof DesignSettings,title:string,items:Array<[string,string]>)=>
    <label style={label}>{title}
      <select style={control} value={String(design[field])} onChange={e=>set(field,e.target.value as never)}>
        {items.map(([id,name])=><option key={id} value={id}>{name}</option>)}
      </select>
    </label>;
  const toggle=(field:keyof DesignSettings,text:string)=>
    <label style={{display:"flex",alignItems:"center",gap:9,fontSize:13}}>
      <input type="checkbox" checked={Boolean(design[field])}
        onChange={e=>set(field,e.target.checked as never)}/>{text}
    </label>;
  const width=device==="mobile"?330:850;
  const columns=device==="mobile"?design.mobileColumns:
    (design.preset==="theme"?4:design.desktopColumns);
  const imageRatio=design.imageRatio==="portrait"?"4 / 5":design.imageRatio==="landscape"?"4 / 3":"1 / 1";
  const compact=design.layout==="compact" &&
    !(design.preset==="theme" && device==="desktop");
  const cardStyle:React.CSSProperties={
    minWidth:0,display:"flex",flexDirection:compact?"row":"column",
    background:design.cardStyle==="soft"?"#f8f8f9":"white",
    border:design.cardStyle==="minimal"?"0":"1px solid #e3e5eb",
    borderRadius:design.cardRadius,overflow:"hidden"
  };
  return <s-page heading="Design Studio">
    <s-section heading="Make recommendations feel native to your store">
      <p style={{...small,maxWidth:750}}>
        Set a default design for each of SmartStack's four recommendation types.
        The storefront can automatically inherit the theme's typography and Add to Basket button styles.
      </p>
      <nav aria-label="Design each recommendation type" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:9}}>
        {types.map(t=><Link key={t.id} to={"/app/design?kind="+t.id} aria-current={t.id===data.kind?"page":undefined}
          style={{...surface,color:"#25252a",fontSize:13,fontWeight:650,textDecoration:"none",padding:13,
            border:t.id===data.kind?"2px solid #24252a":"1px solid #e0e4ea",
            background:t.id===data.kind?"#f4f5f7":"#fff"}}>
          {t.title}
        </Link>)}
      </nav>
    </s-section>
    <s-section heading="Design editor">
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,355px),1fr))",gap:18,alignItems:"start"}}>
        <div style={{display:"grid",gap:14}}>
          <div style={surface}>
            <strong>1. Choose a preset</strong>
            <div style={{display:"grid",gap:8,marginTop:13}}>
              {presets.map(p=><button key={p.id} type="button"
                onClick={()=>setDesign(defaultDesign(data.kind,p.id as DesignPreset))}
                style={{...actionButton,textAlign:"left",padding:12,
                  border:design.preset===p.id?"2px solid #24252a":"1px solid #e0e4ea",
                  background:design.preset===p.id?"#f5f6f8":"white"}}>
                <span style={{display:"flex",justifyContent:"space-between",gap:8}}>
                  <strong>{p.title}</strong>
                  {p.id!=="theme"&&p.id!=="minimal"&&<small style={small}>Growth+</small>}
                </span>
                <span style={{...small,display:"block",fontSize:12,marginTop:4}}>{p.description}</span>
              </button>)}
            </div>
          </div>
          <div style={{...surface,display:"grid",gap:15}}>
            <strong>2. Layout and product details</strong>
            {options("layout","How to display products",[
              ["grid","Responsive grid"],["carousel","Swipeable carousel"],["compact","Compact vertical list"]])}
            {toggle("showHeading","Show block heading")}
            {toggle("showPrice","Show product prices")}
            {toggle("showVendor","Show brand / vendor")}
            {toggle("showQuickAdd","Display Add to Basket buttons")}
          </div>
          <div style={surface}>
            <button type="button" style={{...actionButton,width:"100%",display:"flex",justifyContent:"space-between"}}
              onClick={()=>setAdvanced(!advanced)}>
              <span>3. Advanced customisation {fullAccess?"":"· Growth+"}</span><span>{advanced?"−":"+"}</span>
            </button>
            {advanced&&<div style={{display:"grid",gap:14,marginTop:15}}>
              {options("cardStyle","Card appearance",[["minimal","Borderless"],["bordered","Outlined"],["soft","Soft background"]])}
              {options("imageRatio","Image proportion",[["square","1:1 square"],["portrait","4:5 portrait"],["landscape","4:3 landscape"]])}
              {options("imageFit","Image fit",[["contain","Contain — no cropping"],["cover","Cover — fill image"]])}
              {options("buttonStyle","Button styling",[["match","Match store button"],["solid","Solid"],["outline","Outline"],["text","Text link"]])}
              {options("headingAlign","Heading alignment",[["left","Left"],["center","Centre"]])}
              {data.kind==="bundle"&&options("bundleLayout","Bundle arrangement",[["list","Compact list"],["cards","Image-led cards"]])}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                {[["desktopColumns","Desktop columns",2,4],["mobileColumns","Mobile columns",1,2],
                  ["cardGap","Card spacing",8,32],["cardRadius","Corner radius",0,24]].map(([key,name,min,max])=>
                  <label key={key} style={label}>{name}
                    <input type="number" min={Number(min)} max={Number(max)} step={key==="cardGap"||key==="cardRadius"?2:1}
                      value={Number(design[key as keyof DesignSettings])} style={control}
                      onChange={e=>set(key as keyof DesignSettings,Number(e.target.value) as never)}/>
                  </label>)}
              </div>
              <label style={label}>Custom button colour
                <input type="color" aria-label="Button colour" style={{width:90,height:40}}
                  value={design.buttonColor||"#24252a"} onChange={e=>set("buttonColor",e.target.value)}/>
              </label>
              {design.buttonColor&&<button type="button" onClick={()=>set("buttonColor","")} style={actionButton}>
                Restore automatic theme colour
              </button>}
            </div>}
          </div>
          <Form method="post" style={surface}>
            <input type="hidden" name="kind" value={data.kind}/>
            <input type="hidden" name="settings" value={JSON.stringify(design)}/>
            {status?.error&&<p role="alert" style={{...small,color:"#a02825"}}>{status.error}</p>}
            {status?.saved&&<p role="status" style={{...small,color:"#206e42"}}>Design saved. Refresh the Shopify theme preview to see it.</p>}
            {restricted&&<p style={{...small,color:"#97551c"}}>Advanced settings are preview-only on Free. Growth and Insights can save these settings.</p>}
            <button type="submit" disabled={restricted||nav.state!=="idle"}
              style={{...actionButton,width:"100%",border:0,background:restricted?"#e6e8ec":"#24252a",
                color:restricted?"#707782":"white"}}>
              {nav.state==="idle"?"Save design":"Saving…"}
            </button>
            <p style={{...small,marginBottom:0,fontSize:12}}>Changes apply to Shopify widgets using Design Studio defaults.</p>
          </Form>
        </div>
        <div style={{...surface,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div><strong>Responsive preview</strong>
              <div style={{...small,fontSize:12}}>Real products from your synced catalogue</div>
            </div>
            <div style={{display:"flex",gap:7}}>
              {(["desktop","mobile"] as const).map(d=><button key={d} type="button" onClick={()=>setDevice(d)}
                style={{...actionButton,padding:"7px 12px",background:device===d?"#24252a":"white",
                  color:device===d?"white":"#24252a"}}>{d==="desktop"?"Desktop":"Mobile"}</button>)}
            </div>
          </div>
          <div style={{marginTop:16,padding:15,borderRadius:11,background:"#f0f1f4",overflowX:"auto"}}>
            <div style={{maxWidth:width,width:"100%",padding:device==="mobile"?12:22,
              background:"#fff",borderRadius:8,margin:"0 auto",boxSizing:"border-box"}}>
              {design.showHeading&&<h3 style={{margin:"0 0 17px",fontSize:device==="mobile"?18:22,
                fontWeight:650,textAlign:design.headingAlign}}>{types.find(t=>t.id===data.kind)?.title}</h3>}
              {shown.length===0?<p style={small}>Sync some published products to see examples here.</p>:
                data.kind==="bundle" ? <div style={{border:"1px solid #e1e4e9",borderRadius:design.cardRadius,padding:14}}>
                  <div style={{display:"grid",gap:9,gridTemplateColumns:design.bundleLayout==="cards"?
                    "repeat("+Math.min(shown.length,device==="mobile"?2:4)+",minmax(0,1fr))":"1fr"}}>
                    {shown.map((p,index)=><div key={p.productId}
                      style={{display:"grid",gridTemplateColumns:design.bundleLayout==="cards"?
                        "18px minmax(0,1fr)":"18px 46px minmax(0,1fr) auto",
                        alignItems:"center",gap:9,borderBottom:design.bundleLayout==="cards"?"none":"1px solid #eef0f2",
                        borderRadius:8,paddingBottom:8,minWidth:0}}>
                      <input type="checkbox" defaultChecked disabled={index===0} aria-label={"Include "+p.title}/>
                      {p.imageUrl?<img src={p.imageUrl} alt="" style={{height:design.bundleLayout==="cards"?100:46,
                        width:design.bundleLayout==="cards"?"100%":46,objectFit:design.imageFit,
                        gridColumn:design.bundleLayout==="cards"?"1 / -1":undefined}}/>:
                        <div style={{height:46,width:46,background:"#f3f3f5"}}/>}
                      <div style={{minWidth:0,fontSize:11,gridColumn:design.bundleLayout==="cards"?"1 / -1":undefined}}>
                        <div style={{fontWeight:650,overflowWrap:"anywhere"}}>{p.title}</div>
                        {index===0&&<span style={{...small,fontSize:10}}>Current product</span>}
                      </div>
                      <strong style={{fontSize:11,gridColumn:design.bundleLayout==="cards"?"1 / -1":undefined}}>{new Intl.NumberFormat("en-GB",
                        {style:"currency",currency:p.currencyCode}).format(p.priceMinor/100)}</strong>
                    </div>)}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:14,fontSize:13}}>
                    <span>Set total</span>
                    <strong>{new Intl.NumberFormat("en-GB",{style:"currency",currency:shown[0].currencyCode})
                      .format(shown.reduce((sum,p)=>sum+p.priceMinor,0)/100)}</strong>
                  </div>
                  <div style={{marginTop:12,background:"#24252a",color:"#fff",fontSize:12,textAlign:"center",
                    padding:"10px 14px",borderRadius:Math.min(design.cardRadius,9)}}>Add selected set to basket</div>
                </div> :
                <div style={{display:"grid",gridTemplateColumns:compact?"1fr":
                  "repeat("+Math.min(columns,shown.length)+", minmax(0,1fr))",gap:design.cardGap}}>
                  {shown.slice(0,compact?3:4).map(p=><div key={p.productId} style={cardStyle}>
                    <div style={{width:compact?86:"100%",aspectRatio:compact?"1 / 1":imageRatio,
                      flexShrink:0,background:"#f7f7f8"}}>
                      {p.imageUrl&&<img src={p.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:design.imageFit}}/>}
                    </div>
                    <div style={{padding:11,display:"flex",flexDirection:"column",gap:6,minWidth:0,flex:1}}>
                      {design.showVendor&&<span style={{...small,fontSize:10}}>{p.vendor}</span>}
                      <span style={{fontSize:14,fontWeight:600,overflowWrap:"anywhere"}}>{p.title}</span>
                      {design.showPrice&&<strong style={{fontSize:14}}>
                        {new Intl.NumberFormat("en-GB",{style:"currency",currency:p.currencyCode}).format(p.priceMinor/100)}
                      </strong>}
                      {design.showQuickAdd&&<div style={{marginTop:"auto",textAlign:"center",fontSize:11,
                        background:design.buttonStyle==="outline"||design.buttonStyle==="text"?"transparent":
                          design.buttonColor||"#24252a",
                        color:design.buttonStyle==="outline"||design.buttonStyle==="text"?"#24252a":"#fff",
                        padding:"9px 7px",borderRadius:Math.min(design.cardRadius,9),
                        border:design.buttonStyle==="outline"?"1px solid #24252a":"1px solid transparent"}}>
                        Add to basket
                      </div>}
                    </div>
                  </div>)}
                </div>}
            </div>
          </div>
          <p style={{...small,fontSize:12}}>This is an approximate layout preview. On your actual store,
            Match my store uses real theme typography, colours and button treatments. Always check the Shopify theme editor.</p>
          <div style={{borderTop:"1px solid #e6e9ee",paddingTop:13,marginTop:14}}>
            <strong style={{fontSize:13}}>Where these settings appear</strong>
            <p style={{...small,marginBottom:0}}>Saved defaults apply to all SmartStack blocks of this type
              set to Design Studio defaults. They don't change your theme or product data.</p>
          </div>
        </div>
      </div>
    </s-section>
  </s-page>;
}
