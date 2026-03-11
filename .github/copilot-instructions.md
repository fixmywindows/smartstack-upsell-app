# SmartStack - Shopify Upsell App

## Project Overview
SmartStack is a Shopify app providing flexible upsell/cross-sell capabilities with manual and tag-based product selection, post-purchase upsells, and basic analytics.

**Tech Stack:**
- Backend: Node.js + Express
- Frontend: React (Remix)
- Database: PostgreSQL + Prisma ORM
- Extensions: Shopify Theme App Extensions (Liquid)
- Styling: Tailwind CSS
- Hosting: Vercel or Render

**Architecture Reference:** See attached `04-architecture.md` and `03-mvp-plan.md`

## Development Guidelines

### Folder Structure
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
├── scripts/                      # Build & deployment scripts
└── package.json
```

### Key Technology Decisions
1. **Remix SSR** - Server-side rendering for admin UI
2. **Theme App Extensions** - Native, <100ms load time
3. **Prisma ORM** - Type-safe database access
4. **Shopify Webhooks** - Real-time data sync
5. **Flat-rate pricing** - No revenue share

### Database Models
- Shop (installed stores)
- Campaign (upsell offers)
- Analytics (daily stats)
- Settings (store configuration)

### API Endpoints (to implement)
- `/api/campaigns` - CRUD operations
- `/api/products/search` - Product search
- `/api/analytics` - Analytics data
- `/auth/callback` - OAuth callback
- `/webhooks` - Shopify webhooks

### Environment Variables (Required)
- SHOPIFY_API_KEY
- SHOPIFY_API_SECRET
- DATABASE_URL (PostgreSQL)
- APP_URL
- ENCRYPTION_KEY

## Build Order (Priority)
1. Database schema (Prisma)
2. OAuth utilities
3. Shopify API client
4. Campaign CRUD API
5. Admin UI components
6. Theme extensions
7. Webhook handlers
8. Analytics dashboard

## Testing & Quality
- Verify OAuth flow works
- Test manual product selection
- Test tag-based rules
- Validate theme extension loading
- Check analytics tracking
- Performance: <100ms for extensions, <1s for admin pages

## References
- Market Research: `01-market-research.md`
- App Concept: `02-app-ideas.md`
- MVP Plan: `03-mvp-plan.md`
- Architecture: `04-architecture.md`
