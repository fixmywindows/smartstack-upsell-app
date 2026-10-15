# Phase 2 — Visual rules and fallback testing

This is a development-only release. It does not connect new AI models,
charge commissions, enable subscription billing or apply checkout discounts.

## Merchant workflow

Open SmartStack → Recommendation sets → the appropriate recommendation type.

1. Edit a named set or create a draft. Start with the setting that controls
   which source products can trigger it.
2. Add condition groups. Within each group choose ALL or ANY conditions.
   If there are multiple groups, choose whether ALL or ANY groups must match.
   Supported attributes include title, tags, product type, category, collection,
   vendor, price, availability and available metafields.
3. Choose automatic catalogue matching, handpicked products, or hybrid.
   Candidate filters restrict all results, including manually pinned items.
4. Advanced exclusions can remove individual products or exclude candidates
   matching grouped conditions. Exclusions always override manual pins.
5. Smaller priority numbers win. With equal priority, specific selected
   products win over grouped conditions, which win over all-products sets.
6. If a matching set finds zero eligible products, it can either try the next
   matching set or stop without displaying recommendations.
7. Save the set, then click its Preview link. You can preview a paused draft
   without activating it on the storefront. The preview page shows every
   considered set and why it matched, skipped or fell back.

## Test scenarios

- Build a snowboard recommendation set: source category contains snowboards
  AND source tags contain winter. Change the group operators and preview.
- Add one manually pinned item, then exclude the same item explicitly.
  The excluded item must never appear.
- Create a high-priority manual set with every pinned product excluded.
  Set empty-match fallback to NEXT and confirm the default set supplies
  recommendations. Switch to STOP and verify no products appear.
- Select an inactive draft set in the admin preview. It must show simulated
  results, but the actual storefront must still use the active sets.
- Check that manually specified source products outrank all-product defaults
  when set priorities are equal.

## Compatibility and migrations

The Phase 2 migration adds only:
- excludedProductIds: JSON array, default empty
- excludeRules: JSON condition groups, default empty
- excludeLogic: group join mode, default OR
- fallbackMode: next or stop, default next

Original 17 synced products, Shopify sessions, saved rules and imported default
sets are not removed. Old Phase 1 flat rules remain readable and are converted
to a single group when edited.

GitHub CI includes unit tests for hard exclusions, nested rules, priorities,
admin-only draft simulations and deterministic fallbacks, and a temporary
PostgreSQL integration test for migration preservation.

The Free plan continues to have 3 sets per type, with 3 conditions per set.
Growth has 10 sets per type and 10 conditions per set. Insights has
unlimited sets/conditions, subject to future safeguards. The paid plans
remain proposals; no billing is enabled.

## Local upgrade

Do not overwrite shopify.app.toml, .env or your ngrok setup.
Stop Shopify's development process before updating local code.

After copying changed source files from the Phase 2 branch, run:

~~~powershell
npx prisma migrate deploy
npx prisma generate
npx react-router typegen
npx tsc --noEmit
node --test tests/phase2-rules.test.mjs
~~~

Then launch the Shopify development preview with the working tunnel.

Limitations: no unsaved set preview yet (save a draft first); the recommendation
engine is still catalogue-based and not semantic LLM AI; real sale attribution,
discount Functions and historical co-purchases remain future milestones.
