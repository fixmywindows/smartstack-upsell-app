import db from "../db.server";
// @ts-ignore — tested cold-start engine will be migrated into a typed package.
import { recommend, evaluateGroups } from "./engine.mjs";

export const BLOCK_KINDS = ["similar", "complement", "bought_together", "bundle"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export const BLOCK_TITLES: Record<BlockKind, string> = {
  similar: "Similar products",
  complement: "Pairs perfectly with",
  bought_together: "Frequently bought together",
  bundle: "Complete the set",
};

type Rule = { field: string; op: string; value: unknown };
function rules(value: unknown): Rule[] {
  return Array.isArray(value)
    ? value.filter((r): r is Rule => r != null && typeof r === "object"
      && typeof r.field === "string" && typeof r.op === "string")
    : [];
}
function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
function groupsFor(value: unknown, logic: string) {
  const filtered = rules(value);
  return filtered.length ? [{ logic: logic === "OR" ? "OR" : "AND", rules: filtered }] : [];
}

export async function getRecommendations(shopDomain: string, sourceId: string, kind: BlockKind, max: number) {
  const [block, sets, snapshots] = await Promise.all([
    db.recommendationBlock.findUnique({ where: { shopDomain_kind: { shopDomain, kind } } }),
    db.recommendationRuleSet.findMany({
      where: { shopDomain, kind },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    db.productSnapshot.findMany({
      where: { shopDomain }, take: 1000, orderBy: { title: "asc" },
    }),
  ]);
  const products = snapshots.map((p) => ({
    id: p.productId,
    title: p.title,
    handle: p.handle,
    category: p.category,
    productType: p.productType,
    vendor: p.vendor,
    priceCents: p.priceMinor,
    available: p.available,
    published: p.published,
    tags: textArray(p.tags),
    collections: textArray(p.collections),
    metafields: p.metafields as Record<string, unknown>,
    imageUrl: p.imageUrl,
    variantId: p.variantId,
    currencyCode: p.currencyCode,
  }));
  const source = products.find((p) => p.id === sourceId);
  if (!source) throw new Error("Source product does not exist");

  let config: {
    kind: BlockKind;
    mode: string;
    heading: string;
    maxItems: number;
    pinnedIds: string[];
    excludeTags: string[];
    ruleGroups: Array<{logic: string; rules: Rule[]}>;
  } | null = null;
  let matchedSet: { id: string; name: string; priority: number } | null = null;

  if (sets.length) {
    // The first enabled, matching rule set wins. A fallback "All products" set
    // at priority 100 ensures existing merchants keep their previous behaviour.
    for (const set of sets) {
      if (set.archived || !set.enabled) continue;
      let applies = false;
      if (set.sourceMatch === "all") applies = true;
      if (set.sourceMatch === "products") applies = textArray(set.sourceProductIds).includes(sourceId);
      if (set.sourceMatch === "rules") {
        const sourceRules = rules(set.sourceRules);
        applies = sourceRules.length > 0 && evaluateGroups(source,groupsFor(sourceRules, set.sourceLogic));
      }
      if (!applies) continue;
      matchedSet = { id: set.id, name: set.name, priority: set.priority };
      config = {
        kind, mode: set.selectionMode, heading: set.heading,
        maxItems: Math.min(kind === "bundle" ? 3 : 12, Math.max(1, Math.min(max, set.maxItems))),
        pinnedIds: textArray(set.pinnedIds),
        excludeTags: textArray(set.excludeTags),
        ruleGroups: groupsFor(set.targetRules,set.targetLogic),
      };
      break;
    }
  } else if (block?.enabled) {
    // Compatibility until new Prisma rule-set migration has been applied.
    const existing = Array.isArray(block.ruleGroups) ? block.ruleGroups as Array<{logic?: string;rules?: Rule[]}> : [];
    config = {
      kind, mode: block.mode, heading: block.heading,
      maxItems: Math.min(kind === "bundle" ? 3 : 12, Math.max(1, Math.min(max, block.maxItems))),
      pinnedIds: textArray(block.pinnedIds),
      excludeTags: textArray(block.excludedTags),
      ruleGroups: existing.map((g) => ({logic:g.logic || "AND",rules:rules(g.rules)})),
    };
  }

  if (!config) return {
    heading: BLOCK_TITLES[kind],
    items: [],
    source: null,
    warning: sets.length ? "No enabled rule set applies to this product." : "No active recommendations.",
    basis: "none",
    matchedSet: null,
  };

  const output = recommend({ sourceId, products, pairs: {}, config });
  const mapProduct = (p: typeof products[number]) => ({
    id: p.id,
    title: p.title,
    url: "/products/" + encodeURIComponent(p.handle),
    imageUrl: p.imageUrl,
    available: p.available,
    variantId: p.variantId?.split("/").pop() || "",
    priceMinor: p.priceCents,
    currencyCode: p.currencyCode || "GBP",
    priceFormatted: new Intl.NumberFormat("en-GB", {
      style: "currency", currency: p.currencyCode || "GBP",
    }).format(p.priceCents / 100),
  });
  return {
    heading: output.heading,
    basis: output.basis,
    warning: output.warning,
    matchedSet,
    // Bundles include the original source product; checkout discounts remain disabled.
    source: kind === "bundle" ? mapProduct(output.source as typeof products[number]) : null,
    items: (output.items as Array<{
      product: typeof products[number]; evidence?: string; count?: number | null;
    }>).map(({ product, evidence, count }) => ({
      ...mapProduct(product),
      reason: evidence === "merchant" ? "Manually pinned" :
        evidence === "observed" ? "Ordered together " + (count ?? 0) + " times" :
        "Matched from catalogue attributes",
    })),
  };
}
