import type { Prisma, PrismaClient } from "@prisma/client";
import db from "../db.server";
import { canCreateSet, canUseRules, validPlan } from "../utils/plan-limits";
import { asLogic, countRuleConditions, normaliseRuleGroups, type MatchGroup, type MatchRule } from "../utils/rule-groups";

export const KIND_OPTIONS = ["similar", "complement", "bought_together", "bundle"] as const;
export type Kind = typeof KIND_OPTIONS[number];
export type { MatchRule, MatchGroup };
const ALLOWED_FIELDS = new Set(["tags","title","category","product_type","vendor","collections","price","available"]);
const ALLOWED_OPERATORS = new Set([
  "equals","not_equals","contains","not_contains","starts_with","ends_with",
  "not_starts_with","not_ends_with","any_of","all_of","gte","lte","exists","not_exists"
]);

export class FormValidationError extends Error {
  constructor(message: string) { super(message); this.name = "FormValidationError"; }
}
const bad = (message: string): never => { throw new FormValidationError(message); };

/** Validate all submitted conditions without silently dropping invalid entries. */
function parseGroups(raw: FormDataEntryValue | null): MatchGroup[] {
  let input: unknown;
  try { input = JSON.parse(String(raw || "[]")); }
  catch { return bad("The matching conditions could not be read."); }
  if (!Array.isArray(input) || input.length > 20) return bad("Too many condition groups.");

  const flat = input.length > 0 &&
    input.every(v => v && typeof v === "object" && !Array.isArray(v) && "field" in v);
  const shaped = input.length === 0 ? [] : flat
    ? [{ logic: "AND", rules: input }]
    : input;
  if (!Array.isArray(shaped)) return bad("Invalid condition groups.");
  if (shaped.some(group => !group || typeof group !== "object" || Array.isArray(group) ||
    !("rules" in group) || !Array.isArray((group as {rules:unknown}).rules))) {
    return bad("Every condition group must contain a list of conditions.");
  }

  let total = 0;
  const parsed: MatchGroup[] = shaped.map(group => {
    const obj = group as { logic?: unknown; rules: unknown[] };
    if (obj.rules.length === 0 || obj.rules.length > 50) {
      return bad("Each group needs between 1 and 50 conditions.");
    }
    total += obj.rules.length;
    const parsedRules: MatchRule[] = obj.rules.map(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return bad("A matching condition is invalid.");
      }
      const item = value as Record<string, unknown>;
      const field = String(item.field || "").trim();
      const op = String(item.op || "").trim();
      let expected: string | number = String(item.value ?? "").trim();
      if (!ALLOWED_FIELDS.has(field) && !/^metafield:[\w-]+\.[\w-]+$/.test(field)) {
        return bad("Choose a valid product field or metafield.");
      }
      if (!ALLOWED_OPERATORS.has(op)) return bad("Choose a valid matching operator.");
      if (op !== "exists" && op !== "not_exists" && !expected) {
        return bad("Enter a value for each condition.");
      }
      if (expected.length > 160) return bad("A condition value is too long.");
      if ((op === "gte" || op === "lte") &&
        field !== "price" && !field.startsWith("metafield:")) {
        return bad("Numeric comparisons are only available for price or numeric metafields.");
      }
      if (op === "exists" || op === "not_exists") expected = "";
      else if (field === "price") {
        // The MVP uses currencies with two minor units. Validate rather than round
        // malformed user input silently.
        if (!/^\d+(\.\d{1,2})?$/.test(String(expected)) || Number(expected) > 9999999) {
          return bad("Enter a valid non-negative price with up to two decimal places.");
        }
        expected = Math.round(Number(expected) * 100);
      }
      return { field, op, value: expected };
    });
    if (obj.logic != null && obj.logic !== "AND" && obj.logic !== "OR") {
      return bad("Choose ALL or ANY within each condition group.");
    }
    return { logic: asLogic(obj.logic), rules: parsedRules };
  });
  if (total > 100) return bad("A set cannot contain more than 100 conditions.");
  return parsed;
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
  sourceProductIds: string[]; sourceRules: MatchGroup[]; sourceLogic: string;
  selectionMode: "ai" | "manual" | "hybrid"; pinnedIds: string[];
  targetRules: MatchGroup[]; targetLogic: string;
  excludeTags: string[]; excludedProductIds: string[];
  excludeRules: MatchGroup[]; excludeLogic: string;
  fallbackMode: "next" | "stop";
  maxItems: number;
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
  const sourceRules = parseGroups(form.get("sourceRules"));
  const targetRules = parseGroups(form.get("targetRules"));
  const excludeRules = parseGroups(form.get("excludeRules"));
  const sourceLogic = logical(form.get("sourceLogic"));
  const targetLogic = logical(form.get("targetLogic"));
  const excludeLogic = logical(form.get("excludeLogic"));
  const excludedProductIds = stringArray(form.get("excludedProductIds"), 500);
  const fallbackMode = text(form.get("fallbackMode"), 8);
  if (fallbackMode !== "next" && fallbackMode !== "stop") {
    return bad("Choose what happens when a set has no eligible products.");
  }
  const count = (sourceMatch === "rules" ? countRuleConditions(sourceRules) : 0)
    + countRuleConditions(targetRules) + countRuleConditions(excludeRules);
  if (!canUseRules(plan,count)) {
    return bad("Your current plan allows fewer matching conditions in each rule set.");
  }
  if (enabled && sourceMatch === "products" && !sourceProductIds.length) return bad("Select at least one trigger product.");
  if (enabled && sourceMatch === "rules" && !countRuleConditions(sourceRules)) return bad("Add a trigger condition.");
  if (enabled && selectionMode === "manual" && !pinnedIds.length) return bad("Select at least one product to recommend.");
  const tags = text(form.get("excludeTags"),400).split(",").map(v=>v.trim().toLowerCase()).filter(Boolean).slice(0,30);
  const parsedPriority = Number(form.get("priority"));
  const priority = Number.isFinite(parsedPriority) ? Math.max(1,Math.min(100,Math.round(parsedPriority))) : 50;
  const parsedMax = Number(form.get("maxItems"));
  const maxItems = Number.isFinite(parsedMax) ? Math.max(1,Math.min(kind==="bundle"?7:8,Math.round(parsedMax))) : 3;

  return {
    kind, name, heading, enabled, priority, sourceMatch,
    sourceProductIds: sourceMatch === "products" ? sourceProductIds : [],
    sourceRules: sourceMatch === "rules" ? sourceRules : [],
    sourceLogic, selectionMode, pinnedIds, targetRules, targetLogic, excludeTags: tags,
    excludedProductIds, excludeRules, excludeLogic,
    fallbackMode, maxItems,
  };
}

