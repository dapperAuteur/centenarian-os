# CentenarianOS

A comprehensive personal operating system for executing multi-decade, multi-disciplinary goals through data-driven daily action.

## Vision

CentenarianOS connects long-term ambitions to daily execution through an integrated platform covering planning, nutrition, fitness, focus, finances, travel, and learning — all offline-first, privacy-focused, and tied together by cross-module analytics.

## Architecture

**Modular Monolith** built with:
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Real-time subscriptions + RLS)
- **Offline**: IndexedDB with background sync queue
- **Auth**: Supabase Auth (email/password + Cloudflare Turnstile bot prevention)
- **Payments**: Stripe (monthly subscription, lifetime access, teacher payouts via Stripe Connect) + CashApp (lifetime only)
- **AI**: Google Gemini (recipe ideas, weekly review summaries, CYOA embeddings, OCR, pay stub scanning)
- **State**: React hooks + Supabase real-time

## Pricing

| Plan | Price | Notes |
|------|-------|-------|
| **Monthly** | $10.60/month | Full access, cancel anytime |
| **Lifetime (Founder's Price)** | $103.29 one-time | First 100 paid users. Includes free shirt. |
| **Lifetime via CashApp** | $100 to $centenarian | Fee-free alternative. Manual verification. |
| **Teacher Plan** | Separate pricing | 10% platform fee on course sales |

No free plan. All users must subscribe to access paid modules.

## Platform Modules

| Module | Description | Access |
|--------|-------------|--------|
| **Planner** | Roadmap, Goals, Milestones, Tasks hierarchy with week/3-day/daily views | Paid |
| **Fuel** | Nutrition tracking with NCV framework, USDA/Open Food Facts APIs, auto inventory | Paid |
| **Engine** | Pomodoro focus sessions, doodle canvas, daily debrief, AI weekly reviews | Paid |
| **Health Metrics** | RHR, steps, sleep, body composition; Garmin/Oura/WHOOP sync; CSV import | Paid |
| **Workouts & Exercises** | Exercise library with categories; workout templates; Nomad Longevity OS | Paid |
| **Financial Dashboard** | Accounts, transactions, budgets, invoices, bank linking via Teller | Paid |
| **Travel & Vehicles** | Fuel logs with OCR, trip tracking, multi-stop routes, maintenance, IRS mileage | Paid |
| **Equipment & Assets** | Asset tracking, valuation history, media gallery, cross-module links | Paid |
| **Correlations & Analytics** | Cross-module data correlations, trend charts, daily/weekly aggregates | Paid |
| **Data Hub** | CSV import/export for 12+ modules with Google Sheets templates | Paid |
| **Life Categories** | Tag activities across all modules with custom life-area categories | Paid |
| **Media Tracker** | Books, TV, movies, podcasts with notes and episode linking | Paid |
| **Academy (LMS)** | Create/sell courses; CYOA navigation; quizzes, maps, docs, audio, video | Free |
| **Blog** | Rich text publishing, likes/saves, public author profiles | Free |
| **Recipes** | Recipe sharing, URL import, cook profiles, JSON-LD scraping | Free |
| **Cross-Module Links** | Bidirectional activity links, saved contacts/locations across all modules | Paid |
| **AI Coach (Gems)** | Custom AI personas with document/flashcard support | Admin |

## Admin Dashboard

- **User management**: subscription filters, invite system with module restrictions
- **Promo campaigns**: create time-limited discounts with Stripe coupon integration
- **CashApp payments**: review queue for manual lifetime payment verification
- **Lifetime counter**: track paid vs gifted lifetime purchases (Founder's Price: first 100)
- **Content moderation**: recipes, blog posts, feedback, system logs
- **Academy settings**: teacher fee (10%), course management, assignment grading
- **Engagement metrics**: feature usage, conversion funnels, SEO, shortlinks
- **AI Education chat**: codebase Q&A with 5 modes (interview, investor, onboarding, demo, general)

## Quick Start

### Prerequisites

- Node.js 18+
- npm / yarn / pnpm
- Supabase account ([supabase.com](https://supabase.com))
- Stripe account (for subscription features)

### Installation

```bash
# Clone repo
git clone https://github.com/dapperAuteur/centenarian-os.git
cd centenarian-os

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_MONTHLY_PRICE_ID=
STRIPE_LIFETIME_PRICE_ID=
ADMIN_EMAIL=
NEXT_PUBLIC_ADMIN_EMAIL=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
```

### Database Setup

```bash
# Option A: Supabase CLI
supabase db push

# Option B: SQL Editor in Supabase Dashboard
# Run migrations in order from supabase/migrations/
```

There are 173+ migrations. Run them in numeric order. The database is shared with the ContractorOS (Work.WitUS) app.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
centenarian-os/
├── app/                        # Next.js App Router
│   ├── api/                   # API route handlers
│   │   ├── cashapp/           # CashApp payment submission
│   │   ├── exercises/         # Exercise library CRUD
│   │   ├── finance/           # Finance APIs
│   │   ├── fuel/              # Nutrition APIs
│   │   ├── health-metrics/    # Metrics APIs
│   │   ├── planner/           # Planner APIs
│   │   ├── pricing/           # Public pricing data (founders, promos)
│   │   ├── stripe/            # Checkout, webhooks, sync, portal
│   │   ├── travel/            # Travel & vehicle APIs
│   │   ├── workouts/          # Workout logging APIs
│   │   └── ...                # 20+ more endpoint groups
│   ├── admin/                 # Admin dashboard (20+ pages)
│   ├── dashboard/             # Protected dashboard pages (15+ modules)
│   ├── academy/               # LMS (courses, lessons, DMs, paths)
│   ├── blog/                  # Community blog
│   ├── recipes/               # Recipe sharing
│   └── pricing/               # Public pricing page
├── components/                # React components
│   ├── admin/                 # AdminSidebar, admin UI
│   ├── exercises/             # Exercise library UI
│   ├── finance/               # Finance UI
│   ├── focus/                 # DoodleCanvas, timer, templates
│   ├── nav/                   # Navigation (DesktopNav, MobileDrawer, NavConfig)
│   ├── workouts/              # Workout UI
│   └── ui/                    # Shared UI (Modal, HelpDrawer, DataImporter, etc.)
├── lib/
│   ├── hooks/                 # useAuth, useSubscription, useClockFormat, etc.
│   ├── contexts/              # SyncContext (offline)
│   ├── stripe/                # Stripe client singleton
│   ├── shopify/               # Promo code generation
│   └── supabase/              # Server & client Supabase clients
├── content/tutorials/         # 15+ tutorial course scripts
├── public/templates/          # CSV import templates (10+ modules)
└── supabase/
    └── migrations/            # 173+ database migrations
```

## Security

- **Authentication**: Supabase Auth + Cloudflare Turnstile on signup
- **Authorization**: Row Level Security (RLS) on all tables
- **Data Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Subscription gating**: Server-side and client-side access control
- **Admin guard**: ADMIN_EMAIL env var check on all admin routes

Report vulnerabilities: [security@awews.com](mailto:security@awews.com)

## Roadmap

See the live [Tech Roadmap](https://centenarianos.com/tech-roadmap) for the full feature timeline.

**Shipped phases:**
- [x] Phase 1: Core infrastructure, auth, subscriptions, admin
- [x] Phase 2: Nutrition & Recipes (Fuel module)
- [x] Phase 3: Publishing Platform (Blog & Community)
- [x] Phase 4: Centenarian Academy (LMS) — 100+ features
- [x] Phase 5: Travel & Vehicle Tracking
- [x] Phase 7: Demo Accounts & Onboarding
- [x] Phase 10: Financial Dashboard
- [x] Phase 11: Equipment & Asset Tracking
- [x] Phase 12: Cross-Module Connections
- [x] Phase 14: CashApp Payments & Promo Campaigns

**In progress:**
- [ ] Phase 6: Focus Engine & AI Insights — correlation analysis remaining
- [ ] Phase 9: Biometrics & Recovery — HRV, sleep deep-dive
- [ ] Phase 13: User Experience & Personalization

**Planned:**
- [ ] Phase 8: Link Tracking & Marketing Analytics (Switchy.io)
- [ ] Phase 15: Periodic Reviews (Month/Quarter/Year in Review)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow and coding standards.

## License

MIT License — see [LICENSE](./LICENSE)

## Acknowledgments

Built with [Next.js](https://nextjs.org/), [Supabase](https://supabase.com/), [Tailwind CSS](https://tailwindcss.com/), [Stripe](https://stripe.com/), [Google Gemini](https://ai.google.dev/), [Cloudinary](https://cloudinary.com/), [Excalidraw](https://excalidraw.com/)

---

**Status**: Active Development | **Version**: 0.5.0
