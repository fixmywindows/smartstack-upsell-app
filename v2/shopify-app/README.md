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
ngrok http 127.0.0.1:3000
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
