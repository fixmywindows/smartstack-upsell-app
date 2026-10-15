-- Phase 2 additive migration. Existing rule sets, Shopify sessions, products,
-- and legacy recommendation records are not deleted or rewritten.
ALTER TABLE "RecommendationRuleSet"
  ADD COLUMN "excludedProductIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "excludeRules" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "excludeLogic" TEXT NOT NULL DEFAULT 'OR',
  ADD COLUMN "fallbackMode" TEXT NOT NULL DEFAULT 'next';
