import db from "../db.server";
// The v2 engine is a tested dependency-free JS module. Its stronger AI adapter is forthcoming.
// @ts-ignore -- JS engine types will be migrated to a dedicated TypeScript package.
import { recommend } from "./engine.mjs";

export const BLOCK_KINDS = ["similar", "complement", "bought_together", "bundle"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export const BLOCK_TITLES: Record<BlockKind, string> = {
  similar: "Similar products",
  complement: "Pairs perfectly with",
  bought_together: "Frequently bought together",
  bundle: "Complete the set",
};

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
function arrayValue(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((v) => typeof v === "object" && v !== null) : [];
}
export async function getRecommendations(shopDomain: string, sourceId: string, kind: BlockKind, max: number) {
  const block = await db.recommendationBlock.findUnique({ where: { shopDomain_kind: { shopDomain, kind } } });
  if (!block || !block.enabled) return { heading: BLOCK_TITLES[kind], items: [], warning: null };
  const snapshots = await db.productSnapshot.findMany({ where: { shopDomain }, take: 1000, orderBy: { title: "asc" } });
  const products = snapshots.map((p) => ({
    id: p.productId, title: p.title, handle: p.handle, category: p.category,
    productType: p.productType, vendor: p.vendor, priceCents: p.priceMinor,
    available: p.available, published: p.published,
    tags: textArray(p.tags), collections: textArray(p.collections),
    metafields: p.metafields as Record<string, unknown>,
    imageUrl: p.imageUrl, variantId: p.variantId, currencyCode: p.currencyCode,
  }));
  const results = recommend({
    sourceId,
    products,
    pairs: {}, // No order history read scope at this stage.
    config: {
      kind,
      mode: block.mode,
      heading: block.heading,
      maxItems: Math.min(kind === "bundle" ? 3 : 12, Math.max(1, Math.min(max, block.maxItems))),
      pinnedIds: textArray(block.pinnedIds),
      excludeTags: textArray(block.excludedTags),
      ruleGroups: arrayValue(block.ruleGroups),
    },
  });
  return {
    heading: results.heading,
    basis: results.basis,
    warning: results.warning,
    items: results.items.map(({ product: p }: { product: typeof products[number] }) => ({
      id: p.id, title: p.title,
      url: "/products/" + encodeURIComponent(p.handle),
      imageUrl: p.imageUrl,
      available: p.available,
      variantId: p.variantId?.split("/").pop() || "",
      priceFormatted: new Intl.NumberFormat("en-GB", {
        style: "currency", currency: p.currencyCode || "GBP",
      }).format(p.priceCents / 100),
      // Billing is disabled: no attribution token is issued.
    })),
  };
}
