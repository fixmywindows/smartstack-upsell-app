# SmartStack v2 — Smart Product Recommendations

**Development status:** Working, dependency-free interactive demo and tested pure recommendation core. **Not a deployable/installed Shopify app yet.** This is the first feature slice being built in an isolated GitHub feature branch, separate from the original SmartStack release.

## What works today

- Four types: Similar, Complements, Bought Together, Bundle & Save.
- Automatic (deterministic cold-start scorer), Manual and Hybrid modes. A learned/embedding-based semantic AI adapter is the next stage; current 'Automatic' in the demo is **not** a connected AI model.
- Category relationships, variant/accessory compatibility restrictions, product availability checks and manual priority overrides.
- Attribute rules for title, tags, category, type, vendor, collections, price and `namespace.key` metafields. Rule evaluator supports AND/OR grouping; interactive builder currently creates AND conditions.
- Bought-together ranking from **observed** product pair counts, with a clearly-labelled fallback for insufficient data.
- 2–4-item bundles (source item + 1–3 add-ons), with none/percentage/fixed/fixed-total discount preview, using integer pence and all-items qualification.
- Prototype pricing at Free 3%, Growth £15 + 1.5%, Insights £45 + 0.5%; item-level net sales commission estimator.
- Merchant prototype editor: live preview, manual pinning, exclusion tags, rules, bundle discounts, demo analytics, pricing calculator and JSON config export.
- Theme app extension draft: UI shell and storefront script designed for signed app proxy recommendations. It intentionally **does not function on a live store** until the app proxy service is built.

## Quick start (no npm install required)

```bash
node --version     # Node 20+
npm test           # run 18 tests
npm run preview    # open http://localhost:4173
```

All sample products and purchase pairings are **fictional**. Neither the demo nor the extension has access to any real store's products or orders. The preview's Add button does not change a Shopify cart.

## Folder layout

```
index.html, styles.css          Merchant-facing interactive prototype
src/engine.mjs                  Recommendation rules/scoring/bundle preview
src/billing.mjs                 Commission eligibility and pricing calculations
src/sample-data.mjs             Fictional products and historical co-purchases
src/ui.mjs                      Prototype editor and storefront view
src/dev-server.mjs              Node built-in static development server
tests/engine.test.mjs           Core acceptance tests
extensions/...                  Draft Shopify theme extension
docs/ARCHITECTURE.md             Real app integration and security decisions
docs/BACKLOG.md                  Milestones and definition of done
```

## Important production gaps

1. Rebuild auth using Shopify's **current official React Router template**. The original repository contains a hand-rolled OAuth implementation which must not be used for production because it lacks required state and signature/session verification.
2. Register a development app and establish least-privilege Shopify permissions, signed app proxy, secure token storage and shop data isolation.
3. Connect catalogue sync/webhooks, persistent database, semantic ranking adapter and rule storage.
4. Implement and test Shopify Function-based discount enforcement in checkout; current bundle price calculations are preview only.
5. Set up verified attribution tokens, order/refund reconciliation, App Events usage billing, merchant-facing billing statements and privacy webhooks.
6. Run browser, theme-compatibility, accessibility, performance, security and test-store end-to-end checks before any merchant launch.

Do **not** use this code in production, and do not activate the theme extension on a live store yet.
