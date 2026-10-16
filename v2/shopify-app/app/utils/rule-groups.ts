/**
 * Shared, browser-safe helpers for SmartStack's visual condition groups.
 *
 * Data is persisted as JSON arrays of {logic, rules}. Existing Phase 1 sets
 * used a flat array of rules; normaliseRuleGroups transparently upgrades
 * those at display time (no rewriting of a merchant's saved configuration).
 */
export type MatchLogic = "AND" | "OR";
export type MatchRule = { field: string; op: string; value: string | number };
export type MatchGroup = { logic: MatchLogic; rules: MatchRule[]; maxItems?: number };

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const asLogic = (value: unknown): MatchLogic => value === "OR" ? "OR" : "AND";

function ruleFrom(value: unknown): MatchRule | null {
  if (!isObject(value) || typeof value.field !== "string" || typeof value.op !== "string") return null;
  const field = value.field;
  const op = value.op;
  const rawValue = value.value;
  return { field, op, value: typeof rawValue === "number" ? rawValue : String(rawValue ?? "") };
}

/**
 * Legacy: [{field,op,value},...]; Phase 2: [{logic:"AND",rules:[...]},...]
 */
export function normaliseRuleGroups(value: unknown, fallback: unknown = "AND"): MatchGroup[] {
  if (!Array.isArray(value) || !value.length) return [];
  if (value.every(entry => isObject(entry) && "rules" in entry)) {
    return value.map(group => {
      const record = group as Record<string, unknown>;
      const raw = Array.isArray(record.rules) ? record.rules : [];
      const count=Number(record.maxItems);
      const maxItems=Number.isInteger(count)&&count>=1&&count<=8?count:undefined;
      return {logic:asLogic(record.logic),
        rules:raw.map(ruleFrom).filter((r):r is MatchRule=>r!==null),
        ...(maxItems?{maxItems}:{})
      };
    });
  }
  const flat = value.map(ruleFrom).filter((r): r is MatchRule => r !== null);
  return flat.length ? [{ logic: asLogic(fallback), rules: flat }] : [];
}

export const countRuleConditions = (groups: MatchGroup[]): number =>
  groups.reduce((count, group) => count + group.rules.length, 0);

export function groupsForEditor(value: unknown, fallback: unknown = "AND"): MatchGroup[] {
  return normaliseRuleGroups(value, fallback).map(group => ({
    ...group,
    rules: group.rules.map(rule => ({
      ...rule,
      // Stored prices are integer minor units; editor labels prices in pounds.
      value: rule.field === "price" && typeof rule.value === "number"
        ? String(rule.value / 100) : String(rule.value ?? ""),
    })),
  }));
}
