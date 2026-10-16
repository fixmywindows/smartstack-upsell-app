-- Phase 3 additive migration: new presentation-only designs, no changes to
-- product snapshots, merchant sessions, legacy blocks, rule sets or entitlements.
CREATE TABLE "RecommendationDesign" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationDesign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecommendationDesign_shopDomain_kind_key"
  ON "RecommendationDesign"("shopDomain", "kind");
CREATE INDEX "RecommendationDesign_shopDomain_idx"
  ON "RecommendationDesign"("shopDomain");
ALTER TABLE "RecommendationDesign"
  ADD CONSTRAINT "RecommendationDesign_shopDomain_fkey"
  FOREIGN KEY ("shopDomain") REFERENCES "MerchantShop"("domain")
  ON DELETE CASCADE ON UPDATE CASCADE;
