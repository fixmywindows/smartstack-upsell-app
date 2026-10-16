import type {ActionFunctionArgs} from "react-router";
import {authenticate} from "../shopify.server";
import db from "../db.server";
// @ts-ignore — tested HMAC helpers.
import {verifyAttributionToken,attributionHash} from "../services/attribution-token.mjs";

const EVENTS=new Set(["render","view","click","add"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Aggregate behavioural events without cookies, IPs or customer identifiers. */
export const action=async({request}:ActionFunctionArgs)=>{
  const {session}=await authenticate.public.appProxy(request);
  if(!session?.shop)return Response.json({error:"App not installed"},{status:403});
  if(request.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
  const text=await request.text();
  if(text.length>1800)return Response.json({error:"Invalid event"},{status:400});
  let body:Record<string,unknown>;
  try{body=JSON.parse(text);}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  if(body.consented!==true||!EVENTS.has(String(body.type))||
     !UUID.test(String(body.eventId||""))){
    return Response.json({error:"Invalid analytics event"},{status:400});
  }
  const secret=process.env.SHOPIFY_API_SECRET||"";
  const claim=verifyAttributionToken(secret,session.shop,body.trackingRef);
  if(!claim)return Response.json({error:"Invalid signed product reference"},{status:400});
  const tokenHash=attributionHash(String(body.trackingRef));
  const since=new Date(Date.now()-60*60*1000);
  // This is an abuse-control ceiling, not unique-shopper/session identification.
  const count=await db.recommendationEvent.count({
    where:{shopDomain:session.shop,tokenHash,occurredAt:{gte:since}}
  });
  if(count>=40)return Response.json({accepted:false,reason:"rate-limited"},{status:429});
  try{
    await db.recommendationEvent.create({
      data:{
        shopDomain:session.shop,eventId:String(body.eventId),
        tokenHash,kind:claim.kind,type:String(body.type),
        sourceProductId:claim.source,productId:claim.product,
        setId:claim.set,groupIndex:claim.group,
      }
    });
    return Response.json({accepted:true},{headers:{"Cache-Control":"private,no-store"}});
  }catch(error){
    // A repeated browser event must never inflate a metric.
    if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2002"){
      return Response.json({accepted:false,reason:"duplicate"});
    }
    console.error("SmartStack event write failed");
    return Response.json({error:"Event not recorded"},{status:503});
  }
};
