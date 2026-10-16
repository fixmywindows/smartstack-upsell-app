# SmartStack — product workspaces and analytics

Status: draft development branch only; not deployed to a live store.

## Rule Builder: THEN group product counts

Merchants keep four tabs (Similar, Complementary, Bought Together, Bundles).
Each IF → THEN rule has its own maximum product contribution.

New THEN groups have two explicitly different modes:

1. Match conditions together — preserved legacy ALL/ANY behaviour.
2. Allocate products per group — independently match each THEN group, with
   a requested product count for each. Example: 3 from Group 1, 3 from
   Group 2, 2 from Group 3. Products are deduplicated; group allowances,
   set allowances and the eight-product widget cap are enforced on the server.
   Bundles reserve one slot for the source product (seven add-ons maximum).

Previously saved rules remain in filter mode until merchants switch them.

## Design Studio: plan-aware progressive customisation

Free: theme-matched or Minimal design, show/hide product image, title, price,
heading, vendor and Add to Basket. Theme font families always remain inherited.

Growth (£15/month proposed): borders or no border, colours, card backgrounds,
image proportions/fit and size, responsive grids, font sizes, bold/italic
weight, shadows, spacing, card radius, button designs and alignment.

Insights (£45/month proposed): all design controls above, plus unlimited rules
and advanced sales analytics. The current development pilot permits restricted
custom CSS for both paid plans; this could be reserved for Insights at launch.

Custom CSS accepts documented aliases: .ss-card, .ss-image, .ss-title,
.ss-price, .ss-button, .ss-heading, .ss-vendor, .ss-detail.
Only safe visual CSS properties are allowed. Styles are validated server-side
and scoped to SmartStack Design Studio widgets only; no global theme CSS,
external links, imports or arbitrary positioning. Admin explains with examples.

## Analytics: reliable numbers, no manufactured sales

Free dashboard:
- Directly attributed recommended product units bought
- Verified attributed net product revenue
- Estimated commission at the proposed 3% rate — not billed

Paid dashboard:
- 7/30/90-day and recommendation type filters
- Recommendation card loads, 50%-visible views, clicks, basket adds
- Measured view rate, CTR and basket-add rate
- Shopify-verified direct purchase units and post-discount line revenue
- Four daily trend charts: viewed, clicked, added, attributed revenue
- Top performing recommended products with thumbnails
- Observed paired categories and tags, recommended bundle sales
- Low-CTR combinations suggested for manual review (min. 25 measured views)

Definitions and limitations:
- Engagement events require Shopify Customer Privacy analytics consent.
  These are event counts, not unique people or causal incremental uplift.
- Directly attributed purchased product lines require optional read_orders
  permission and Shopify Order API synchronisation.
- On consented SmartStack cart addition, a signed shop-specific reference
  is attached to the order line. Only a Shopify-verified, paid, non-test,
  non-cancelled line with a valid matching reference contributes revenue.
- Refunded/removal adjustments are reconciled idempotently; no user emails,
  names, phone numbers, addresses or payment details are stored by SmartStack.
- Revenue in different currencies is shown separately, not combined via
  fictional FX rates.
- If the customer clicks a recommendation but later uses an ordinary Shopify
  product form to buy, this MVP does NOT yet attribute that indirect sale.
- Without owner-approved order access and a completed sync, the Free dashboard
  shows an unavailable financial state — not invented zero revenue.
- Proposed rates: Free 3%, Growth 1.5%, Insights 0.5%. No usage charges are
  currently created. Shopify App Pricing + App Events API billing will be a
  separate, reviewed launch milestone.

Bought Together Evidence is a data input (co-purchase associations from
eligible paid orders), not a separate substitute for a sales analytics page.

## Test checklist

1. Back up the standalone SmartStack project. Preserve .env, shopify.app.toml
   and ngrok configuration.
2. Copy the updated files and apply the additive
   20261016193000_group_allocations_analytics Prisma migration.
3. Run Prisma generate, React Router typegen, TypeScript and unit tests.
4. In Cross Sell dev store: make 3+3+2 independent THEN groups, preview
   and confirm one eight-product shelf with no duplicates.
5. Verify old rules still work as ALL/ANY filters.
6. Confirm theme fonts and show/hide, border, image and text styling settings.
7. Review Free Analytics and paid layouts (paid test entitlement required).
8. Verify no telemetry flows without analytics consent.
9. With explicit owner approval, enable read_orders, reauthorise, and sync
   eligible real order batches. Test order-only data must not count.
10. Verify direct purchases and refunds with actual order line attributes.
11. Keep discounts, semantic LLM AI and usage billing disabled until
    separately tested and explicitly activated.

References:
https://shopify.dev/docs/api/web-pixels-api/standard-api/customerprivacy
https://shopify.dev/docs/api/ajax/reference/cart
https://shopify.dev/changelog/posts/shopify-app-pricing-charge-for-usage-recurring-subscriptions-or-both
