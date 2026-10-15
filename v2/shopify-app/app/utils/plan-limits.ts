/** Pricing is proposed, NOT active billing. No subscription is created here. */
export type PlanId = 'free' | 'growth' | 'insights';
export const PLANS = {
  free: { label: 'Free', monthlyGBP: 0, commissionRate: 0.03, setsPerType: 3, rulesPerSet: 3 },
  growth: { label: 'Growth', monthlyGBP: 15, commissionRate: 0.015, setsPerType: 10, rulesPerSet: 10 },
  insights: { label: 'Insights', monthlyGBP: 45, commissionRate: 0.005, setsPerType: null, rulesPerSet: null },
} as const;
export function validPlan(value: string): PlanId {
  return value === 'growth' || value === 'insights' ? value : 'free';
}
export function canCreateSet(plan: string, existing: number): boolean {
  const cap = PLANS[validPlan(plan)].setsPerType;
  return cap === null || existing < cap;
}
export function canUseRules(plan: string, count: number): boolean {
  const cap = PLANS[validPlan(plan)].rulesPerSet;
  return count >= 0 && (cap === null || count <= cap);
}
export function planLimitDescription(plan: string): string {
  const p = PLANS[validPlan(plan)];
  return p.setsPerType === null ? 'Unlimited sets and matching rules' :
    p.setsPerType + ' rule sets per block, ' + p.rulesPerSet + ' matching conditions per set';
}
