import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { FACET_KINDS, listAttributeChoices, type FacetKind } from "../services/attribute-facets.server";

/** A shop-authenticated searchable option endpoint for IF and THEN rules. */
export const loader=async({request}:LoaderFunctionArgs)=>{
  const {session}=await authenticate.admin(request);
  const uri=new URL(request.url);
  const kind=uri.searchParams.get("kind")||"";
  const key=(uri.searchParams.get("key")||"").slice(0,100);
  const q=(uri.searchParams.get("q")||"").trim().slice(0,80);
  if(!FACET_KINDS.includes(kind as FacetKind)){
    return Response.json({error:"Choose a supported attribute",options:[]},{status:400});
  }
  try{
    const options=await listAttributeChoices(session.shop,kind as FacetKind,q,key);
    return Response.json({kind,options,source:"synced_catalogue"},
      {headers:{"Cache-Control":"private,no-store"}});
  }catch(error){
    console.error("SmartStack attribute choices error",{
      shop:session.shop,kind,error:error instanceof Error?error.message:"unknown"
    });
    return Response.json({error:"Couldn't load catalogue choices",options:[]},{status:503});
  }
};
