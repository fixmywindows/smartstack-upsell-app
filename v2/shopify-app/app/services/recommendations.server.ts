import db from "../db.server";
import { normaliseRuleGroups } from "../utils/rule-groups";
// @ts-ignore — pure, dependency-free JS engine (covered by Node tests).
import { recommend, evaluateGroups } from "./engine.mjs";
// @ts-ignore — pure set matching resolver, covered by Node tests.
import { resolveRuleSets } from "./set-matching.mjs";

export const BLOCK_KINDS = ["similar", "complement", "bought_together", "bundle"] as const;
export type BlockKind = typeof BLOCK_KINDS[number];
export const BLOCK_TITLES: Record<BlockKind,string> = {
  similar: "Similar products",
  complement: "Pairs perfectly with",
  bought_together: "Frequently bought together",
  bundle: "Complete the set",
};

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

export type PreviewOptions = {
  /** Only called by an authenticated admin loader. Never forward from app proxy. */
  diagnostics?: boolean;
  /** Preview one saved set, including a draft, without making it live. */
  previewSetId?: string | null;
};

export async function getRecommendations(
  shopDomain:string, sourceId:string, kind:BlockKind, max:number, options:PreviewOptions={}
) {
  const [legacy, sets, snapshots] = await Promise.all([
    db.recommendationBlock.findUnique({
      where: { shopDomain_kind: { shopDomain, kind } }
    }),
    db.recommendationRuleSet.findMany({
      where: { shopDomain, kind },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    db.productSnapshot.findMany({
      where: { shopDomain }, take: 1000, orderBy: { title: "asc" },
    }),
  ]);
  const products = snapshots.map(p => ({
    id:p.productId, title:p.title, handle:p.handle, category:p.category,
    productType:p.productType, vendor:p.vendor, priceCents:p.priceMinor,
    available:p.available, published:p.published,
    tags:stringArray(p.tags), collections:stringArray(p.collections),
    metafields:p.metafields as Record<string,unknown>,
    imageUrl:p.imageUrl, variantId:p.variantId, currencyCode:p.currencyCode,
  }));
  type Product = typeof products[number];
  const source = products.find(p => p.id === sourceId);
  if (!source) throw new Error("Source product does not exist");
  const maxCount = Math.min(kind === "bundle" ? 3 : 12, Math.max(1, max));

  const matchConfigForSet = (set: typeof sets[number]) => ({
    kind,
    mode:set.selectionMode,
    heading:set.heading,
    maxItems:Math.min(maxCount,Math.max(1,set.maxItems)),
    pinnedIds:stringArray(set.pinnedIds),
    excludeTags:stringArray(set.excludeTags),
    excludeIds:stringArray(set.excludedProductIds),
    ruleGroups:normaliseRuleGroups(set.targetRules,set.targetLogic),
    ruleOuterLogic:set.targetLogic,
    excludeGroups:normaliseRuleGroups(set.excludeRules,set.excludeLogic),
    excludeOuterLogic:set.excludeLogic,
  });

  let selection: {set:typeof sets[number];output:ReturnType<typeof recommend>} | null=null;
  let trace:Array<{id:string;name:string;priority:number;status:string;
    sourceMatched:boolean;productCount:number;decision:string;reason:string}>=[];
  let legacyOutput: ReturnType<typeof recommend>|null=null;

  if (sets.length) {
    if (options.previewSetId && !sets.some(set=>set.id===options.previewSetId && !set.archived)) {
      throw new Error("Selected preview set does not exist in this store");
    }
    const resolved = resolveRuleSets({
      sets, source, sourceId, evaluateGroups, normaliseGroups:normaliseRuleGroups,
      recommendForSet:(set:typeof sets[number])=>recommend({
        sourceId,products,pairs:{},config:matchConfigForSet(set)
      }),
      previewSetId:options.previewSetId || null,
    });
    selection=resolved.selection as {set:typeof sets[number];output:ReturnType<typeof recommend>} | null;
    trace=resolved.trace as typeof trace;
  } else if (legacy?.enabled && !options.previewSetId) {
    // Only for installations that have not migrated their Phase 1 settings.
    const groups = Array.isArray(legacy.ruleGroups)?legacy.ruleGroups:[];
    legacyOutput=recommend({
      sourceId,products,pairs:{},
      config:{
        kind,mode:legacy.mode,heading:legacy.heading,maxItems:Math.min(maxCount,legacy.maxItems),
        pinnedIds:stringArray(legacy.pinnedIds),excludeTags:stringArray(legacy.excludedTags),
        ruleGroups:groups,
      },
    });
  }

  const output=selection?.output??legacyOutput;
  const chosen=selection?.set;
  if (!output) {
    const fallbackWasTried=trace.some(entry=>entry.decision==="fallback");
    return {
      heading:BLOCK_TITLES[kind],items:[],source:null,basis:"none",
      warning:fallbackWasTried
        ? "All matching sets ran out of eligible recommendations."
        : "No enabled recommendation set applies to this product.",
      matchedSet:null,
      ...(options.diagnostics ? {trace} : {}),
    };
  }

  const mapProduct = (p:Product) => ({
    id:p.id,title:p.title,vendor:p.vendor,
    url:"/products/"+encodeURIComponent(p.handle),
    imageUrl:p.imageUrl,available:p.available,
    variantId:p.variantId?.split("/").pop()||"",
    priceMinor:p.priceCents,currencyCode:p.currencyCode||"GBP",
    priceFormatted:new Intl.NumberFormat("en-GB",{
      style:"currency",currency:p.currencyCode||"GBP"
    }).format(p.priceCents/100),
  });

  // Do not claim real co-purchases when the app only has manual/attribute suggestions.
  const observed = kind === "bought_together" &&
    (output.items as Array<{evidence?:string}>).some(item => item.evidence === "observed");
  const truthfulHeading = kind === "bought_together" && !observed &&
    /^(frequently|often) bought together$/i.test(output.heading.trim())
    ? "Pairs well with" : output.heading;

  return {
    heading:truthfulHeading,
    basis:output.basis,
    warning:output.warning,
    matchedSet:chosen?{id:chosen.id,name:chosen.name,priority:chosen.priority}:null,
    source:kind==="bundle" ? mapProduct(output.source as Product) : null,
    items:(output.items as Array<{product:Product;evidence?:string;count?:number|null}>)
      .map(({product,evidence,count})=>({
        ...mapProduct(product),
        reason:evidence==="merchant"?"Manually pinned":
          evidence==="observed"?"Ordered together "+(count??0)+" times":
          "Matched from catalogue attributes"
      })),
    // Never expose internal condition decisions, priorities or filters publicly.
    ...(options.diagnostics ? {trace} : {}),
  };
}
