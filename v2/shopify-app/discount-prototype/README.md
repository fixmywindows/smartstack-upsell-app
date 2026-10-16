# SmartStack bundle discount Function — guarded prototype

This directory is intentionally OUTSIDE \`extensions/\`. The Shopify CLI will
not automatically register or deploy it on the existing test app.

Before offering real discounts:
1. Obtain store-owner approval for the \`write_discounts\` scope.
2. Run \`shopify app generate extension --template discount\` in the standalone
   Shopify project, select JavaScript and register the generated extension.
3. Use the 2026-10 \`cart.lines.discounts.generate.run\` Function target
   and migrate the supplied input GraphQL and tested logic into the scaffold.
4. In the merchant's Shopify admin create an app-owned discount via
   \`discountAutomaticAppCreate\` after Shopify publishes the Function.
5. Store configuration only in that discount's trusted app-owned metafield
   \`$app/function-configuration\`:
   \`{"active":true,"percentage":10,"requiredVariantIds":[...],
       "targetVariantIds":[...],"message":"Bundle saving"}\`
   Product variants use canonical gid://shopify/ProductVariant/ IDs.
6. Make sure \`requiredVariantIds\` contains the source and each mandatory
   add-on. Target IDs must be a subset (normally just add-ons).
7. Test checkout, cart removal, quantity changes, returns, stacked discounts,
   currency context and partial refunds on a DEVELOPMENT STORE only.
8. Enable only after confirming the total discount in Shopify checkout.

The prototype rejects missing/invalid/unsigned settings and doesn't consume
cart-line properties set by shoppers. It requires all mandatory variants to be
present before any discount is applied, and applies no more than 30%.

**Important:** a saved SmartStack set's bundleDiscountPercent is only a
preview preference. The app does NOT automatically deploy a Function or
convert that number into a checkout discount. Never display the previewed
saving as an active offer on the storefront until Function registration,
configuration and real checkout verification are complete.

Shopify references:
https://shopify.dev/docs/api/functions/2026-10/discount
https://shopify.dev/docs/apps/build/discounts/build-discount-function
