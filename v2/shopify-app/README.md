# SmartStack v2 — Windows standalone development setup

**Use this folder as a standalone project.** The original SmartStack monorepo contains an older Remix/React Router 6 app and Tailwind/PostCSS configuration. Running `v2/shopify-app` **inside the original repository** can cause Vite to resolve `../../node_modules/react-router-dom` (v6) against React Router v7, crash the local app, and produce ngrok `ERR_NGROK_8012`. Do not install Tailwind to workaround the dependency conflict.

## Move a linked, working development copy without losing configuration

Stop the Shopify CLI server using Ctrl+C. Keep the shop configuration and the private local `.env` file, but don't copy generated caches/dependencies.

From **inside** the original `v2/shopify-app` directory, run PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\Projects\smartstack-v2" | Out-Null
robocopy . "$env:USERPROFILE\Projects\smartstack-v2" /E /XD node_modules .shopify .react-router build .vercel /XF package-lock.json
cd "$env:USERPROFILE\Projects\smartstack-v2"
npm install
npm run typecheck
```

In VS Code open **File > Open Folder** and choose `C:\Users\<username>\Projects\smartstack-v2`. Do not open the ancestor monorepo for this app anymore. `shopify.app.toml` preserves the newly linked **SmartStack v2 Dev** client ID, and `.env` preserves the Neon connection. Never commit or share `.env`.

Start an ngrok tunnel in terminal 1. Explicit IPv4 avoids ngrok trying the IPv6 localhost address:

```powershell
# If the Shopify proxy listens on IPv6 (::1), as in the Cross Sell test setup:
ngrok http "http://[::1]:3000" --url "https://YOUR-NGROK-DOMAIN.ngrok-free.dev"
```

Start Shopify CLI in terminal 2 (replace with your actual ngrok HTTPS hostname):

```powershell
shopify app dev --store cross-sell-361.myshopify.com --tunnel-url=https://YOUR-NGROK-DOMAIN.ngrok-free.dev:3000
```

After the server is ready, press `p` in terminal 2 to open the Shopify preview. Keep both running. A brief 8012 while the app starts is expected, but it must disappear once the CLI's development server is ready.

### If the problem persists

- If `npm run typecheck` fails: copy the first errors (no credentials).
- If React Router 6 reappears: run `npm ls react-router react-router-dom` from the standalone directory and inspect the versions.
- If ngrok continues to show 8012 after the server is ready: test `http://127.0.0.1:3000` locally and inspect the CLI errors; do not troubleshoot the tunnel before the app starts.
- Do not run `shopify app deploy`, do not enable billing, and do not edit a live shop for this dev build.

Database migrations, catalogue snapshots and saved recommendation rules are in Neon and survive moving the local folder.


## Phase 1: Multiple recommendation sets (Free 3 / Growth 10 / Insights unlimited)

The new admin has four tabs: Similar Products, Complementary, Bought Together and Complete the Set.
Each contains **named rule sets** with product thumbnails, targeting conditions, pinned products,
priority, status and preview. Merchants can duplicate, pause and archive a set. Archived sets
do not use the plan limit. New sets are drafts until activated.

The database migration \`20261015220000_recommendation_rule_sets\` is **additive**:
it creates a new rule-set table, adds a default Free plan, and copies existing
\`RecommendationBlock\` records to one editable default set per type. The old
records, products and Shopify sessions are not deleted or rewritten.

### Updating a running development copy

1. Stop the Shopify development server with Ctrl+C. Keep your private \`.env\`,
   linked \`shopify.app.toml\` and stored Neon data intact.
2. Copy the updated source code from the Phase 1 feature branch; do not
   overwrite \`.env\`, \`shopify.app.toml\`, or your old theme backups.
3. **Before** starting Shopify again, run the migration and generation commands:

\`\`\`powershell
npx prisma migrate deploy
npx prisma generate
npx react-router typegen
npx tsc --noEmit
\`\`\`

4. Restart Shopify using your existing working tunnel and development store.

The GitHub Actions build checks the migration on a temporary PostgreSQL
database populated with an old recommendation block, asserting that
legacy pins, exclusions and OR conditions survive. The real Neon database
is NOT migrated by committing the code; \`prisma migrate deploy\` must still
run against the developer's configured environment.

### Plan and product semantics

- Free: 3 sets per type; Growth: 10; Insights: unlimited. Existing
  default sets count against these limits.
- Proposed condition limits for early testing: 3 (Free), 10 (Growth),
  unlimited (Insights). These can be revised before paid plans launch.
- Shopify Billing is **not** implemented. Stores default to Free; no
  upgrade is granted without verified subscription entitlement.
- Priorities: 1 is highest. A matching enabled set outranks a more general
  fallback set (priority 100). Availability and exclusions always override pins.
- Images, titles and price in the picker come from the authenticated
  shop's cached product catalogue. Product search is server-side and
  scoped to the installed shop. For changes to Shopify products,
  refresh the catalogue in SmartStack.
- Automatic matching is still attribute-based heuristics, **not connected
  semantic AI**. Bought Together cannot claim observed sales without
  reliable purchase-history evidence.
- Real bundle discounts, commission attribution and billing remain disabled.
