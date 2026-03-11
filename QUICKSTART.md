# ⚡ CRITICAL NEXT STEPS - DO THESE NOW

## 🔴 BLOCKERS TO TESTING (Must fix first)

### 1. Generate & Update Secrets in .env

Run in PowerShell:
```powershell
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Then update `.env`:
- Replace `SESSION_SECRET=your_session_secret_here_min_32_chars` with the first output
- Replace `ENCRYPTION_KEY=your_32_char_encryption_key` with the second output

### 2. Database Setup

You can either use PostgreSQL (the default) or switch to SQLite for quick
local development without installing a database server.

*If you choose SQLite set* `DATABASE_PROVIDER=sqlite` *and* 
`DATABASE_URL="file:./dev.db"` *in your `.env` file; Prisma will create the file
when you push the schema.*

#### PostgreSQL

Option A (Docker - easiest):
```powershell
# This creates PostgreSQL automatically
docker run --name smartstack-db -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres:latest
docker exec smartstack-db psql -U postgres -c "CREATE DATABASE smartstack;"
```

Option B (Existing PostgreSQL):
- Create database: `CREATE DATABASE smartstack;`

Then update `.env`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/smartstack
```

### 3. Clean Up Project Files

Delete these files/folders:
```powershell
# Delete duplicate Vite config
rm vite.config.js

# Delete old scaffolding folder
rm -r upsellsy/
```

### 4. Initialize Prisma & Database

```powershell
npm run prisma:generate
npm run prisma:push
```

---

## ✅ WHAT'S ALREADY DONE

- ✅ OAuth callback route created (`auth.$.tsx`)
- ✅ shopify.app.toml fixed (build dir = "build")
- ✅ Services implemented (shopify, campaigns, analytics)
- ✅ Database schema defined in Prisma
- ✅ Shopify credentials in .env

---

## 🎯 FINAL VERIFICATION STEPS

After completing the blockers above:

```powershell
# 1. Type check
npm run typecheck

# 2. Start dev server  
npm run dev
# Should see: "App is running on http://localhost:3000"

# 3. Open browser
# Visit http://localhost:3000
# Should see landing page with "Install App" button
```

---

## 🚀 READY TO TEST IN SHOPIFY

Once the above works, run:

```powershell
shopify app dev
```

This will:
- Start your dev server
- Create a secure tunnel to Shopify
- Show QR code to scan on your dev store
- Watch for file changes

---

## 🐛 COMMON ISSUES & FIXES

| Issue | Solution |
|-------|----------|
| "Cannot find module" errors | Run `npm install` again |
| PostgreSQL connection refused | Make sure Docker is running: `docker start smartstack-db` |
| "No such table: Shop" | Run `npm run prisma:push` |
| Port 3000 already in use | Change port in vite.config.ts or kill process |
| Build errors | Run `rm -r build/` then try again |

---

## 📞 HELP COMMANDS

```powershell
# Check what's installed
npm list

# View database (if using Docker)
docker exec -it smartstack-db psql -U postgres -d smartstack

# Reset database
npx prisma migrate reset

# View logs
npm run dev -- --verbose
```

---

**✨ You're almost ready to test! Just need to complete the 4 blockers above.**

