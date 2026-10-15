CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isOnline" BOOLEAN NOT NULL DEFAULT false,
  "scope" TEXT,
  "expires" TIMESTAMP(3),
  "accessToken" TEXT NOT NULL,
  "userId" BIGINT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "accountOwner" BOOLEAN NOT NULL DEFAULT false,
  "locale" TEXT,
  "collaborator" BOOLEAN DEFAULT false,
  "emailVerified" BOOLEAN DEFAULT false,
  "refreshToken" TEXT,
  "refreshTokenExpires" TIMESTAMP(3)
);
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

CREATE TABLE "MerchantShop" (
  "domain" TEXT NOT NULL PRIMARY KEY,
  "cursor" TEXT,
  "syncFinished" BOOLEAN NOT NULL DEFAULT false,
  "productCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ProductSnapshot" (
  "shopDomain" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT '',
  "productType" TEXT NOT NULL DEFAULT '',
  "vendor" TEXT NOT NULL DEFAULT '',
  "tags" JSONB NOT NULL,
  "collections" JSONB NOT NULL,
  "metafields" JSONB NOT NULL,
  "variantId" TEXT,
  "imageUrl" TEXT,
  "priceMinor" INTEGER NOT NULL DEFAULT 0,
  "currencyCode" TEXT NOT NULL DEFAULT 'GBP',
  "available" BOOLEAN NOT NULL DEFAULT false,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductSnapshot_pkey" PRIMARY KEY ("shopDomain", "productId"),
  CONSTRAINT "ProductSnapshot_shopDomain_fkey" FOREIGN KEY ("shopDomain") REFERENCES "MerchantShop"("domain") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductSnapshot_shopDomain_category_idx" ON "ProductSnapshot"("shopDomain", "category");

CREATE TABLE "RecommendationBlock" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shopDomain" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "heading" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'hybrid',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "maxItems" INTEGER NOT NULL DEFAULT 4,
  "pinnedIds" JSONB NOT NULL,
  "excludedTags" JSONB NOT NULL,
  "ruleGroups" JSONB NOT NULL,
  "discountType" TEXT NOT NULL DEFAULT 'none',
  "discountAmount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecommendationBlock_shopDomain_fkey" FOREIGN KEY ("shopDomain") REFERENCES "MerchantShop"("domain") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RecommendationBlock_shopDomain_kind_key" ON "RecommendationBlock"("shopDomain", "kind");
CREATE INDEX "RecommendationBlock_shopDomain_enabled_idx" ON "RecommendationBlock"("shopDomain", "enabled");
