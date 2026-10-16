import db from "../db.server";
import {Prisma} from "@prisma/client";
import {validPlan} from "../utils/plan-limits";
import {hasOrderScope} from "./order-signals.server";

const percent=(num:number,den:number)=>den>0?Math.round(num/den*10000)/100:0;
export const formatMoney=(minor:number,code:string)=>{
  try{
    const formatter=new Intl.NumberFormat("en-GB",{style:"currency",currency:code});
    return formatter.format(minor/10**(formatter.resolvedOptions().maximumFractionDigits??2));
  }catch{return String(minor);}
};
export async function analyticsReport(shopDomain:string,scope:string|null|undefined,url:URL){
  const shop=await db.merchantShop.findUniqueOrThrow({
    where:{domain:shopDomain},select:{plan:true}
  });
  const plan=validPlan(shop.plan),paid=plan!=="free";
  const syncState=await db.orderSyncState.findUnique({
    where:{shopDomain},select:{scanned:true,finished:true,updatedAt:true}
  });
  const orderConnected=hasOrderScope(scope) && syncState!==null;
  const kindValue=url.searchParams.get("kind")||"all";
  const selectedKind=["similar","complement","bought_together","bundle"].includes(kindValue)?
    kindValue:"all";
  const kindFilter=selectedKind==="all"?{}:{kind:selectedKind};
  const value=Number(url.searchParams.get("days"));
  const days=[7,30,90].includes(value)?value:30;
  const to=new Date(),from=new Date(to.getTime()-days*86400000);
  const eventWhere={shopDomain,...kindFilter,occurredAt:{gte:from,lte:to}};
  const purchaseWhere={shopDomain,...kindFilter,purchasedAt:{gte:from,lte:to}};
  const [events,totals]=await Promise.all([
    db.recommendationEvent.groupBy({
      by:["type"],where:eventWhere,_count:{_all:true}
    }),
    db.recommendationPurchase.groupBy({
      by:["currencyCode"],where:purchaseWhere,
      _sum:{quantity:true,netRevenueMinor:true,estimatedCommissionMinor:true},
      _count:{_all:true}
    }),
  ]);
  const types=Object.fromEntries(events.map(row=>[row.type,row._count._all]));
  const cards=totals.map(row=>({
    currencyCode:row.currencyCode,units:row._sum.quantity||0,
    revenueMinor:row._sum.netRevenueMinor||0,
    estimatedCommissionMinor:row._sum.estimatedCommissionMinor||0,
    purchaseLines:row._count._all
  }));
  const summary={
    renders:types.render||0,views:types.view||0,clicks:types.click||0,adds:types.add||0,
    units:cards.reduce((n,x)=>n+x.units,0),
    lines:cards.reduce((n,x)=>n+x.purchaseLines,0),
    viewRate:percent(types.view||0,types.render||0),
    ctr:percent(types.click||0,types.view||0),
    addRate:percent(types.add||0,types.view||0),
    purchaseToViewRatio:percent(cards.reduce((n,x)=>n+x.purchaseLines,0),types.view||0),
    currencies:cards,
  };
  if(!paid)return {plan,paid:false,orderConnected,days,selectedKind,summary,advanced:null};
  // Aggregate by day inside PostgreSQL (not by downloading individual events).
  const [dailyEvents,dailySales,topSold,views,clicks,bundleSales,pairs]=await Promise.all([
    db.$queryRaw<Array<{day:Date;type:string;count:bigint}>>(Prisma.sql`
      SELECT date_trunc('day',"occurredAt") AS day,"type",COUNT(*)::bigint AS count
      FROM "RecommendationEvent"
      WHERE "shopDomain"=${shopDomain} AND "occurredAt">=${from} AND "occurredAt"<=${to} AND (${selectedKind}='all' OR "kind"=${selectedKind})
      GROUP BY 1,2 ORDER BY 1
    `),
    db.$queryRaw<Array<{day:Date;currencyCode:string;quantity:bigint;revenue:bigint}>>(Prisma.sql`
      SELECT date_trunc('day',"purchasedAt") AS day,"currencyCode",
        SUM("quantity")::bigint AS quantity,SUM("netRevenueMinor")::bigint AS revenue
      FROM "RecommendationPurchase"
      WHERE "shopDomain"=${shopDomain} AND "purchasedAt">=${from} AND "purchasedAt"<=${to} AND (${selectedKind}='all' OR "kind"=${selectedKind})
      GROUP BY 1,2 ORDER BY 1
    `),
    db.recommendationPurchase.groupBy({
      by:["productId","kind","currencyCode"],where:purchaseWhere,
      _sum:{quantity:true,netRevenueMinor:true},orderBy:{_sum:{netRevenueMinor:"desc"}},take:20
    }),
    db.recommendationEvent.groupBy({
      by:["productId","kind","setId"],where:{...eventWhere,type:"view"},
      _count:{_all:true},orderBy:{_count:{productId:"desc"}},take:200
    }),
    db.recommendationEvent.groupBy({
      by:["productId","kind","setId"],where:{...eventWhere,type:"click"},
      _count:{_all:true},orderBy:{_count:{productId:"desc"}},take:300
    }),
    db.recommendationPurchase.groupBy({
      by:["setId","currencyCode"],where:{...purchaseWhere,kind:"bundle"},
      _sum:{quantity:true,netRevenueMinor:true},orderBy:{_sum:{quantity:"desc"}},take:12
    }),
    db.observedProductPair.findMany({
      where:{shopDomain,orderCount:{gte:2}},
      orderBy:{orderCount:"desc"},take:150,
      select:{productA:true,productB:true,orderCount:true}
    })
  ]);
  const ids=[...new Set([
    ...topSold.map(x=>x.productId),...views.map(x=>x.productId),
    ...pairs.flatMap(x=>[x.productA,x.productB])
  ])];
  const products=await db.productSnapshot.findMany({
    where:{shopDomain,productId:{in:ids}},
    select:{productId:true,title:true,category:true,tags:true,imageUrl:true}
  });
  const productMap=new Map(products.map(p=>[p.productId,p]));
  const setIds=[...new Set(bundleSales.map(x=>x.setId))];
  const setNames=await db.recommendationRuleSet.findMany({
    where:{shopDomain,id:{in:setIds}},select:{id:true,name:true}
  });
  const nameMap=new Map(setNames.map(x=>[x.id,x.name]));
  const selectedCurrency=url.searchParams.get("currency")||cards[0]?.currencyCode||"GBP";
  const byDay=new Map<string,{date:string;views:number;clicks:number;adds:number;units:number;revenueMinor:number}>();
  const getDay=(date:Date)=>{
    const key=new Date(date).toISOString().slice(0,10);
    if(!byDay.has(key))byDay.set(key,{date:key,views:0,clicks:0,adds:0,units:0,revenueMinor:0});
    return byDay.get(key)!;
  };
  for(const e of dailyEvents){
    const record=getDay(e.day);
    if(e.type==="view")record.views+=Number(e.count);
    if(e.type==="click")record.clicks+=Number(e.count);
    if(e.type==="add")record.adds+=Number(e.count);
  }
  for(const p of dailySales){
    const record=getDay(p.day);
    record.units+=Number(p.quantity);
    if(p.currencyCode===selectedCurrency)record.revenueMinor+=Number(p.revenue);
  }
  const clickMap=new Map(clicks.map(x=>[
    [x.productId,x.kind,x.setId].join("|"),x._count._all
  ]));
  const underperformers=views
    .filter(x=>x._count._all>=25)
    .map(x=>{
      const product=productMap.get(x.productId);
      const n=clickMap.get([x.productId,x.kind,x.setId].join("|"))||0;
      return {productId:x.productId,title:product?.title||"Product",
        imageUrl:product?.imageUrl||null,kind:x.kind,setId:x.setId,
        views:x._count._all,clicks:n,ctr:percent(n,x._count._all)};
    }).filter(x=>x.ctr<1).sort((a,b)=>a.ctr-b.ctr).slice(0,12);
  const topProducts=topSold.map(row=>({
    productId:row.productId,title:productMap.get(row.productId)?.title||"Product",
    imageUrl:productMap.get(row.productId)?.imageUrl||null,
    category:productMap.get(row.productId)?.category||"",kind:row.kind,
    currencyCode:row.currencyCode,units:row._sum.quantity||0,
    revenueMinor:row._sum.netRevenueMinor||0
  }));
  const categories=new Map<string,number>(),tags=new Map<string,number>();
  for(const pair of pairs){
    const first=productMap.get(pair.productA),second=productMap.get(pair.productB);
    if(!first||!second)continue;
    const cat=[first.category,second.category].sort().join(" + ");
    categories.set(cat,(categories.get(cat)||0)+pair.orderCount);
    const a=Array.isArray(first.tags)?first.tags.filter(x=>typeof x==="string"):[];
    const b=Array.isArray(second.tags)?second.tags.filter(x=>typeof x==="string"):[];
    if(a.length&&b.length){
      const tag=[String(a[0]),String(b[0])].sort().join(" + ");
      tags.set(tag,(tags.get(tag)||0)+pair.orderCount);
    }
  }
  const ranked=(data:Map<string,number>)=>[...data].sort((a,b)=>b[1]-a[1])
    .slice(0,10).map(([name,count])=>({name,count}));
  return {plan,paid:true,orderConnected,days,selectedKind,summary,advanced:{
    daily:[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date)),
    selectedCurrency,currencies:cards.map(x=>x.currencyCode),
    topProducts,underperformers,
    categoryPairs:ranked(categories),tagPairs:ranked(tags),
    bundles:bundleSales.map(x=>({setId:x.setId,
      name:nameMap.get(x.setId)||"Bundle rule",currencyCode:x.currencyCode,
      units:x._sum.quantity||0,revenueMinor:x._sum.netRevenueMinor||0}))
  }};
}
