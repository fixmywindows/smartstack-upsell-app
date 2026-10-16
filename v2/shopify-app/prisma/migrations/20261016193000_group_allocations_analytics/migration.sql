-- Additive migration; no merchant rules, products, sessions or billing changed.
ALTER TABLE "RecommendationRuleSet"
  ADD COLUMN "targetMode" TEXT NOT NULL DEFAULT 'filter';

CREATE TABLE "RecommendationEvent" (
  "id" TEXT NOT NULL,
  "shopDomain" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sourceProductId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "setId" TEXT NOT NULL,
  "groupIndex" INTEGER,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecommendationEvent_shopDomain_fkey"
    FOREIGN KEY ("shopDomain") REFERENCES "MerchantShop"("domain")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecommendationEvent_shopDomain_eventId_key"
  ON "RecommendationEvent"("shopDomain","eventId");
CREATE INDEX "RecommendationEvent_shopDomain_occurredAt_type_idx"
  ON "RecommendationEvent"("shopDomain","occurredAt","type");
CREATE INDEX "RecommendationEvent_shopDomain_setId_occurredAt_idx"
  ON "RecommendationEvent"("shopDomain","setId","occurredAt");
CREATE INDEX "RecommendationEvent_shopDomain_tokenHash_occurredAt_idx"
  ON "RecommendationEvent"("shopDomain","tokenHash","occurredAt");

CREATE TABLE "RecommendationPurchase" (
  "id" TEXT NOT NULL,
  "shopDomain" TEXT NOT NULL,
  "orderKey" TEXT NOT NULL,
  "lineKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceProductId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "setId" TEXT NOT NULL,
  "groupIndex" INTEGER,
  "currencyCode" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "netRevenueMinor" INTEGER NOT NULL,
  "commissionBasisPoints" INTEGER NOT NULL,
  "estimatedCommissionMinor" INTEGER NOT NULL,
  "purchasedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecommendationPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecommendationPurchase_shopDomain_fkey"
    FOREIGN KEY ("shopDomain") REFERENCES "MerchantShop"("domain")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecommendationPurchase_shopDomain_orderKey_lineKey_key"
  ON "RecommendationPurchase"("shopDomain","orderKey","lineKey");
CREATE INDEX "RecommendationPurchase_shopDomain_purchasedAt_kind_idx"
  ON "RecommendationPurchase"("shopDomain","purchasedAt","kind");
CREATE INDEX "RecommendationPurchase_shopDomain_setId_purchasedAt_idx"
  ON "RecommendationPurchase"("shopDomain","setId","purchasedAt");
CREATE INDEX "RecommendationPurchase_shopDomain_productId_purchasedAt_idx"
  ON "RecommendationPurchase"("shopDomain","productId","purchasedAt");