type DbTransaction = Prisma.TransactionClient;
async function ensureSelectedProducts(tx: DbTransaction, shopDomain: string, ruleSet: ValidatedRuleSet) {
  const ids = [...new Set([...ruleSet.sourceProductIds,...ruleSet.pinnedIds,...ruleSet.excludedProductIds])];
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
      if (existing.archived) return bad("Restore this rule set before editing it.");
      return tx.recommendationRuleSet.update({
        where: {id:existing.id},
        data: parsed,
      });
    }
    const count = await tx.recommendationRuleSet.count({where:{shopDomain,kind:parsed.kind,archived:false}});
    if (!canCreateSet(plan,count)) {
      return bad("You've reached the " + plan + " plan's limit for this block type.");
    }
    return tx.recommendationRuleSet.create({data:{shopDomain,...parsed}});
  },{isolationLevel:"Serializable"});
}

export async function duplicateRuleSet(shopDomain: string, setId: string) {
  const plan = validPlan((await db.merchantShop.findUniqueOrThrow({
    where: { domain: shopDomain }, select: { plan: true }
  })).plan);
  return db.$transaction(async (tx) => {
    const existing = await tx.recommendationRuleSet.findFirst({
      where: { id: setId, shopDomain, archived: false }
    });
    if (!existing) return bad("Rule set not found.");
    const count = await tx.recommendationRuleSet.count({
      where: { shopDomain, kind: existing.kind, archived: false }
    });
    if (!canCreateSet(plan, count)) return bad("You've reached your plan's set limit for this block type.");
    return tx.recommendationRuleSet.create({
      data: {
        shopDomain, kind: existing.kind, name: (existing.name.slice(0,72) + " (copy)").slice(0,80),
        heading: existing.heading, enabled: false, priority: Math.min(100, existing.priority + 1),
        sourceMatch: existing.sourceMatch, sourceProductIds: existing.sourceProductIds as Prisma.InputJsonValue,
        sourceRules: existing.sourceRules as Prisma.InputJsonValue, sourceLogic: existing.sourceLogic,
        selectionMode: existing.selectionMode, pinnedIds: existing.pinnedIds as Prisma.InputJsonValue,
        targetRules: existing.targetRules as Prisma.InputJsonValue, targetLogic: existing.targetLogic,
        excludeTags: existing.excludeTags as Prisma.InputJsonValue,
        excludedProductIds: existing.excludedProductIds as Prisma.InputJsonValue,
        excludeRules: existing.excludeRules as Prisma.InputJsonValue,
        excludeLogic: existing.excludeLogic, fallbackMode: existing.fallbackMode,
        maxItems: existing.maxItems
      }
    });
  }, { isolationLevel: "Serializable" });
}
export async function archiveRuleSet(shopDomain: string, setId: string) {
  const existing = await db.recommendationRuleSet.findFirst({
    where: { id: setId, shopDomain, archived: false }
  });
  if (!existing) return bad("Rule set not found.");
  return db.recommendationRuleSet.update({
    where: { id: existing.id }, data: { archived: true, enabled: false }
  });
}
export async function restoreRuleSet(shopDomain: string, setId: string) {
  const plan = validPlan((await db.merchantShop.findUniqueOrThrow({
    where: { domain: shopDomain }, select: { plan: true }
  })).plan);
  return db.$transaction(async (tx) => {
    const existing = await tx.recommendationRuleSet.findFirst({
      where: { id: setId, shopDomain, archived: true }
    });
    if (!existing) return bad("Archived rule set not found.");
    const count = await tx.recommendationRuleSet.count({
      where: { shopDomain, kind: existing.kind, archived: false }
    });
    if (!canCreateSet(plan, count)) return bad("You've reached your plan's limit. Archive another set first.");
    return tx.recommendationRuleSet.update({
      where: { id: existing.id }, data: { archived: false, enabled: false }
    });
  }, { isolationLevel: "Serializable" });
}

