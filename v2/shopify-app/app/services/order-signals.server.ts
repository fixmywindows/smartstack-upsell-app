import { createHmac } from "node:crypto";
import db from "../db.server";
// @ts-ignore — pure JS signal logic is covered by independent Node tests.
import { diffOrderPairs, eligibleOrderProducts, observedPairMap } from "./co-purchases.mjs";
import { ensureShop } from "./catalogue.server";

type Admin={graphql:(q:string,options?:{variables?:Record<string,unknown>})=>Promise<Response>};
export type Scopes={scope:string|null};
type OrderNode={
  id:string;createdAt:string;cancelledAt:string|null;fullyPaid:boolean;test:boolean;
  lineItems:{pageInfo:{hasNextPage:boolean};
    nodes:Array<{currentQuantity:number;product:{id:string}|null;variant:{id:string}|null}>};
};
type OrdersResponse={
  data?:{orders?:{pageInfo:{hasNextPage:boolean;endCursor:string|null};nodes:OrderNode[]}};
  errors?:Array<{message:string}>;
};

const ORDERS_QUERY=String.raw`#graphql
query SmartStackOrders($after: String, $query: String) {
  orders(first: 20, after: $after, query: $query) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id createdAt cancelledAt fullyPaid test
      lineItems(first: 100) {
        pageInfo { hasNextPage }
        nodes { currentQuantity product { id } variant { id } }
      }
    }
  }
}
`;

/** Shopify read_orders is opt-in. Never request it silently or claim consent. */
export function hasOrderScope(scope:string|null):boolean {
  return (scope||"").split(",").map(s=>s.trim()).includes("read_orders");
}
function orderKey(domain:string,id:string):string {
  const secret=process.env.SMARTSTACK_ORDER_HASH_SECRET||process.env.SHOPIFY_API_SECRET;
  if(!secret)throw new Error("Order identity hashing secret is missing");
  return createHmac("sha256",secret).update(domain+"|"+id).digest("hex");
}
type Paired=[string,string];
type Tx=Parameters<Parameters<typeof db.$transaction>[0]>[0]; // compatible transaction callback type

/**
 * Idempotent order refresh. Diff the old and new distinct product pairs in one
 * serialisable transaction. No customer details, raw order IDs, or line data
 * are persisted. Cancelled, test, refunded-to-zero and unpaid orders contribute zero.
 */
export async function updateOrderObservation(shopDomain:string,order:OrderNode) {
  if(!/^gid:\/\/shopify\/Order\/[0-9]+$/.test(order.id))return false;
  const after=eligibleOrderProducts(order) as string[];
  const key=orderKey(shopDomain,order.id);
  const placedAt=new Date(order.createdAt);
  if(!Number.isFinite(placedAt.getTime()))return false;
  return db.$transaction(async tx=>{
    const old=await tx.orderPairObservation.findUnique({
      where:{shopDomain_orderKey:{shopDomain,orderKey:key}}
    });
    const before=Array.isArray(old?.productIds)?
      old.productIds.filter((id):id is string=>typeof id==="string"):[];
    const {remove,add}=diffOrderPairs(before,after) as {remove:Paired[];add:Paired[]};
    for(const [productA,productB] of remove){
      await tx.observedProductPair.updateMany({
        where:{shopDomain,productA,productB,orderCount:{gt:0}},
        data:{orderCount:{decrement:1}}
      });
    }
    for(const [productA,productB] of add){
      await tx.observedProductPair.upsert({
        where:{shopDomain_productA_productB:{shopDomain,productA,productB}},
        update:{orderCount:{increment:1}},
        create:{shopDomain,productA,productB,orderCount:1}
      });
    }
    if(after.length>=2){
      await tx.orderPairObservation.upsert({
        where:{shopDomain_orderKey:{shopDomain,orderKey:key}},
        create:{shopDomain,orderKey:key,productIds:after,placedAt},
        update:{productIds:after,placedAt}
      });
    }else if(old){
      await tx.orderPairObservation.delete({
        where:{shopDomain_orderKey:{shopDomain,orderKey:key}}
      });
    }
    return add.length>0||remove.length>0;
  },{isolationLevel:"Serializable"});
}

/** 60-day retention. Decrement old contributions as they expire. */
export async function pruneOldObservations(shopDomain:string,cutoff:Date) {
  const stale=await db.orderPairObservation.findMany({
    where:{shopDomain,placedAt:{lt:cutoff}},take:100
  });
  for(const observation of stale){
    await db.$transaction(async tx=>{
      const current=await tx.orderPairObservation.findUnique({
        where:{shopDomain_orderKey:{shopDomain,orderKey:observation.orderKey}}
      });
      if(!current||current.placedAt>=cutoff)return;
      const ids=Array.isArray(current.productIds)?
        current.productIds.filter((x):x is string=>typeof x==="string"):[];
      const {remove}=diffOrderPairs(ids,[]) as {remove:Paired[]};
      for(const [productA,productB] of remove){
        await tx.observedProductPair.updateMany({
          where:{shopDomain,productA,productB,orderCount:{gt:0}},
          data:{orderCount:{decrement:1}}
        });
      }
      await tx.orderPairObservation.delete({
        where:{shopDomain_orderKey:{shopDomain,orderKey:current.orderKey}}
      });
    },{isolationLevel:"Serializable"});
  }
}

export async function syncRecentOrderSignals(
  admin:Admin,shopDomain:string,scope:string|null
) {
  if(!hasOrderScope(scope)){
    return {authorized:false,added:0,scanned:0,finished:false,
      message:"Order evidence requires merchant-approved read_orders access."};
  }
  await ensureShop(shopDomain);
  const state=await db.orderSyncState.findUnique({where:{shopDomain}});
  const after=state?.finished?null:state?.cursor||null;
  const since=new Date(Date.now()-60*24*60*60*1000);
  const query="created_at:>="+since.toISOString().slice(0,10);
  const resp=await admin.graphql(ORDERS_QUERY,{variables:{after,query}});
  if(!resp.ok)throw new Error("Shopify orders query returned HTTP "+resp.status);
  const data=await resp.json() as OrdersResponse;
  if(data.errors?.length||!data.data?.orders)throw new Error("Shopify did not return authorised orders");
  const {nodes,pageInfo}=data.data.orders;
  let changed=0;
  for(const order of nodes){
    if(await updateOrderObservation(shopDomain,order))changed++;
  }
  const finished=!pageInfo.hasNextPage;
  if(finished)await pruneOldObservations(shopDomain,since);
  const observed=await db.orderPairObservation.count({where:{shopDomain}});
  await db.orderSyncState.upsert({
    where:{shopDomain},
    create:{shopDomain,cursor:finished?null:pageInfo.endCursor,
      finished,scanned:nodes.length,observed},
    update:{cursor:finished?null:pageInfo.endCursor,finished,
      scanned:state?.finished?nodes.length:(state?.scanned||0)+nodes.length,observed}
  });
  return {authorized:true,added:changed,scanned:nodes.length,finished,observed,
    message:observed?"Verified order associations are available for ranking.":
      "No qualifying paid non-test orders with multiple products were found yet."};
}

/** Only two+ independent qualifying orders count as observed co-purchases. */
export async function getObservedPairs(shopDomain:string,sourceId:string){
  const rows=await db.observedProductPair.findMany({
    where:{shopDomain,orderCount:{gte:2},OR:[{productA:sourceId},{productB:sourceId}]},
    orderBy:{orderCount:"desc"},take:100,
    select:{productA:true,productB:true,orderCount:true}
  });
  const counts=observedPairMap(sourceId,rows) as Record<string,number>;
  return {[sourceId]:counts};
}
