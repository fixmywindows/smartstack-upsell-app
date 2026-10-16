# SmartStack native theme matching — visual refinement

This is a presentation-only patch on top of Phase 3. It does not modify
Shopify products, recommendation conditions, sessions, billing or the
Prisma database. The old version remains accessible via the Phase 3 branch.

## What was wrong

Shopify's native Related products uses significantly larger typography and
a four-column grid on Cross Sell. SmartStack used sizes such as .9rem and
.72rem. Many Shopify themes set the HTML font root around 10px, making
these texts roughly 9px or 7px — too small to read and unlike the theme.

The Bought Together widget also displayed as a narrow list when placed
full-width, and when still hidden during loading, its measured width was
zero, so it could not reliably choose its wide layout.

The Match my store quick-add styling copied opaque backgrounds, but a
native transparent outlined Add to Cart button could lose its visible
border.

## Fix

- Use readable em/px fallbacks, and read computed font size, font family
  and font weight from native related-product headings, cards and prices
  when such elements are available.
- Match native related-product spacing/backgrounds when available, using
  isolated CSS variables on the SmartStack block. No global CSS changes.
- Match native-style four-column shelves, adapting to fewer columns and
  compact horizontal cards when mounted inside narrow product information.
- Bought Together can use a full-width grid in Match my store mode, while
  remaining a compact list beside a product.
- Give outlined buttons a visible border and readable text even when the
  merchant's product-form button has a transparent background.
- Adjust the Design Studio mock preview to use the same readable typography
  and full-width shelf defaults.

## How to verify on a development theme

1. Put SmartStack Similar Products directly underneath Shopify's own
   Related products, on the same product template.
2. Compare section heading size, product title size/weight, prices,
   image backgrounds, gaps and grid columns. Exact 1:1 rendering is not
   guaranteed for every theme, but the differences should be much smaller.
3. Move a SmartStack widget inside Product Information. Confirm it becomes
   horizontal/compact without squashing product names.
4. Test Bought Together in the two placements. In Match my store it should
   be grid-like full-width but compact in the narrow information column.
5. Enable Add to Basket buttons in Design Studio. If the native primary Add
   to Cart button has an outline, the SmartStack buttons should remain
   visibly outlined, not disappear into the background.
6. Confirm the existing saved recommendation sets and product matching
   are untouched. Check mobile (around 375px) and desktop views.

All modifications are isolated to CSS/JS and the Design Studio mock
preview. No migrations or re-sync required.
