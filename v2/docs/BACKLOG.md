# SmartStack v2 — implementation backlog

## Milestone A — interactive product prototype [DONE]

- [x] Four block types, hybrid/manual/automatic selection modes
- [x] Hard eligibility, inventory and compatibility rules
- [x] Title/tag/category/vendor/metafield and price matching with AND/OR rule evaluation
- [x] Observed product pairs; cold-start fallback and truthful labelling
- [x] Bundle savings preview and item-limited eligibility
- [x] Proposed 3-tier pricing and basic commission estimation
- [x] Interactive merchant studio with sample store and JSON export
- [x] Node built-in tests (18 passing)

## Milestone B — secure Shopify app foundation [NEXT]

- [ ] Create Shopify app using current React Router CLI template in isolated development app, no reused insecure OAuth code
- [ ] New dedicated Neon database, migrations, shop/session authentication
- [ ] Webhook signature checks, uninstall/product/order/refund events, retries, HMAC idempotency
- [ ] Least-privilege scopes and mandatory privacy webhooks
- [ ] Catalogue sync with product variants, tags, metafields, category, inventory, publication state
- [ ] Browser QA: official template installation, authentication and embedded navigation

## Milestone C — merchant editor + storefront [NEXT]

- [ ] Persist rule groups, pinned items and blocks per shop
- [ ] Adapt interactive editor into embedded Polaris screens, including bulk rules and OR UI
- [ ] Shopify signed App Proxy, safe recommendations endpoint with cache and tenant checks
- [ ] Register and test Theme App Extension on a development store; mobile variants/cart AJAX test
- [ ] Product-level test matrix and load test for catalogue sizes
- [ ] Publish controls and preview under different themes

## Milestone D — true AI + purchase patterns [NEXT]

- [ ] Cached semantic embeddings/scorer with cost and latency budget
- [ ] Tag/category/metafield enrichment and compatibility review workflow
- [ ] Aggregated order pair counts with minimum sample threshold and honest cold start labels
- [ ] Evaluation set for unrelated, incompatible and out-of-stock suggestions
- [ ] Quality-feedback API with merchant approves/rejects

## Milestone E — real bundle discounts and revenue share [NEXT]

- [ ] Shopify Discount Function with per-bundle conditions, variant/quantity checks and refund behaviour
- [ ] Signed item attribution; order + refund reconciliation; itemised billing dashboard for ALL plans
- [ ] Shopify App Pricing: Free 3%, Growth £15 + 1.5%, Insights £45 + 0.5%
- [ ] Negative usage corrections, currency/tax treatment, reconciliation and period close procedures
- [ ] Test disputes, cancellations, discount stacking, checkout and cart interactions

## Milestone F — Insights and launch QA

- [ ] Actual storefront impressions/clicks/add-to-carts subject to consent
- [ ] Revenue and conversion dashboards, breakdown by source/placement/type
- [ ] CSV exports and accessible date filters for Insights plan
- [ ] Privacy policy, terms, support, GDPR delete/shop uninstall handling
- [ ] App Store compliance, billing disclosures, performance, security and browser accessibility

## Definition of done for public beta

A new merchant can install, synchronise catalogue, configure one of four block types, preview and publish on a supported Shopify OS 2.0 theme, make a test checkout with a verified optional bundle discount, and see accurate, auditable attribution/charges. Failed API/AI calls must not break the storefront. No real merchant access or payment changes have been performed in this first slice.
