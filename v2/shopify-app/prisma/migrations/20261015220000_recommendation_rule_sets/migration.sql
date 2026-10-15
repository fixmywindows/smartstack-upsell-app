-- Additive migration: preserve every existing Shopify session, product snapshot and block.
ALTER TABLE "MerchantShop" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';

CREATE TABLE "RecommendationRuleSet" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shopDomain" TEXT NOT NULL,
  "legacyBlockId" TEXT,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "heading" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER NOT NULL DEFAULT 50,
  "sourceMatch" TEXT NOT NULL DEFAULT 'all',
  "sourceProductIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "sourceRules" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "sourceLogic" TEXT NOT NULL DEFAULT 'AND',
  "selectionMode" TEXT NOT NULL DEFAULT 'hybrid',
  "pinnedIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "targetRules" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "targetLogic" TEXT NOT NULL DEFAULT 'AND',
  "excludeTags" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "maxItems" INTEGER NOT NULL DEFAULT 3,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationRuleSet_shopDomain_fkey" FOREIGN KEY ("shopDomain")
      REFERENCES "MerchantShop"("domain") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecommendationRuleSet_legacyBlockId_key" ON "RecommendationRuleSet"("legacyBlockId");
CREATE INDEX "RecommendationRuleSet_shopDomain_kind_enabled_priority_idx"
  ON "RecommendationRuleSet"("shopDomain", "kind", "enabled", "priority");
CREATE INDEX "RecommendationRuleSet_shopDomain_kind_priority_idx"
  ON "RecommendationRuleSet"("shopDomain", "kind", "priority");

-- Preserve and display merchants' already configured recommendation blocks
-- as editable default rule sets in the new admin (no loss of pins or matching rules).
INSERT INTO "RecommendationRuleSet"
  ("id","shopDomain","legacyBlockId","kind","name","heading","enabled","priority",
   "sourceMatch","sourceProductIds","sourceRules","sourceLogic","selectionMode",
   "pinnedIds","targetRules","targetLogic","excludeTags","maxItems")
SELECT
  'legacy_' || b."id", b."shopDomain", b."id", b."kind",
  'Default ' || CASE b."kind"
    WHEN 'similar' THEN 'Similar Products'
    WHEN 'complement' THEN 'Complementary Products'
    WHEN 'bought_together' THEN 'Bought Together'
    WHEN 'bundle' THEN 'Complete the Set'
    ELSE 'Recommendations'
  END,
  b."heading", b."enabled", 100,
  'all', '[]'::jsonb, '[]'::jsonb, 'AND', b."mode",
  b."pinnedIds", COALESCE(b."ruleGroups"->0->'rules','[]'::jsonb),
  CASE WHEN b."ruleGroups"->0->>'logic' = 'OR' THEN 'OR' ELSE 'AND' END,
  b."excludedTags", b."maxItems"
FROM "RecommendationBlock" b;