export async function changeSetStatus(shopDomain:string,setId:string,enabled:boolean) {
  const record = await db.recommendationRuleSet.findFirst({where:{id:setId,shopDomain}});
  if (!record || record.archived) return bad("Rule set not found.");
  if (enabled && record.sourceMatch === "products" &&
    (!Array.isArray(record.sourceProductIds) || record.sourceProductIds.length === 0)) {
    return bad("Choose at least one trigger product before activating this set.");
  }
  if (enabled && record.sourceMatch === "rules" &&
    (!Array.isArray(record.sourceRules) || record.sourceRules.length === 0)) {
    return bad("Add a trigger condition before activating this set.");
  }
  if (enabled && record.selectionMode === "manual" &&
    (!Array.isArray(record.pinnedIds) || record.pinnedIds.length === 0)) {
    return bad("Select at least one recommendation before activating this set.");
  }
  return db.recommendationRuleSet.update({where:{id:record.id},data:{enabled}});
}
export async function deleteRuleSet(shopDomain:string,setId:string) {
  const record = await db.recommendationRuleSet.findFirst({where:{id:setId,shopDomain}});
  if (!record) return bad("Rule set not found.");
  if (record.legacyBlockId) return bad("Default rule sets cannot be deleted. You can disable or edit them.");
  return db.recommendationRuleSet.delete({where:{id:record.id}});
}
