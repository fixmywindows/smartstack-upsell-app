# SmartStack v2 — implementation architecture

## Principles

1. **Merchant control outranks AI.** Hard eligibility rules and compatibility checks always apply, even to pinned products. Merchant-selected product IDs outrank automated candidates only when those products are eligible.
2. **Good cold-start quality.** Catalogue attributes, compatibility keys and approved category relationships produce reasonable recommendations before reliable order data is available.
3. **Honest labels.** "Frequently bought together" appears only when actual pair-order evidence exists. Empty history produces a clearly-labelled complementary fallback.
4. **No unsupported discounts.** JavaScript only previews savings; checkout must verify the published conditions through a Shopify Discount Function and merchant-approved discount settings.
5. **Audit every billed sale.** Never charge for a view or the source product. Only verified additional order lines, net of discount/refunds, excluding tax/shipping, and deduplicated per order line. Usage must not exceed merchant expectations.
6. **No customer PII in AI prompts.** Product embeddings/ranking can operate on catalogue attributes and aggregated order pairs. Use privacy-friendly aggregation and minimise order data scopes.

## Production stack

- Official Shopify CLI **React Router** template for embedded admin and authenticated API access. Avoid adapting the original SmartStack OAuth routes, which currently use an unverified `state`, unverified callback signature and a query-parameter session ID.
- Shopify Theme App Extension: product page blocks, style settings and safe add-to-cart; no theme file patching.
- Shopify App Proxy: `apps/smartstack/*` (merchant-modifiable storefront path), verified using `authenticate.public.appProxy(request)`; tenant identity must come from the verified request, **not a query string chosen by a shopper**.
- Neon Postgres (isolated database per app; do not reuse other products' DB). Prisma/SQL for Shop, OAuth Session, ProductSnapshot, RecommendationBlock, RuleGroup, ProductPair, DiscountConfig, AttributionEvent, OrderLineLedger, UsageReport, EventDelivery and compliance jobs.
- Cache computed recommendations per (shop ID, product ID, block type, rule version, market/currency, collection/variant context). Invalidate on product and rule updates.
- Product GraphQL sync with cursored pagination/bulk operations as appropriate, GDPR erasure and 60-day order default handled. Fetch extra scopes only when the feature requires them.
- Scheduled/background jobs for semantic embeddings and co-purchase aggregation. A lightweight deterministic scorer and hard compatibility filter remain a fallback if AI services fail.
- Managed Shopify App Pricing + App Events API for three plans. Monthly base and usage meters, negative events for corrections; usage caps not currently supported by Shopify App Pricing.

## Domain schema (proposed)

- `Shop(id, domain unique, plan, currency, active, installedAt)`
- `Session(id, shopId, token encrypted, scope, expiresAt)`
- `ProductSnapshot(shopId, productId, title, handle, category, type, vendor, tags[], collections[], metafields, inventory, variants, published, updatedAt)`
- `RecommendationBlock(id, shopId, kind, mode, title, enabled, maxAddons, placement, ruleVersion, designConfig)`
- `RuleGroup(id, blockId, position, groupLogic [AND|OR])` and `Rule(id, ruleGroupId, field, operator, value)`
- `ManualPin(blockId, sourceProductId nullable, recommendedProductId, priority)`
- `ProductPair(shopId, sourceProductId, destinationProductId, coOrders, sampleWindowStart, sampleWindowEnd)`
- `Bundle(id, shopId, sourceProductId, configVersion, discountKind, discountValue, requireAll, published, shopifyDiscountId)`
- `AttributionEvent(id, shopId, blockId, sourceProductId, destinationVariantId, eventNonce unique, expiresAt, signedPayload)`
- `OrderLineLedger(shopId, orderId, lineId, recommendedVariantId, attributionId, eligibleNetMinor, rateSnapshot, commissionMinor, refundMinor, reconciledAt)` unique `(shopId,orderId,lineId)`
- `UsageReport(shopId, ledgerId unique, shopifyBillingEventId, amountMinor, status, correctionOf nullable)`
- `EventDelivery(shopId, externalWebhookId unique, topic, processingState, retryAt)`

Store all money as **integer minor currency units** and store currency + rate snapshots; actual production version must handle multi-currency, presentment price, tax-inclusive pricing and currency conversion policy. The demo uses GBP only.

## API contract (next milestone)

### Authenticated admin

- `GET /app/blocks`, `POST /app/blocks`, `PUT /app/blocks/:id`, `POST /app/blocks/:id/preview`
- `GET /app/products/search`, `GET /app/rules`, `POST /app/rules`
- `GET /app/analytics` (Insights), `GET /app/billing/ledger` (all plans)

### Verified app proxy

`GET /app-proxy/recommendations?product_id=...&kind=complement&max=3`

Requires authenticated signed Shopify app proxy; verify installed shop and product belongs to that shop. Return only published/available shop products:

```json
{
  "heading": "Pairs perfectly with",
  "kind": "complement",
  "items": [
    {"title":"Demo cushion","url":"/products/demo-cushion","variantId":"1234567890","imageUrl":null,"priceFormatted":"£24.00","available":true,"attributionToken":"SIGNED_SHORT_LIVED_SERVER_TOKEN"}
  ]
}
```

The `attributionToken` must be HMAC-signed server-side, bound to shop, block, source, destination variant, issued-at, TTL and nonce. Do not trust arbitrary cart line properties or unsignable query parameters for commission billing. Order events must be deduplicated and token validated against shop-scoped records. Honour consent for analytics tracking.

## Source code next steps

Move `src/engine.mjs` and `src/billing.mjs` into a shared library consumed by the official app and test suite, maintaining deterministic tests. Integrate a **cached model scorer adapter**, but preserve the eligibility and pinning behaviour regardless of model scores.

Sources: https://shopify.dev/docs/apps/build/scaffold-app | https://shopify.dev/docs/apps/build/online-store/app-proxies | https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing
