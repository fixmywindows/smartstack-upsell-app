# SmartStack - Shopify Upsell App

A flexible upsell/cross-sell app for Shopify stores with manual and tag-based product selection, post-purchase upsells, and analytics.

## Quick Start

### Prerequisites
- Node.js 18.x or 20.x
- PostgreSQL database
- Shopify Partner account
- A Shopify development store

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your values.  For simple local development you can use SQLite instead of PostgreSQL by setting `DATABASE_PROVIDER=sqlite` and pointing `DATABASE_URL` at a file (e.g. `file:./dev.db`).
   ```env
   SHOPIFY_API_KEY=your_api_key
   SHOPIFY_API_SECRET=your_api_secret
   # either postgresql://user:password@localhost:5432/smartstack
   # or for SQLite:
   # DATABASE_PROVIDER=sqlite
   # DATABASE_URL="file:./dev.db"
   APP_URL=https://your-app-url.vercel.app
   SESSION_SECRET=your_session_secret_here_min_32_chars
   ENCRYPTION_KEY=your_32_char_encryption_key
   ```

3. **Set up the database**
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:3000`

## Project Structure

```
smartstack/
├── app/                          # Remix app (Admin UI)
│   ├── routes/                   # Page routes
│   ├── components/               # React components
│   ├── services/                 # Business logic services
│   ├── utils/                    # Utility functions
│   └── styles/                   # Tailwind CSS
├── prisma/
│   └── schema.prisma             # Database schema
├── extensions/                   # Theme App Extensions
│   ├── blocks/                   # Liquid blocks
│   └── assets/                   # CSS/JS assets
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server with Vite
- `npm run build` - Build for production
- `npm run prisma:migrate` - Create database migration
- `npm run prisma:push` - Push schema changes to database
- `npm run prisma:generate` - Generate Prisma client
- `npm run typecheck` - Run TypeScript type checker
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Key Routes

- `/` - Landing page
- `/dashboard` - Main dashboard
- `/campaigns` - Manage campaigns
- `/campaigns/new` - Create new campaign
- `/analytics` - View analytics
- `/settings` - App settings
- `/webhooks` - Webhook receiver

## Database Models

### Shop
Represents an installed Shopify store
- `shopifyDomain` - Store domain
- `accessToken` - OAuth access token
- `plan` - Pricing plan (free/growth/scale)

### Campaign
An upsell offer
- `name` - Campaign name
- `triggerType` - When to show (post_purchase/cart)
- `selectionMethod` - How to select products (manual/tags)
- `products` - Selected product IDs
- `enabled` - Campaign active status

### Analytics
Daily campaign statistics
- `views` - Number of times upsell was shown
- `conversions` - Number of conversions
- `revenue` - Revenue generated

### Settings
Per-store configuration
- `timezone` - Store timezone
- `currency` - Store currency
- `email` - Contact email

## Development

### Adding a New Route

1. Create a file in `app/routes/`
2. Export default component and meta function
3. Add loader/action functions as needed

### Adding a Service

1. Create file in `app/services/`
2. Export functions that interact with database/external APIs
3. Import in routes/components as needed

### Theme Extensions

Theme extensions are built with Liquid and stored in `extensions/blocks/`. They are mounted in Shopify themes directly.

## Security

- All API keys and secrets should be in `.env` (not committed)
- Access tokens are encrypted before storage
- Webhook signatures are verified
- CSRF protection is built into Remix

## Performance

- Theme App Extensions load in <100ms
- Admin pages optimized with Remix SSR
- Database queries use indexes on shopId and campaignId
- Caching strategies for product data

## Testing

1. Create a Shopify development store
2. In Shopify admin, install your app from the Partners dashboard
3. Test OAuth flow and campaign creation
4. Verify webhooks in Shopify admin

## Deployment

### Vercel
```bash
npm install -g vercel
vercel
```

### Render
```bash
# Push to GitHub, then connect repo to Render
# Configure environment variables in Render dashboard
```

## Production Checklist

- [ ] Set up PostgreSQL database
- [ ] Configure Shopify API credentials
- [ ] Set up encryption for access tokens
- [ ] Configure webhooks in Shopify
- [ ] Test OAuth flow
- [ ] Test campaign creation and editing
- [ ] Test theme extensions on multiple themes
- [ ] Monitor performance and errors
- [ ] Set up analytics
- [ ] Document support process

## References

- [Remix Documentation](https://remix.run)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Shopify API Reference](https://shopify.dev)
- [Tailwind CSS](https://tailwindcss.com)

## License

Private - SmartStack

## Support

For issues and questions, contact: support@smartstack.app
