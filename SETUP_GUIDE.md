# SmartStack Setup Guide

## Step 1: Generate Required Secrets

Run these commands in PowerShell to generate secure secrets:

```powershell
# Generate SESSION_SECRET (32-byte hex string)
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (32-byte hex string)  
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output values and add them to your `.env` file.

---

## Step 2: Update .env File

Update your `.env` file with the values:

```env
# Shopify API (already configured)
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_API_SCOPES=write_products,read_products,write_orders,read_orders,write_customers,read_customers

# App Configuration
APP_URL=http://localhost:3000
APP_ENV=development
SESSION_SECRET=<paste output from command above>

# Database (update with your PostgreSQL details)
DATABASE_URL=postgresql://postgres:password@localhost:5432/smartstack

# Encryption
ENCRYPTION_KEY=<paste output from command above>

# Optional: Analytics
GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## Step 3: Set Up Database

You can either use PostgreSQL (recommended for production) or fall back to a lightweight
SQLite file for quick local development.

### Option A: PostgreSQL

#### Using Docker (recommended)

```powershell
# Start PostgreSQL in Docker
docker run --name smartstack-db -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres:latest

# Create database
docker exec smartstack-db psql -U postgres -c "CREATE DATABASE smartstack;"
```

#### Local PostgreSQL

1. Install PostgreSQL from https://www.postgresql.org/download/
2. Create a database:
   ```sql
   CREATE DATABASE smartstack;
   ```
3. Update DATABASE_URL in .env with your credentials

### Option B: SQLite (dev only)

If you don't want to run a Postgres server, use SQLite by setting
`DATABASE_PROVIDER=sqlite` and `DATABASE_URL="file:./dev.db"` in `.env`.
Prisma will create the file automatically when you push the schema.

### Option B: Local PostgreSQL

1. Install PostgreSQL from https://www.postgresql.org/download/
2. Create a database:
   ```sql
   CREATE DATABASE smartstack;
   ```
3. Update DATABASE_URL in .env with your credentials

---

## Step 4: Initialize Prisma & Database

```powershell
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run prisma:push
```

You should see output like:
```
✔ Your database is now in sync with your Prisma schema.
```

---

## Step 5: Verify Project Setup

```powershell
# Type check for errors
npm run typecheck

# If no errors, you're ready!
npm run dev
```

Visit `http://localhost:3000` - you should see the SmartStack landing page.

---

## Step 6: Test with Shopify CLI

```powershell
# Start the local development server with Shopify tunnel
shopify app dev

# This will:
# 1. Start your dev server
# 2. Create a tunnel to Shopify (no ngrok setup needed)
# 3. Show a QR code to install on your dev store
# 4. Watch for file changes and rebuild
```

Scan the QR code on your Shopify development store to install the app.

---

## Step 7: Testing the OAuth Flow

1. After scanning QR code, you should be redirected to your app
2. OAuth callback will:
   - Exchange authorization code for access token
   - Save Shop record in database
   - Redirect to dashboard
3. Check database to verify Shop was created:
   ```sql
   SELECT * FROM "Shop";
   ```

---

## Troubleshooting

### PostgreSQL Connection Refused
```powershell
# Check if PostgreSQL/Docker is running
docker ps | findstr smartstack-db

# If not running:
docker start smartstack-db

# Check DATABASE_URL format
# postgresql://username:password@host:port/database
```

### Database Already Exists
```powershell
# Drop and recreate
npx prisma migrate reset

# Then run migrations again
npm run prisma:push
```

### Build Directory Issues
```powershell
# Clean and rebuild
rm -r ./build, ./node_modules/.vite
npm run build
```

### OAuth Callback URL Errors
- Ensure `APP_URL` in .env matches your tunnel URL
- For local testing, use `http://localhost:3000`
- When deploying to Vercel, update to your production URL

---

## Database Models Created

When you run `prisma:push`, these tables are created:

- **Shop** - Installed stores with OAuth tokens
- **Campaign** - Upsell campaigns
- **Analytics** - Daily campaign stats
- **Settings** - Per-store configuration

---

## Next: Create Your First Campaign

Once the app is installed:

1. Visit your app's dashboard
2. Click "Create Campaign"
3. Set up:
   - Campaign name (e.g., "Summer Bundle")
   - Trigger type (post-purchase or cart)
   - Product selection method (manual or tags)
   - Display settings (heading, button text, colors)
4. Enable and save

The campaign will appear on thank-you pages or cart based on trigger type.

---

## Documentation References

- [Remix Documentation](https://remix.run/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Shopify CLI Documentation](https://shopify.dev/docs/apps/tools/cli)
- [Shopify API Reference](https://shopify.dev/api)

