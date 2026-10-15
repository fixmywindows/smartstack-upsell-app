import db from "../db.server";

type ProductNode = {
  id: string; title: string; handle: string; productType: string; vendor: string;
  status: string; publishedAt: string | null; tags: string[];
  category: { name: string } | null;
  collections: { nodes: Array<{ handle: string }> };
  metafields: { nodes: Array<{ namespace: string; key: string; type: string; value: string }> };
  variants: { nodes: Array<{ id: string; price: string; availableForSale: boolean }> };
  priceRangeV2: { minVariantPrice: { amount: string; currencyCode: string } };
  featuredMedia: { preview?: { image?: { url: string } | null } | null } | null;
};
type ProductsResponse = { data?: { products?: { nodes: ProductNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }; errors?: Array<{ message: string }> };
type GraphqlAdmin = { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> };

const CATALOGUE_QUERY = `#graphql
query SmartStackCatalogue($after: String) {
  products(first: 25, after: $after, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title handle productType vendor tags status publishedAt
      category { name }
      collections(first: 10) { nodes { handle } }
      metafields(first: 30) { nodes { namespace key type value } }
      variants(first: 10) { nodes { id price availableForSale } }
      priceRangeV2 { minVariantPrice { amount currencyCode } }
      featuredMedia { preview { image { url } } }
    }
  }
}`;

const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const minor = (value: string) => Math.max(0, Math.round((Number(value) || 0) * 100));

function metafieldValue(value: string, type: string): unknown {
  if (type.startsWith("list.") || type === "json") {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

export async function ensureShop(domain: string) {
  return db.merchantShop.upsert({
    where: { domain },
    update: {},
    create: { domain },
  });
}

export async function syncCataloguePage(admin: GraphqlAdmin, domain: string) {
  const shop = await ensureShop(domain);
  // Resuming a completed scan explicitly starts a fresh scan.
  const cursor = shop.syncFinished ? null : shop.cursor;
  const response = await admin.graphql(CATALOGUE_QUERY, { variables: { after: cursor } });
  const payload = (await response.json()) as ProductsResponse;
  if (payload.errors?.length || !payload.data?.products) {
    throw new Error(payload.errors?.map((e) => e.message).join("; ") || "Shopify did not return products");
  }
  const { nodes, pageInfo } = payload.data.products;
  await db.$transaction(
    nodes.map((product) => {
      const variant = product.variants.nodes.find((v) => v.availableForSale) || product.variants.nodes[0];
      const meta = Object.fromEntries(product.metafields.nodes.map((m) => [m.namespace + "." + m.key, metafieldValue(m.value, m.type)]));
      const data = {
        title: product.title,
        handle: product.handle,
        category: slug(product.category?.name || product.productType || "other"),
        productType: slug(product.productType || ""),
        vendor: product.vendor,
        tags: product.tags,
        collections: product.collections.nodes.map((c) => c.handle),
        metafields: meta,
        variantId: variant?.id || null,
        imageUrl: product.featuredMedia?.preview?.image?.url || null,
        priceMinor: minor(variant?.price || product.priceRangeV2.minVariantPrice.amount),
        currencyCode: product.priceRangeV2.minVariantPrice.currencyCode,
        available: product.variants.nodes.some((v) => v.availableForSale),
        published: product.status === "ACTIVE" && Boolean(product.publishedAt),
      };
      return db.productSnapshot.upsert({
        where: { shopDomain_productId: { shopDomain: domain, productId: product.id } },
        create: { shopDomain: domain, productId: product.id, ...data },
        update: data,
      });
    })
  );
  const count = await db.productSnapshot.count({ where: { shopDomain: domain } });
  await db.merchantShop.update({
    where: { domain },
    data: { cursor: pageInfo.hasNextPage ? pageInfo.endCursor : null, syncFinished: !pageInfo.hasNextPage, productCount: count },
  });
  return { addedOrUpdated: nodes.length, totalCached: count, hasMore: pageInfo.hasNextPage };
}
