# CentenarianOS

A comprehensive personal operating system for executing multi-decade, multi-disciplinary goals through data-driven daily action.

## 🎯 Vision

CentenarianOS connects long-term ambitions to daily execution through an integrated platform covering planning, nutrition, fitness, focus, finances, travel, and learning — all offline-first, privacy-focused, and tied together by cross-module analytics.

## 🏗️ Architecture

**Modular Monolith** built with:
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Real-time subscriptions + RLS)
- **Offline**: IndexedDB with background sync queue
- **Auth**: Supabase Auth (email/password + Cloudflare Turnstile bot prevention)
- **Payments**: Stripe (monthly subscription, lifetime access, teacher payouts via Stripe Connect)
- **AI**: Google Gemini (recipe ideas, weekly review summaries, CYOA embeddings, OCR)
- **State**: React hooks + Supabase real-time

## 📦 Platform Modules

| Module | Description | Access |
|--------|-------------|--------|
| **Planner** | Roadmap → Goals → Milestones → Tasks hierarchy with week/3-day/daily views | Paid |
| **Fuel** | Nutrition tracking with NCV framework, USDA/Open Food Facts APIs, auto inventory | Paid |
| **Engine** | Pomodoro focus sessions, daily debrief, body/pain check, AI weekly reviews | Paid |
| **Health Metrics** | RHR, steps, sleep, body composition; Garmin/Oura/WHOOP sync; CSV import | Paid |
| **Workouts & Exercises** | Exercise library with categories; workout templates; log sets/reps/weight | Paid |
| **Financial Dashboard** | Accounts, transactions, budgets, brand P&L, invoices with custom fields | Paid |
| **Travel & Vehicles** | Fuel logs with OCR, trip tracking, bike savings, maintenance, IRS mileage log | Paid |
| **Equipment & Assets** | Asset tracking, valuation history, cross-module activity links | Paid |
| **Correlations & Analytics** | Cross-module data correlations, trend charts, daily/weekly aggregates | Paid |
| **Data Hub** | CSV import/export for 12+ modules with Google Sheets templates | Paid |
| **Academy (LMS)** | Create/sell courses; CYOA navigation; quizzes, maps, docs, audio, video | Free |
| **Blog** | Rich text publishing, likes/saves, public author profiles | Free |
| **Recipes** | Recipe sharing, URL import, cook profiles, JSON-LD scraping | Free |
| **Cross-Module Links** | Bidirectional activity links, saved contacts/locations across all modules | Paid |
| **AI Coach (Gems)** | Custom AI personas with document/flashcard support (admin) | Admin |

## 🚀 Quick Start

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
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
GEMINI_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Database Setup

```bash
# Option A: Supabase CLI
supabase db push

# Option B: SQL Editor in Supabase Dashboard
# Run migrations in order from supabase/migrations/
```

There are 84+ migrations. Run them in numeric order.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
centenarian-os/
├── app/                        # Next.js App Router
│   ├── api/                   # API route handlers
│   │   ├── exercises/         # Exercise library CRUD
│   │   ├── finance/           # Finance APIs
│   │   ├── fuel/              # Nutrition APIs
│   │   ├── health-metrics/    # Metrics APIs
│   │   ├── planner/           # Planner APIs
│   │   ├── travel/            # Travel & vehicle APIs
│   │   ├── workouts/          # Workout logging APIs
│   │   ├── user/preferences/  # Dashboard preference API
│   │   └── ...                # 15+ more endpoint groups
│   ├── dashboard/             # Protected dashboard pages
│   │   ├── planner/           # Daily tasks & roadmap
│   │   ├── fuel/              # Nutrition module
│   │   ├── engine/            # Focus & debrief
│   │   ├── metrics/           # Health metrics & trends
│   │   ├── workouts/          # Workout logs
│   │   ├── exercises/         # Exercise library
│   │   ├── finance/           # Financial dashboard
│   │   ├── travel/            # Travel & vehicles
│   │   ├── equipment/         # Asset tracking
│   │   ├── correlations/      # Analytics
│   │   ├── data/              # Data Hub import/export
│   │   ├── settings/          # User preferences
│   │   └── ...                # More pages
│   ├── academy/               # LMS (courses, lessons)
│   ├── blog/                  # Community blog
│   ├── recipes/               # Recipe sharing
│   └── page.tsx               # Public landing page
├── components/                # React components
│   ├── exercises/             # Exercise library UI
│   ├── finance/               # Finance UI
│   ├── nav/                   # Navigation (DesktopNav, MobileDrawer, NavConfig)
│   ├── workouts/              # Workout UI
│   └── ui/                    # Shared UI components
├── lib/
│   ├── hooks/                 # useAuth, useSubscription, etc.
│   ├── contexts/              # SyncContext (offline)
│   └── supabase/              # Server & client Supabase clients
└── supabase/
    └── migrations/            # 84+ database migrations
```

## 🔒 Security

- **Authentication**: Supabase Auth + Cloudflare Turnstile on signup
- **Authorization**: Row Level Security (RLS) on all tables
- **Data Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Subscription gating**: Server-side and client-side access control

Report vulnerabilities: [security@awews.com](mailto:security@awews.com)

## 🛣️ Roadmap

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

**In progress:**
- [ ] Phase 6: Focus Engine & AI Insights — correlation analysis remaining
- [ ] Phase 9: Biometrics & Recovery — HRV, sleep deep-dive
- [ ] Phase 13: User Experience & Personalization

**Planned:**
- [ ] Phase 8: Link Tracking & Marketing Analytics (Switchy.io)

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow and coding standards.

## 📄 License

MIT License — see [LICENSE](./LICENSE)

## 🙏 Acknowledgments

Built with [Next.js](https://nextjs.org/), [Supabase](https://supabase.com/), [Tailwind CSS](https://tailwindcss.com/), [Stripe](https://stripe.com/), [Google Gemini](https://ai.google.dev/), [Cloudinary](https://cloudinary.com/)

---

**Status**: Active Development | **Version**: 0.4.0
