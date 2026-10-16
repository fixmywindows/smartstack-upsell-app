# SmartStack Phase 3 — Theme-aware Design Studio

**Status:** development branch, not published to the Shopify App Store.
This release changes presentation only. No paid plan is activated, no discount
or commission is applied, and no existing rule set is deleted.

## What changed

- Four independent Design Studio workspaces: Similar, Complementary,
  Bought Together and Complete the Set.
- Storefront presets: Match my store, Minimal, Editorial and Bold.
- Basic Free controls: grid, swipeable carousel or compact list; show/hide
  heading, price, vendor and individual Add to Basket actions.
- Growth/Insights controls: border/card styles, image ratio and fit,
  responsive columns, spacing, corner radius, heading alignment, button style,
  custom button colour and bundle arrangement.
- Responsive container queries prevent tiny product cards when a widget is
  placed inside the narrow product information column.
- Default styling inherits the store's font and text colour. When a merchant
  enables Add to Basket, the app attempts to copy the primary product-form
  button's colours and border radius at render time.
- Bought Together without observed order evidence should not claim real
  "Frequently Bought Together" sales, even if an old widget had that heading.
- Merchant theme app blocks can either follow the central Design Studio
  defaults (recommended) or use the original per-block layout settings.
- A separate Show / Hide Add to Basket override is always available per
  theme-editor block, even when all other styling follows Design Studio.

## How to test on Cross Sell (development only)

1. Open the SmartStack app and navigate to Design Studio.
2. Open each of the four tabs. The mock preview uses the store's real synced
   published products. Compare Desktop/Mobile and Grid/Compact layouts.
3. Choose **Match my store**. In the default configuration, ordinary card
   widgets have clean borderless cards with no Add to Basket buttons.
4. Enable "Display Add to Basket buttons". Save, then refresh the storefront.
   Verify button styling inherits the product form's appearance.
5. In a test theme editor, select a Smart recommendations app block.
   Set Design settings to "Use Design Studio defaults". If necessary, use
   the block-level Add to Basket override to force Show or Hide without
   changing the shared settings.
6. Test a narrow placement inside Product Information and a wide placement
   below product details. Grid should not squeeze into three tiny columns.
7. On the Bought Together type, try Compact list. On Complete the Set,
   compare the image-led/row-based layout in the Design Studio mock preview.
8. Check at 320px, 375px, 768px and desktop widths. Check the theme editor's
   preview and the actual password-protected storefront, with ngrok running.

## Billing and design tier behaviour

The plan is read from the MerchantShop record, never from the browser.

- Free can save Match my store or Minimal with standard layout and display
  toggles, including hiding Add to Basket.
- Free users can preview advanced looks, but can't save them until Growth or
  Insights is active. Subscription payment integrations are still unimplemented.
- Growth/Insights may save all current styling options when their entitlement
  is correctly recorded.
- This pilot does not charge, grant a paid subscription or change plans.
- The studio returns only validated, whitelisted design settings to storefront
  widgets. It never sends merchant rule conditions or credentials to the public
  storefront.
- A design is unique per shop + recommendation type. Changes to one type
  do not alter the other types.

## Database and safe deployment

The additive Prisma migration
\`prisma/migrations/20261016100000_design_studio/migration.sql\`
creates a new RecommendationDesign table linked to MerchantShop with
ON DELETE CASCADE. It does not modify existing products, saved rules,
Shopify sessions, or plan entitlements.

To apply to an existing **standalone** Windows development copy:

\`\`\`powershell
npx prisma migrate deploy
npx prisma generate
npx react-router typegen
npx tsc --noEmit
node --test tests/widget.test.mjs tests/phase2-rules.test.mjs tests/design.test.mjs
\`\`\`

The GitHub CI runs the application build and tests against a temporary
PostgreSQL database. This does not touch the real Neon development database.

## Known limitations

- The in-admin preview is an approximation. True theme font and button
  inheritance can only be confirmed inside the Shopify theme.
- Some themes draw their buttons with pseudo-elements or custom tokens.
  A theme-matching fallback colour is used when there is no readable
  computed product-form button background.
- Product-level variant selection and discounted bundle checkout will be
  part of Phase 4; Phase 3 does not change that logic.
- Actual cross-sell sales, conversion, billing and A/B tests are later phases.
- The code has not been locally browser-tested against every Shopify theme.
