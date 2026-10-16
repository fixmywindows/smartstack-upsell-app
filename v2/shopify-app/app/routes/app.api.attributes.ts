import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { FACET_KINDS, listAttributeChoices, type FacetKind, type FacetOption } from "../services/attribute-facets.server";

type AdminClient={graphql:(query:string,options?:{variables?:Record<string,unknown>})=>Promise<Response>};
type CollectionsResult={data?:{collections?:{
  nodes:Array<{id:string;handle:string;title:string}>;
  pageInfo:{hasNextPage:boolean;endCursor:string|null};
}};errors?:Array<{message:string}>};

/** Real Shopify collections, including empty collections not yet in the cache. */
async function listShopifyCollections(admin:AdminClient,search:string):Promise<FacetOption[]>{
  const query = String.raw`#graphql
    query SmartStackCollections($after: String) {
      collections(first: 250, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { id handle title }
      }
    }
  `;
  let after:string|null=null;
  const result=new Map<string,FacetOption>();
  for(let page=0;page<8;page++){
    const response=await admin.graphql(query,{variables:{after}});
    if(!response.ok)throw new Error("Shopify collections API returned "+response.status);
    const payload=await response.json() as CollectionsResult;
    if(payload.errors?.length||!payload.data?.collections)throw new Error("Unable to read Shopify collections");
    for(const collection of payload.data.collections.nodes){
      if(typeof collection.handle!=="string"||typeof collection.title!=="string")continue;
      if(search && !(collection.handle.toLowerCase().includes(search.toLowerCase())||
        collection.title.toLowerCase().includes(search.toLowerCase())))continue;
      result.set(collection.handle,{value:collection.handle,label:collection.title,count:0});
    }
    if(result.size>=65||!payload.data.collections.pageInfo.hasNextPage)break;
    after=payload.data.collections.pageInfo.endCursor;
    if(!after)break;
  }
  return [...result.values()].sort((a,b)=>a.label.localeCompare(b.label)).slice(0,65);
}

/** Shop-authenticated searchable options for IF and THEN conditions. */
export const loader=async({request}:LoaderFunctionArgs)=>{
  const {session,admin}=await authenticate.admin(request);
  const uri=new URL(request.url);
  const kind=uri.searchParams.get("kind")||"";
  const key=(uri.searchParams.get("key")||"").slice(0,100);
  const q=(uri.searchParams.get("q")||"").trim().slice(0,80);
  if(!FACET_KINDS.includes(kind as FacetKind)){
    return Response.json({error:"Choose a supported attribute",options:[]},{status:400});
  }
  try{
    if(kind==="collections"){
      try{
        const fromShopify=await listShopifyCollections(admin,q);
        return Response.json({kind,options:fromShopify,source:"shopify_collections"},
          {headers:{"Cache-Control":"private,no-store"}});
      }catch(error){
        // A transient scope/API failure must not make the rule editor unusable.
        console.warn("SmartStack collections live lookup unavailable; using cached handles",
          error instanceof Error?error.message:"unknown");
      }
    }
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
