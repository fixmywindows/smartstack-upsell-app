# SmartStack — Admin home and attribute pickers refresh

Status: separate development branch for testing on Cross Sell. No billing,
checkout discounts, AI model connection or product recommendation semantics
were changed. No new Prisma migration is needed.

## Home screen

The new dashboard has a clearer progression:
- prominent Rule Builder and Preview actions
- actual product sync count, active set count and number of recommendation
  types configured
- store plan and rules per type (from server entitlement)
- three in-app milestones: catalogue synced, rules activated, design reviewed
- a relevant next-action link based on those milestones
- four recommendation-type navigation cards, showing real active/saved counts
- recently edited rule sets, linked directly to inline editing
- an explicitly labelled **example** of 3+3+2 recommendations filling one
  eight-product shelf

SmartStack does **not** know whether a storefront app block is currently
enabled and published in a Shopify theme. The dashboard explains that the
merchant must verify theme placement in Shopify's theme editor.
No revenue uplift or conversion metrics are fabricated.

## IF → THEN condition dropdowns

Both the regular inline editor and the Advanced Set Editor support:
- **Collection:** searchable Shopify collections by actual title, saving
  the handle that is used in the matching engine. Empty collections can
  be selected; assigning products to them still requires catalogue sync
  before SmartStack will match their product membership. If Shopify's
  admin API temporarily fails, cached handles from synced products remain
  available as a fallback.
- **Product tag:** searchable select from synced distinct product tags
- **Metafield key:** searchable select from namespaced keys such as
  "custom.level"
- **Metafield value:** searchable select of distinct observed values for
  the selected key, including elements from list-valued metafields
- **Product category/type/vendor:** dropdowns from synced products as well
- **Product title and numeric comparisons:** appropriate free-text/numeric
  inputs where entering a partial title or threshold is intentional

Selectors have a **Custom value** option, useful for partial starts-with
matches or newly created catalogue values. Previously saved rules are
preserved in the choices even when their values are not in a search page.

The options endpoint is authenticated to Shopify staff using
authenticate.admin(request) and scoped to the installed shop. Client code
cannot choose another shop ID. Tag/metafield options are computed directly
in PostgreSQL using parameterised JSONB queries, instead of loading all
products into the browser. Live Shopify collection results use the
Admin GraphQL collections query, with paging and a cap on results.

## Testing on the Cross Sell store

1. Open SmartStack Home. Check the catalogue count, active rules and plan,
   follow the "recommended next" call-to-action, and open a recent rule.
2. Go to Similar Products, open any rule and add an IF condition.
   Choose Collection → use search and select an actual Shopify collection.
3. Switch to Tag. Search your synced tags and select one.
4. Select Metafield, pick its key, and then choose one of its observed values.
   Verify list metafields expose the individual list elements.
5. Repeat in THEN conditions and in the Advanced Set Editor.
6. Save a draft and refresh. Make sure existing conditions persist.
7. Open the combined preview and verify the chosen values actually match
   products and the eight-product block allocation is unchanged.
8. Add/change a Shopify product tag, collection or metafield. Refresh the
   SmartStack catalogue. Then verify the choice appears in the selector.
9. Test keyboard-only interaction (search input → select), small screens and
   reduced motion.

## Safe upgrade

Update only changed app source files and tests. Do not replace your local
shopify.app.toml, .env, Prisma database or ngrok configuration.

Stop the local Shopify server, copy the source changes from the GitHub
development branch and run:

~~~powershell
npx react-router typegen
npx tsc --noEmit
node --test tests/attribute-pickers.test.mjs
~~~

Then restart your Shopify dev preview with your existing tunnel and
development store. No Prisma migrate or product re-sync is necessary
unless Shopify catalogue data itself changed.

## Future Phase 4

The next core-functionality phase is semantic/relevance improvements,
verified purchased-together signals, variant-aware recommendations and
discounted bundles. Those capabilities are separate from this admin UX
iteration and are not implied to be active yet.
