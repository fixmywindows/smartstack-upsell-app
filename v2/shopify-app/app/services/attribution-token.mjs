import {createHmac,timingSafeEqual,createHash} from "node:crypto";

const ID=/^gid:\/\/shopify\/Product\/[0-9]+$/;
const KINDS=new Set(["similar","complement","bought_together","bundle"]);
const TTL=7*24*60*60*1000;
function sign(secret,data){
  return createHmac("sha256",secret).update("smartstack-attribution-v1:"+data).digest("base64url");
}
function validateClaim(c){
  return c&&c.v===1&&typeof c.shop==="string"&&c.shop.endsWith(".myshopify.com")&&
    KINDS.has(c.kind)&&ID.test(c.source)&&ID.test(c.product)&&
    typeof c.set==="string"&&c.set.length<=120 &&
    (c.group===null||Number.isInteger(c.group)&&c.group>=0&&c.group<20)&&
    Number.isInteger(c.issued)&&Number.isInteger(c.expires)&&
    c.expires-c.issued===TTL;
}
export function issueAttributionToken(secret,claim,now=Date.now()){
  if(typeof secret!=="string"||secret.length<16)throw Error("A stable signing secret is required");
  const data={v:1,shop:claim.shop,kind:claim.kind,
    source:claim.source,product:claim.product,set:claim.set,
    group:claim.group??null,issued:now,expires:now+TTL};
  if(!validateClaim(data))throw Error("Invalid SmartStack attribution claim");
  const encoded=Buffer.from(JSON.stringify(data)).toString("base64url");
  return "ss1."+encoded+"."+sign(secret,encoded);
}
export function verifyAttributionToken(secret,shop,token,at=Date.now()){
  if(typeof secret!=="string"||secret.length<16||
    typeof token!=="string"||token.length>1000||token.length<45)return null;
  const parts=token.split(".");
  if(parts.length!==3||parts[0]!=="ss1"||!/^[A-Za-z0-9_-]+$/.test(parts[1]))return null;
  const expected=Buffer.from(sign(secret,parts[1]));
  const actual=Buffer.from(parts[2]);
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
  try{
    const c=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
    if(!validateClaim(c)||c.shop!==shop||at<c.issued-300000||at>c.expires)return null;
    return c;
  }catch{return null;}
}
export const attributionHash=token=>createHash("sha256").update(token).digest("hex");
export const COMMISSION_BPS=Object.freeze({free:300,growth:150,insights:50});
export function estimateCommission(revenueMinor,plan){
  const bps=COMMISSION_BPS[plan]??COMMISSION_BPS.free;
  if(!Number.isInteger(revenueMinor)||revenueMinor<0)throw Error("Invalid net revenue amount");
  return {bps,amountMinor:Math.round(revenueMinor*bps/10000)};
}
