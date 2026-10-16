ALTER TABLE "ProductSnapshot" ADD COLUMN "variantsComplete" BOOLEAN NOT NULL DEFAULT TRUE;

-- Phase 4 additive. No customer PII, carts, payments, sessions or legacy rules touched.
CREATE TABLE "ProductVariantSnapshot" (
  "shopDomain" TEXT NOT NULL, "productId" TEXT NOT NULL, "variantId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "sku" TEXT, "priceMinor" INTEGER NOT NULL,
  "compareAtMinor" INTEGER, "available" BOOLEAN NOT NULL DEFAULT FALSE,
  "inventoryQty" INTEGER, "options" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "imageUrl" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductVariantSnapshot_pkey" PRIMARY KEY ("shopDomain", "variantId"),
  CONSTRAINT "ProductVariantSnapshot_shopDomain_fkey"
    FOREIGN KEY ("shopDomain") REFERENCES "MerchantShop"("domain") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductVariantSnapshot_shopDomain_productId_idx"
  ON "ProductVariantSnapshot"("shopDomain", "productId");

CREATE TABLE "OrderPairObservation" (
  "shopDomain" TEXT NOT NULL, "orderKey" TEXT NOT NULL, "productIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "placedAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderPairObservation_pkey" PRIMARY KEY ("shopDomain", "orderKey"),
  CONSTRAINT "OrderPairObservation_shopDomain_fkey"
    FOREIGN KEY ("shopDomain") REFERENCES "MerchantShop"("domain") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OrderPairObservation_shopDomain_placedAt_idx"
  ON "OrderPairObservation"("shopDomain", "placedAt");

CREATE TABLE "ObservedProductPair" (
  "shopDomain" TEXT NOT NULL, "productA" TEXT NOT NULL, "productB" TEXT NOT NULL,
  "orderCount" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ObservedProductPair_pkey" PRIMARY KEY ("shopDomain", "productA", "productB"),
  CONSTRAINT "ObservedProductPair_shopDomain_fkey"
    FOREIGN KEY ("shopDomain") REFERENCES "MerchantShop"("domain") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ObservedProductPair_shopDomain_productB_idx"
  ON "ObservedProductPair"("shopDomain", "productB");

CREATE TABLE "OrderSyncState" (
  "shopDomain" TEXT NOT NULL, "cursor" TEXT, "finished" BOOLEAN NOT NULL DEFAULT FALSE,
  "scanned" INTEGER NOT NULL DEFAULT 0, "observed" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderSyncState_pkey" PRIMARY KEY ("shopDomain"),
  CONSTRAINT "OrderSyncState_shopDomain_fkey"
    FOREIGN KEY ("shopDomain") REFERENCES "MerchantShop"("domain") ON DELETE CASCADE ON UPDATE CASCADE
);
