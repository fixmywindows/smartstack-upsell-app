import type { Prisma, PrismaClient } from "@prisma/client";
import db from "../db.server";
import { canCreateSet, canUseRules, validPlan } from "../utils/plan-limits";

export const KIND_OPTIONS = ["similar", "complement", "bought_together", "bundle"] as const;
export type Kind = typeof KIND_OPTIONS[number];
export type MatchRule = { field: string; op: string; value: string | number };
const ALLOWED_FIELDS = new Set(["tags","title","category","product_type","vendor","collections","price","available"]);
const ALLOWED_OPERATORS = new Set([
  "equals","not_equals","contains","not_contains","any_of","all_of","gte","lte","exists","not_exists"
]);

export class FormValidationError extends Error {
  constructor(message: string) { super(message); this.name = "FormValidationError"; }
}
const bad = (message: string): never => { throw new FormValidationError(message); };

function parseRules(raw: FormDataEntryValue | null): MatchRule[] {
  let values: unknown;
  try { values = JSON.parse(String(raw || "[]")); } catch { return bad("The matching conditions could not be read."); }
  if (!Array.isArray(values) || values.length > 100) return bad("Invalid number of conditions.");
  return values.map((value) => {
    if (!value || typeof value !== "object") return bad("A matching condition is invalid.");
    const obj = value as Record<string, unknown>;
    const field = String(obj.field || "").trim();
    const op = String(obj.op || "").trim();
    let expected: string | number = String(obj.value ?? "").trim();
    if (!ALLOWED_FIELDS.has(field) && !/^metafield:[\w-]+\.[\w-]+$/.test(field)) {
      return bad("Choose a valid product field or metafield.");
    }
    if (!ALLOWED_OPERATORS.has(op)) return bad("Choose a valid matching operator.");
    if (!["exists","not_exists"].includes(op) && !expected) return bad("Enter a value for each condition.");
    if (expected.length > 160) return bad("A condition value is too long.");
    if (field === "price") {
      // The UI works in merchant currency units; the engine stores integer minor units.
      // This MVP uses the store's base currency and assumes two fractional digits.
      const amount = Number(expected);
      if (!Number.isFinite(amount) || amount < 0 || amount > 9999999) {
        return bad("Enter a valid non-negative product price.");
      }
      expected = Math.round(amount * 100);
    }
    return { field, op, value: expected };
  });
}
function stringArray(raw: FormDataEntryValue | null, max: number): string[] {
  let value: unknown;
  try { value = JSON.parse(String(raw || "[]")); } catch { return bad("The selected products could not be read."); }
  if (!Array.isArray(value) || value.length > max || value.some((s) => typeof s !== "string")) {
    return bad("Too many products were selected.");
  }
  return [...new Set(value.map((s) => String(s)))];
}
function text(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}
const logical = (value: FormDataEntryValue | null) => value === "OR" ? "OR" : "AND";

export type ValidatedRuleSet = {
  kind: Kind; name: string; heading: string; enabled: boolean; priority: number;
  sourceMatch: "all" | "products" | "rules";
  sourceProductIds: string[]; sourceRules: MatchRule[]; sourceLogic: string;
  selectionMode: "ai" | "manual" | "hybrid"; pinnedIds: string[];
  targetRules: MatchRule[]; targetLogic: string;
  excludeTags: string[]; maxItems: number;
};

