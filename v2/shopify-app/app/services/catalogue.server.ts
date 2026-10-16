import db from "../db.server";
import type { Prisma } from "@prisma/client";

type VariantNode = {
  id: string; title: string; sku: string | null; price: string;
  compareAtPrice: string | null; availableForSale: boolean; inventoryQuantity: number | null;
  selectedOptions: Array<{name: string; value: string}>;
};
type ProductNode = {
  id: string; title: string; handle: string; productType: string; vendor: string;
  status: string; publishedAt: string | null; tags: string[];
  category: { name: string } | null;
  collections: { nodes: Array<{ handle: string }> };
  metafields: { nodes: Array<{namespace:string;key:string;type:string;value:string}> };
  variants: { nodes: VariantNode[]; pageInfo: {hasNextPage:boolean} };
  priceRangeV2: { minVariantPrice: {amount:string;currencyCode:string} };
  featuredMedia: { preview?: {image?:{url:string}|null}|null } | null;
};
type ProductsResponse = {
  data?: {products?: {nodes:ProductNode[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}};
  errors?: Array<{message:string}>;
};
type GraphqlAdmin = {
  graphql: (query:string,options?:{variables?:Record<string,unknown>})=>Promise<Response>;
};

// Keep variant pagination at 15 per product so a 25-product query stays
// affordable for Shopify's GraphQL cost throttling. Mark larger products
// incomplete and require their product page for variant selection.
const CATALOGUE_QUERY = String.raw`#graphql
query SmartStackCatalogue($after: String) {
  products(first: 25, after: $after, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title handle productType vendor tags status publishedAt
      category { name }
      collections(first: 10) { nodes { handle } }
      metafields(first: 30) { nodes { namespace key type value } }
      variants(first: 15) {
        pageInfo { hasNextPage }
        nodes {
          id title sku price compareAtPrice availableForSale inventoryQuantity
          selectedOptions { name value }
        }
      }
      priceRangeV2 { minVariantPrice { amount currencyCode } }
      featuredMedia { preview { image { url } } }
    }
  }
}`;

const slug=(value:string)=>value.trim().toLowerCase()
  .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const minor=(value:string|null|undefined)=>
  Math.max(0,Math.round((Number(value)||0)*100));
function metafieldValue(value:string,type:string):unknown {
  if(type.startsWith("list.")||type==="json"){
    try{return JSON.parse(value);}catch{return value;}
  }
  return value;
}
export async function ensureShop(domain:string) {
  return db.merchantShop.upsert({where:{domain},update:{},create:{domain}});
}
export async function syncCataloguePage(admin:GraphqlAdmin,domain:string) {
  const shop=await ensureShop(domain);
  const cursor=shop.syncFinished?null:shop.cursor;
  const response=await admin.graphql(CATALOGUE_QUERY,{variables:{after:cursor}});
  if(!response.ok)throw new Error("Shopify catalogue responded with HTTP "+response.status);
  const payload=await response.json() as ProductsResponse;
  if(payload.errors?.length||!payload.data?.products){
    throw new Error(payload.errors?.map(e=>e.message).join("; ")||"Shopify did not return products");
  }
  const {nodes,pageInfo}=payload.data.products;
  await db.$transaction(async tx=>{
    for(const product of nodes){
      const variants=product.variants.nodes;
      const preferred=variants.find(v=>v.availableForSale)||variants[0];
      const meta=Object.fromEntries(product.metafields.nodes.map(m=>
        [m.namespace+"."+m.key,metafieldValue(m.value,m.type)]));
      const currencyCode=product.priceRangeV2.minVariantPrice.currencyCode;
      const imageUrl=product.featuredMedia?.preview?.image?.url||null;
      const data={
        title:product.title,
        handle:product.handle,
        category:slug(product.category?.name||product.productType||"other"),
        productType:slug(product.productType||""),
        vendor:product.vendor,
        tags:product.tags,
        collections:product.collections.nodes.map(c=>c.handle),
        metafields:meta as Prisma.InputJsonObject,
        variantId:preferred?.id||null,
        variantsComplete:!product.variants.pageInfo.hasNextPage,
        imageUrl,
        priceMinor:minor(preferred?.price||product.priceRangeV2.minVariantPrice.amount),
        currencyCode,
        available:variants.some(v=>v.availableForSale) || product.variants.pageInfo.hasNextPage,
        published:product.status==="ACTIVE" && Boolean(product.publishedAt)
      };
      await tx.productSnapshot.upsert({
        where:{shopDomain_productId:{shopDomain:domain,productId:product.id}},
        create:{shopDomain:domain,productId:product.id,...data},
        update:data
      });
      // Fully replace only variants fetched for that product. This removes
      // deleted/disabled variants from the local cache without affecting others.
      await tx.productVariantSnapshot.deleteMany({
        where:{shopDomain:domain,productId:product.id}
      });
      if(variants.length){
        await tx.productVariantSnapshot.createMany({
          data:variants.map(v=>({
            shopDomain:domain,productId:product.id,variantId:v.id,title:v.title,
            sku:v.sku,priceMinor:minor(v.price),
            compareAtMinor:v.compareAtPrice?minor(v.compareAtPrice):null,
            available:v.availableForSale,inventoryQty:v.inventoryQuantity,
            options:v.selectedOptions as unknown as Prisma.InputJsonArray,
            imageUrl
          }))
        });
      }
    }
  });
  const count=await db.productSnapshot.count({where:{shopDomain:domain}});
  await db.merchantShop.update({
    where:{domain},
    data:{cursor:pageInfo.hasNextPage?pageInfo.endCursor:null,
      syncFinished:!pageInfo.hasNextPage,productCount:count}
  });
  return {addedOrUpdated:nodes.length,totalCached:count,hasMore:pageInfo.hasNextPage};
}
