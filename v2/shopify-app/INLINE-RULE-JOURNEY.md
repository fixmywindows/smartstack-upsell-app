# SmartStack IF → THEN Merchandising Studio

Development branch: a visual admin UX upgrade and new multi-set storefront allocation,
not a production/App Store release.

## Intended merchant journey

1. Open SmartStack → Recommendation rules. Keep the four tabs (Similar,
   Complementary, Bought together, Complete the set).
2. Each saved set is one IF → THEN row, with a compact condition summary,
   thumbnail previews, enable/pause, Edit rule, Preview, Duplicate and Archive.
3. Choose Add IF → THEN row. A draft appears directly in the tab, expanded
   for inline editing rather than requiring navigation into a long form.
4. Configure the IF side:
   - ALL source products
   - Select individual source products by name and image
   - Match title, tag, type, category, vendor, collection, availability or
     supported metafields using operators such as contains, starts with,
     ends with, equals, does not contain, etc.
   - Add multiple rules and logical groups. Use ALL/ANY within each group
     and ALL/ANY across groups.
5. Configure the THEN side:
   - Use catalogue-based automatic matching, manually selected products,
     or a hybrid of both.
   - Constrain eligible products using title/tag/category/metafield
     conditions (AND/OR groups).
   - Set a contribution allowance for that row, e.g. 3 products.
6. Set rule priority and the fallback policy when a row has no eligible
   products. Exclusions and other rarer controls remain available from
   Advanced settings; inline saving preserves those values.
7. Preview **the combined storefront block** before publishing.
   Preview shows actual row contributions in order and a visual eight-slot bar.
   A row-specific preview still works, even for saved drafts.

## Important: one block combines recommendations across rows

The storefront no longer stops after the first successful set.

Example: Similar Products block maximum 8:

| Priority | Trigger | Candidate rule | Per-row limit | Contribution |
|---|---|---|---:|---:|
| 10 | tag starts with "snow" | title contains "all mountain" | 3 | 3 |
| 20 | category equals "snowboards" | metafield spec.level = "intermediate" | 3 | 3 |
| 30 | all products | auto catalogue suggestions | 2 | 2 |
| **TOTAL** | | | | **8 in one block** |

The algorithm evaluates active rows in priority order, caps each row by its
own maxItems and remaining block slots, applies hard exclusions/availability,
and de-duplicates selected product IDs across all contributing rows.
If a row has fewer eligible products than its allowance, subsequent rows can
fill the remaining slots. If a matching row has zero eligible products
and fallbackMode=stop, no later rows are evaluated.

**Bundles:** eight products includes the source product, so at most seven
recommended add-ons are possible across contributing rows.

The Shopify theme app block's Maximum recommendations control must be set to
8 to allow an eight-product combined recommendation shelf. Pre-existing theme
blocks may still have their old saved smaller limit; changing the code does not
automatically change settings already saved in Shopify themes.

## Design

The admin workspace has a recognisable purple/teal IF → THEN visual hierarchy,
a limited motion system, soft gradient backgrounds, card-hover effects,
animated capacity slots, thumbnail product pickers and responsive columns.
Respects prefers-reduced-motion. UI styles are namespaced to the embedded
admin and don't modify storefront CSS.

## Pricing and technical safeguards

- Free: 3 saved rows per recommendation type and 3 matching conditions per row.
- Growth (£15 proposed): 10 rows per type, 10 conditions per row.
- Insights (£45 proposed): unlimited (subject to production safety limits).
- Existing imported defaults use one set slot, not an additional hidden quota.
- Paid billing, commission attribution and live discounts are still disabled.
- Server authenticates shop and checks plan limits for creates/updates.
- Per-row quotas and total block caps are enforced by the server, not UI alone.
- The app proxy does not receive or expose merchant diagnostic traces.
- The upgraded UI saves to existing RecommendationRuleSet fields. **No database
  migration** or new product sync is required if the latest Phase 3 version is
  already installed.
- Historical rule sets remain in Neon; this is additive presentation and
  recommendation-routing work. The old full editor is still available.

## Development verification

- Unit tests for 3+3+2 allocation, duplicate suppression, per-set limits,
  bundle source + 7 add-ons, draft isolation and fallback stop.
- Regression checks for case-insensitive starts/ends rule operators.
- Inline admin tests covering both sides of IF → THEN, plan boundaries,
  preservation of advanced exclusions, visual/accessibility basics.
- Existing Phase 1-3 application build and temporary PostgreSQL migration
  checks should stay green.

## First hands-on test in Shopify

Use only the Cross Sell development store and preferably a draft theme.

1. In Similar Products, create a draft row, set IF tag contains "snow",
   THEN title starts with "Snow", limit 3, priority 10.
2. Create another row with THEN category equals "snowboards", limit 3,
   priority 20. Choose rules that yield distinct products.
3. Set the existing all-products fallback's max contribution to 2
   and priority to 100; activate the new rows.
4. Select a product with enough distinct eligible matches in
   SmartStack Preview. Confirm contribution trace is 3 + 3 + 2
   (subject to availability and de-duplication).
5. Open the theme editor. Set Similar Products maximum to 8.
6. Confirm ONE Similar Products widget contains the combined shelf of
   no more than eight unique products. On a bundle test, verify no more
   than seven add-ons plus the current product.
7. Test mobile and screen-reader/keyboard interactions.

Semantic AI and observed co-purchases are not yet implemented. Matching
uses catalogue rules and deterministic attribute scoring; avoid claiming
purchase-history correlations when they have not been measured.