export function parseRuleSet(form: FormData, plan: string): ValidatedRuleSet {
  const kind = text(form.get("kind"),32) as Kind;
  if (!KIND_OPTIONS.includes(kind)) return bad("Choose a recommendation block type.");
  const name = text(form.get("name"),80);
  if (!name) return bad("Give this rule set a name.");
  const heading = text(form.get("heading"),100) ||
    ({similar:"Similar products",complement:"Pairs perfectly with",bought_together:"Pairs well with",bundle:"Complete the set"} as const)[kind];
  const enabled = form.get("enabled") === "on";
  const sourceMatch = text(form.get("sourceMatch"),30) as ValidatedRuleSet["sourceMatch"];
  if (!["all","products","rules"].includes(sourceMatch)) return bad("Choose when this set should apply.");
  const selectionMode = text(form.get("selectionMode"),30) as ValidatedRuleSet["selectionMode"];
  if (!["ai","manual","hybrid"].includes(selectionMode)) return bad("Choose a recommendation mode.");

  const sourceProductIds = stringArray(form.get("sourceProductIds"),500);
  const pinnedIds = stringArray(form.get("pinnedIds"),500);
  const sourceRules = parseRules(form.get("sourceRules"));
  const targetRules = parseRules(form.get("targetRules"));
  const sourceLogic = logical(form.get("sourceLogic"));
  const targetLogic = logical(form.get("targetLogic"));
  const count = (sourceMatch === "rules" ? sourceRules.length : 0) + targetRules.length;
  if (!canUseRules(plan,count)) {
    return bad("Your current plan allows fewer matching conditions in each rule set.");
  }
  if (enabled && sourceMatch === "products" && !sourceProductIds.length) return bad("Select at least one trigger product.");
  if (enabled && sourceMatch === "rules" && !sourceRules.length) return bad("Add a trigger condition.");
  if (enabled && selectionMode === "manual" && !pinnedIds.length) return bad("Select at least one product to recommend.");
  const tags = text(form.get("excludeTags"),400).split(",").map(v=>v.trim().toLowerCase()).filter(Boolean).slice(0,30);
  const parsedPriority = Number(form.get("priority"));
  const priority = Number.isFinite(parsedPriority) ? Math.max(1,Math.min(100,Math.round(parsedPriority))) : 50;
  const parsedMax = Number(form.get("maxItems"));
  const maxItems = Number.isFinite(parsedMax) ? Math.max(1,Math.min(kind==="bundle"?3:12,Math.round(parsedMax))) : 3;

  return {
    kind, name, heading, enabled, priority, sourceMatch,
    sourceProductIds: sourceMatch === "products" ? sourceProductIds : [],
    sourceRules: sourceMatch === "rules" ? sourceRules : [],
    sourceLogic, selectionMode, pinnedIds, targetRules, targetLogic, excludeTags: tags,
    maxItems,
  };
}

type DbTransaction = Prisma.TransactionClient;
async function ensureSelectedProducts(tx: DbTransaction, shopDomain: string, ruleSet: ValidatedRuleSet) {
  const ids = [...new Set([...ruleSet.sourceProductIds,...ruleSet.pinnedIds])];
  if (!ids.length) return;
  const count = await tx.productSnapshot.count({
    where: {shopDomain, productId: {in:ids}},
  });
  if (count !== ids.length) return bad("One or more selected products aren't in your synced catalogue.");
}
export async function saveRuleSet(shopDomain: string, form: FormData) {
  const current = await db.merchantShop.findUniqueOrThrow({where:{domain:shopDomain},select:{plan:true}});
  const plan = validPlan(current.plan);
  const parsed = parseRuleSet(form,plan);
  const id = text(form.get("setId"),120);
  // Serializable transaction prevents simultaneous create requests from bypassing limits.
  return db.$transaction(async (tx) => {
    await ensureSelectedProducts(tx,shopDomain,parsed);
    if (id) {
      const existing = await tx.recommendationRuleSet.findFirst({where:{id,shopDomain}});
      if (!existing) return bad("Rule set not found.");
      if (existing.kind !== parsed.kind) return bad("A rule set can't change block types.");
      return tx.recommendationRuleSet.update({
        where: {id:existing.id},
        data: parsed,
      });
    }
    const count = await tx.recommendationRuleSet.count({where:{shopDomain,kind:parsed.kind}});
    if (!canCreateSet(plan,count)) {
      return bad("You've reached the " + plan + " plan's limit for this block type.");
    }
    return tx.recommendationRuleSet.create({data:{shopDomain,...parsed}});
  },{isolationLevel:"Serializable"});
}

export async function changeSetStatus(shopDomain:string,setId:string,enabled:boolean) {
  const record = await db.recommendationRuleSet.findFirst({where:{id:setId,shopDomain}});
  if (!record) return bad("Rule set not found.");
  if (enabled && record.sourceMatch === "products" && !Array.isArray(record.sourceProductIds)) return bad("Finish the rule set first.");
  return db.recommendationRuleSet.update({where:{id:record.id},data:{enabled}});
}
export async function deleteRuleSet(shopDomain:string,setId:string) {
  const record = await db.recommendationRuleSet.findFirst({where:{id:setId,shopDomain}});
  if (!record) return bad("Rule set not found.");
  if (record.legacyBlockId) return bad("Default rule sets cannot be deleted. You can disable or edit them.");
  return db.recommendationRuleSet.delete({where:{id:record.id}});
}
