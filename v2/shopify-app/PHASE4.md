# SmartStack Phase 4 — better matching, variants and verified order pairs

Status: DEVELOPMENT PILOT. This code is on a separate draft branch. Do not
deploy Shopify Functions or enable any checkout discounts on a live shop yet.

## What's delivered

### Catalogue matching (on by default)
- Similar Products scores category/product-type fit plus overlapping product
  titles, tags, collections, vendor and price.
- Complementary Products rejects same-category substitutes as accessories,
  unless a merchant explicitly configured an IF → THEN condition or pin.
  It prefers curated category pairings, shared collections with accessory
  clues, and optional merchant tags such as \`for:snowboards\`.
- Bought Together checks independently paid, non-test order evidence first;
  when no such evidence exists, it uses accurately labelled cold-start
  catalogue suggestions. It never claims purchases without order evidence.
- This is improved deterministic attribute matching, **not connected LLM AI**.
  A paid embedding/semantic provider is deliberately not called in this pilot.

### Variant-safe recommendations
- Catalogue import now saves first 15 variants per product, including selected
  options, SKU, current price, compare-at price and availability.
- Individual recommendation cards prompt customers to choose Size/Colour/etc
  before quick-add if there are multiple variants.
- Bundle add-to-basket also requires a selected variant for each checked item,
  updates the estimated set total, and uses the current product's selected
  variant from the Shopify product form.
- When a product has over 15 variants in Shopify, SmartStack flags its variant
  data as incomplete and directs customers to the actual product page to choose
  options instead of guessing and potentially adding the wrong item.
- Prices are estimates until Shopify checkout (Markets, currency conversions,
  tax and third-party discounts can change final totals).

### Bought Together based on real qualifying orders
- Private migration creates OrderPairObservation, ObservedProductPair and
  OrderSyncState. No customer name, address, email, phone, payment details,
  order monetary totals, or raw order IDs are stored.
- Orders are identified by keyed HMAC SHA-256 of shop + order ID, using
  SMARTSTACK_ORDER_HASH_SECRET if provided or the app's Shopify API secret.
  Keep this key stable: rotating it without clearing old order observations
  would require a full evidence rebuild.
- One independent order contributes at most once per distinct product pair,
  even if the same product appears multiple times with a higher quantity.
- Exclude test orders, cancelled orders, unpaid orders and refunded-to-zero
  lines. Skip orders with incomplete line-item pagination.
- Require **at least 2 separate qualifying paid orders** for any pair to
  be marked 'observed'. Refunded/cancelled updates adjust counts rather than
  double-counting. Prune observations beyond the 60-day window.
- Opt-in admin page at SmartStack → Bought Together evidence imports at most
  20 orders per request (repeat while pagination remains).
- App manifest remains unchanged and does **not** request read_orders
  automatically. Store owner approval is a precondition. Without permission,
  no order API request runs.

### Bundle discounts: preview + guarded Function prototype
- Full advanced editor has a 0–30% \`bundleDiscountPercent\` **preview-only**
  setting per bundle rule. It is saved but never applied to the customer's
  cart or advertised as active.
- \`discount-prototype/cart-lines-discount.mjs\` is an inert tested
  \`cart.lines.discounts.generate.run\` core. It reads configuration solely
  from Shopify's trusted app-owned discount metafield (not customer-editable
  cart attributes), and only discounts when all configured variants are in
  the cart. Maximum allowed percentage is 30%.
- It is OUTSIDE \`extensions/\`, so Shopify CLI will not register or activate
  it during ordinary SmartStack development.
- Actual activation requires: owner approval of \`write_discounts\`, generating
  an official Shopify Function extension, deploying/publishing it, creating
  an app discount with trusted metafield configuration, and end-to-end
  checkout testing. Do not skip these steps.

## Store owner permission decisions

**Default current app:** read_products and write_app_proxy only. This feature
does not touch actual Shopify orders without approval.

**To opt into order-based Bought Together evidence:** merchant approves adding
\`read_orders\` to the linked \`shopify.app.toml\` access_scopes and goes through
the Shopify re-authorisation flow on the development store. Shopify generally
restricts read_orders to the most recent 60 days. Requesting older orders
requires a separate read_all_orders approval and is out of scope.

Example **only after explicit store owner approval**:

~~~toml
[access_scopes]
scopes = "read_products,write_app_proxy,read_orders"
~~~

Do not replace an existing local \`shopify.app.toml\`: it contains the linked
development app configuration and CLI-managed tunnel URLs.

Similarly, adding \`write_discounts\` only makes sense after the Discount
Function is generated, tested and ready for deliberate checkout activation.
Do not add it merely to run this Phase 4 build.

## Development installation

Work only in the standalone local app:
\`C:\Users\yai4k\Projects\smartstack-v2\`

Stop the current Shopify CLI server first. Copy the changed Phase 4 files
from this branch but keep \`.env\`, \`shopify.app.toml\` and theme backups.
The additive migration is REQUIRED for this phase:

~~~powershell
npx prisma migrate deploy
npx prisma generate
npx react-router typegen
npx tsc --noEmit
node --test tests/phase4.test.mjs
~~~

Restart \`shopify app dev\` against cross-sell-361.myshopify.com with the
already-working IPv6 ngrok tunnel.

Then refresh the 17 test products via SmartStack Catalogue. Previous
single-variant snapshots will otherwise be missing the new variant rows.

## Hands-on test plan

1. Open **Similar Products**, preview different categories, ensure unrelated
   products do not outrank genuinely similar ones.
2. On a real multi-variant product, choose a variant in SmartStack and verify
   the price and exact variant in the Shopify cart. Switch variants and retry.
3. On **Complete the set**, choose different option combinations and check
   total estimates. Unchecked add-ons must not appear in the basket.
4. Check a product with more than 15 variants: SmartStack should show
   'View options' instead of guessing a variant.
5. Open Bought Together evidence: before read_orders approval, sync must be
   disabled and state clearly why.
6. With permission approved, use the 20-order batch sync. Ignore test orders.
   Check verified pairs have at least 2 qualifying independent orders and
   display evidence. Re-sync; counts must not increase without new orders.
7. Verify an empty evidence set uses 'Pairs well with' or hides the widget,
   never falsely claims 'Frequently bought together'.
8. Change bundle discount preview percentage and save. Confirm the storefront
   STILL explicitly shows no active discount.
9. Test all existing IF → THEN row quotas and the single 8-product block cap.

## Known limits / future work

- Products with >15 variants require their native product-page selector. A
  dedicated paginated variant sync would remove this constraint.
- No external AI embedding/semantic inference has been turned on.
- Order data is refreshed on demand only, and the latest 60 days are used.
  An approved order webhook or scheduled incremental sync can follow.
- Bundle discount checkout activation is blocked pending Function deployment,
  merchant permission and end-to-end Shopify checkout verification.
- Paid plan billing, commission attribution, conversion analytics and
  App Store compliance are later milestones.
