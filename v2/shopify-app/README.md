# SmartStack v2 Shopify application (development only)

This new app uses Shopify's official React Router 7 framework with authenticated catalogue sync, a storefront app proxy, merchant rules, and a draft theme block. All changes are isolated from the original SmartStack app.

## First Shopify test
1. Create a **development store** in the [Shopify Dev Dashboard](https://dev.shopify.com/dashboard). Do not install on a live store.
2. Clone [the development branch](https://github.com/fixmywindows/smartstack-upsell-app/tree/feature/smartstack-v2-shopify-install), then `cd v2/shopify-app`.
3. Install Node.js 22, Shopify CLI and dependencies: `npm install`. Run `shopify app config link` and select a **new** development app (not the old SmartStack app). The CLI will write the Shopify public client ID into `shopify.app.toml`.
4. Add `DATABASE_URL` to a **local** uncommitted `.env` or your Vercel encrypted environment. Never share your API secret or database password in chat or GitHub.
5. Run `npm run setup` to create the database schema.
6. Run `shopify app dev` and press **p**. Approve installation on your dev store.
7. Open **Catalogue** inside SmartStack, sync 25-product pages until completed; configure each type in **Recommendation blocks**.
8. On a draft/unpublished OS 2.0 theme, add the **Smart recommendations** app block. Observe recommendations and basic Add to basket functionality.

## Current scope
- Read-only Shopify catalogue sync including metafields, tags, collections, availability and variants.
- Similar, Complementary, Frequently Bought Together fallback, and Complete the Set.
- Automatic heuristics, manual product pins, and hybrid ranking. Model-driven semantic AI is not connected yet.
- Signed public app proxy `/apps/smartstack/recommendations`.
- Four configurable merchant blocks with basic rule editor and theme app block.
- Strictly **no charging, no real bundle discounts, no order access**.
- Product webhooks invalidate stale cache. Re-sync on product change.
- Shopify app settings and hosting must be connected before installation.

## Deployment
Vercel project root: `v2/shopify-app`, framework: `react-router`, runtime Node 22.
`DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL` are private environment variables. Set `SCOPES=read_products,write_app_proxy`. Perform migration and Shopify app config deploy before installing a remotely hosted version. Use a separate Dev App in Shopify, and public distribution for the eventual App Store app.

This branch should remain a draft pending build, authentication and end-to-end testing. Do **not** run app config deploy against an existing production app.
