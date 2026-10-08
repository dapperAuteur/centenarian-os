# CentenarianOS

> **One job: the longevity correlation engine over your personal data.** Health, habits, focus,
> nutrition and personal finance are co-located in one datastore so the synthesis surfaces
> ([`/dashboard/correlations`](./app/dashboard/correlations), [`/dashboard/retrospective`](./app/dashboard/retrospective),
> [`/dashboard/weekly-review`](./app/dashboard/weekly-review)) can surface cross-domain patterns no
> single-vertical tracker can see. That co-location is the product, not an accident of scope.

> **Solo-built personal OS.** 14 modules in one Next.js 15 monolith, **Supabase Postgres shared with a sibling product** ([Work.WitUS](https://work.witus.online); a split is planned, not done), offline-first via service-worker + IndexedDB queue, **225 migrations** to date.

**Actively decomposing.** Modules that a sibling WitUS app already owns are being removed under
the ecosystem's "one app, one job" rule (see [CLAUDE.md](./CLAUDE.md)) — Media → Stream.WitUS,
Academy → Learn.WitUS, contractor residue → Work.WitUS, Travel → RideWitUS. The correlation core
stays integrated on purpose. The staged plan and the ecosystem registry live in the untracked
`plans/` working area (`plans/49-decomposition-staged-plan.md`, `plans/ecosystem/README.md`).

- **Stage 1, Media → [Stream.WitUS](https://stream.witus.online): in progress.** Media is out of
  the nav, Data Hub, Discover, and the features pages; `/features/media` 308-redirects to
  Stream.WitUS (`next.config.mjs`). `/dashboard/media` stays reachable by URL, read-only with no
  add/edit/delete controls, and its banner's primary action is the CSV export
  (`/api/media/export`), the file users import on Stream.WitUS's media page. Every media write route returns `410 Gone`
  ([`lib/media/retired.ts`](./lib/media/retired.ts)). Pages and routes are removed after a grace
  period; the tables stay until a later stage.

Module lists below describe the pre-decomposition surface, minus Media.

```mermaid
flowchart LR
  classDef shared fill:#1e1e2e,stroke:#fab387,color:#fab387,stroke-width:3px
  classDef external fill:#11111b,stroke:#a6adc8,color:#a6adc8

  CentOS[centenarian-os<br/>Next.js 15 · Vercel<br/>14 modules]
  Contractor[contractor-os<br/>Work.WitUS]
  DB[(Supabase Postgres<br/>225 migrations)]:::shared

  CentOS -->|service-role + publishable| DB
  Contractor -->|service-role + publishable| DB
  Contractor -->|signed events: income, work schedule| CentOS
```

For dev-audience readers:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — full module map, the shared-DB boundary, how cross-app data is moving to signed events ahead of a planned split, offline-sync layer, repo layout, and stack table.
- **[MIGRATIONS.md](./MIGRATIONS.md)** — 225 migrations grouped by module, the additive-only discipline that makes shared-DB sane, notable patterns (polymorphic `activity_links`, hot-fix pairs, intentional number collisions), and how to reproduce the count.
- **[CLAUDE.md](./CLAUDE.md)** — AI-collaborator instructions doubling as the project conventions doc (style, a11y, the shared-database rule, branch workflow).
- **[STYLE_GUIDE.md](./STYLE_GUIDE.md)** — git workflow, branch naming, Conventional Commits, PR rules. Every change starts on a new branch off `main`; `main` is never pushed to directly.
- **[docs/CentenarianAcademy/](./docs/CentenarianAcademy/)** — course-authoring standards: `CourseAuthoringGuide.md` (craft), `CourseProductionPlaybook.md` (process), `CitationIntegrityGuide.md` (verify every source, never ship a fake citation), and `CourseCreationWithAI.md` (hand to your AI). Per-course recipes: `CourseAuthoringGuide NASM CPT/CES/CNC.md` and `CourseAuthoringGuide BVC.md` (Better Vice Club: audio-first, four-lens episodes; episode-per-module; rotating quizzes + FlashLearn recall loop + season-wide glossary). Courses cite only verified, peer-reviewed sources and ship a teacher evidence ledger.

What makes the architecture interesting (and the marketing pitch hard):

1. **Shared database, two apps.** This repo and contractor-os (Work.WitUS) use the same Supabase project, data and auth both, so migrations are additive-only across the boundary. Cross-app data is moving to signed events and APIs ahead of a planned split: Work.WitUS sends signed income and work-schedule events, RideWitUS uses signed feeds, and the old cross-app triggers (e.g., `trg_invoice_due_to_task`, dropped in migration 198) were replaced by app-side sync. The split itself, Work.WitUS moving to its own database, is planned, not done.
2. **14 product modules.** Planner · Finance · Focus · Health Metrics · Wearables · Workouts · Exercises · Equipment · Travel · Fuel · Recipes · Blog · Academy/LMS · AI Coach. Plus auxiliary cross-cutting systems (Data Hub, Life Categories, Activity Links, Media Library, Smart Scan).
3. **Offline-first with a real sync queue.** [`lib/offline/sync-manager.ts`](./lib/offline/sync-manager.ts) wraps `fetch()` with a URL-keyed IndexedDB cache for GETs and a queued mutation log for POST/PATCH/DELETE that replays on reconnect. 5-state UI indicator. Service worker stale-while-revalidate.
4. **Multi-decade horizon.** The schema breadth is justified by the use case: a personal OS that wants to be useful for 50+ years has to model planning, money, body, learning, attention, and everything that links them, rather than picking one vertical.

## Operating context

Operated by B4C LLC / AwesomeWebStore.com. Built solo by [Brand Anthony McDonald](https://brandanthonymcdonald.com).

```
B4C LLC / AwesomeWebStore.com  ← legal entity
└── WitUS.online               ← parent brand (philosophy + product directory)
    ├── CentenarianOS.com      ← this repo — the longevity correlation engine
    │   └── Academy (LMS)      ← module inside CentenarianOS today; migrating to Learn.WitUS
    ├── Learn.WitUS.Online     ← separate app, live multi-tenant LMS (BVC tenant)
    ├── Stream.WitUS.Online    ← separate app, cross-media tracker
    └── Work.WitUS.Online      ← separate app, contractor operations (shares CentOS's database today; a split is planned)
```

The Academy is still a module of CentenarianOS, but it is **no longer the ecosystem's LMS
of record.** `learn.witus.online` is a live, standalone, multi-tenant LMS (repo
`claude/witus-learn`) already serving the BVC tenant. The Academy's courses are slated to
migrate into it; CentenarianOS keeps in-app tutorials and links out. Earlier revisions of
this README claimed "there is no standalone Learn.WitUS app" — that is no longer true.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 App Router | Server Components by default, route handlers for the API surface (365 route handlers). |
| Hosting | Vercel | Fluid Compute for Node.js routes. |
| Database | Supabase Postgres | RLS as the security model. **Shared with contractor-os** (a split is planned, not done). |
| Auth | `@supabase/ssr` | Cookie-based; browser + SSR via the same client. New publishable + secret key system. |
| Styling | Tailwind v4 | WCAG 2.1 AA contrast enforced via global CSS overrides ([`app/globals.css`](./app/globals.css)). |
| Type system | TypeScript strict | No `any` escape hatches in app code. |
| Charts | Recharts | Admin dashboards + correlations module. |
| Media | Cloudinary | Audio / video / image / 360° via signed uploads. |
| Payments | Stripe Connect Express | Teacher payouts (LMS) + platform subscriptions. Webhook-driven sync. + CashApp (lifetime only). |
| AI | Google Gemini | Coach (`gemini-2.5-flash`), embeddings (`text-embedding-004` for CYOA navigation), Vision (universal OCR). |
| Email | Resend (via Supabase native integration) | Transactional auth + admin notifications. |
| Bot prevention | Cloudflare Turnstile | Signup gate. |
| Maps | Leaflet + OSRM | Academy lessons + travel route planning. |
| 360° / VR | Photo Sphere Viewer | Lessons + virtual tours with hotspots. |

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
| **Planner** | Roadmap, Goals, Milestones, Tasks hierarchy with day/week/month views; one-field task capture into an auto-created Inbox (works offline), searchable goal picker, Inbox filter; Google Calendar sync (read-only, one or more Google accounts; events on the calendars you choose become planner tasks, daily plus Sync now; `#expense` / `#income` titles record into the finance accounts ticked per Google account, picked with `@1234` or `@nickname`); calendar event builder (build `#expense` / `#trip` / `#meal` titles, see what the parser reads, open Google's prefilled event form), example `.ics` and printable cheat sheet (English and Spanish) | Paid |
| **Fuel** | Nutrition tracking with NCV framework, USDA/Open Food Facts APIs, auto inventory | Paid |
| **Engine** | Pomodoro focus sessions, doodle canvas, daily debrief, pain log (a new entry each time pain is noticed, editable time, works offline; history of every entry grouped by day with date, intensity, location and notes filters; the day's highest feeds correlations and AI reviews), AI weekly reviews | Paid |
| **Health Metrics** | RHR, steps, sleep, body composition; CSV import from Garmin, Apple Health, Oura, WHOOP, Google Health, InBody and Hume Health with a Check rows step (new days, days already imported, days that gain blank fields, days with different values) before anything is saved: a re-import only adds new days and fills blank fields, never changes a stored value unless Replace existing values is ticked, and a date listed twice in one file is merged; one row per day per source; Garmin sync is coming soon (Settings shows it as Coming Soon; Oura and WHOOP have no settings card) | Paid |
| **Workouts & Exercises** | Exercise library with categories; workout templates; Nomad Longevity OS | Paid |
| **Financial Dashboard** | Accounts, transactions, budgets, invoices, bank statement import from CSV or PDF (PDFs read in-process, never sent to a third party; Best Buy / Citibank statements parsed with summary, APRs, promotional balances and a reconciliation check; Capital One, Discover and PayPal Credit website activity printouts; other issuers by a generic fallback; CSV layouts verified against Citi, PayPal, Arizona Federal CU, Navy Federal and Best Buy downloads; also from the Statements box on Settings; card and loan statements in card terms, with payments linked as transfers to the account they were paid from and refunds counted as negative spending; one status color scale with icons) with duplicate detection, matching and undo; a review saved as you go so an import can be finished later (Resume import, only the server-read rows and choices kept, never the file, for 30 days); Import history to open a past import and change its rows (category, type, vendor, transfer links, delete) or re-run transfer matching; a Review page listing everything waiting for a decision (possible transfers, card and loan payments with no other side, imported rows that match an entry you made, uncategorized transactions, unfinished imports) with bulk actions and a count badge on the dashboard; CSV export, learned vendor categories ("Always categorize this vendor as...?"), Find similar (from a transaction, its page or a search: other transactions with the same vendor as the app compares vendors, the same words, the same amount within a tolerance, account, category, type or dates, counted live on the server across all your history) and bulk edit of the selection (category, vendor rename, type, brand, life category, tags, transfer unlink as a pair; the type never changes on one side of a transfer; batches of 200 with progress; "Remember for future imports" saves a learned rule; Undo last bulk edit puts back only rows unchanged since, migration 220), transfers between your own accounts (card and loan payments included) tracked as transfers instead of spending and income, a Budgets page with budgets by month, rollover, and suggested budgets from your own history (average or median of the last 3, 6 or 12 months), multi-currency accounts (cash in any currency for travel, a home currency for totals, Exchange money as a transfer with the fee as its own expense, daily rates from Frankfurter/ECB with ExchangeRate-API as fallback, your own rates always win), a Debt payoff page (interest paid per card/loan by month and year, payoff calculator, debt-free plan with avalanche (default, deferred-interest promo deadlines protected) / snowball / promo-first / custom order, card and loan due dates as planner tasks under Inbox › Bills, a Due soon banner and optional email reminders), savings goals as envelopes inside a real account (allocate, move, and split deposits across goals; monthly amount needed; whether each goal fits your monthly surplus; "Save for this" from a planned trip or equipment item), cash on hand (a dashboard card per cash account with balance and last count, "Count my cash" by total or bills and coins that records the difference as one adjustment with history and undo, one-tap "Paid cash" that works offline, Withdraw into cash, and ATM or branch withdrawals on imported bank statements recorded into a cash account instead of as spending), dated starting balances and monthly reconciliation (a starting balance "as of" a day, so an account can start mid-history and only later transactions count, taken from the first imported statement in one tap; a Reconcile page per account comparing a statement's closing balance with your records on that date, Cleared ticks on the period's transactions, and a difference resolved by a labelled adjustment, a starting-balance change or left open; card and loan balances in amounts owed; a Reconciled badge and a warning before editing a transaction in a reconciled period; unreconcile; a dashboard card listing accounts not reconciled in 30 days; "Reconcile to this statement's balance" after a PDF import), a Retirement page (401(k), 403(b), 457(b), IRAs, HSA, brokerage, pension, annuity accounts with hand-entered balance snapshots, contribution and employer-match rules; a planner projecting to retirement age in today's dollars with conservative / middle / optimistic presets as editable assumptions, a target from yearly spending × years or a withdrawal-rate rule of thumb, a hand-entered Social Security offset, the gap and the monthly amount needed; a net worth estimate; all labeled estimates, not advice), and an Insurance page (term / whole / universal life policies, coverage and cash value totals, premium payments matched from transactions with paid to date and next due, optional premium due-date tasks under Inbox › Bills, term-end warnings) | Paid |
| **Travel & Vehicles** | Fuel logs with OCR, trip tracking, multi-stop routes, maintenance, IRS mileage; Garmin Activities CSV import with a Check file step (an activity is its start time, so one already imported is skipped even after it was renamed in Garmin Connect; repeats in the file count once; activities that look like a trip you logged are flagged and skipped unless you include them) | Paid |
| **Equipment & Assets** | Asset tracking, valuation history, media gallery, cross-module links, depreciation for every item and vehicle (straight line, declining balance or units of use; expected life in years and/or uses or miles; salvage value; book value, yearly schedule and chart; estimates, not tax advice), work use (link items to planner tasks and synced calendar events with "Used equipment"; vehicles count work miles from trips; uses, work share, cost per use, and work-share depreciation for the year), a total book value summary, and "Save for replacement" into a savings goal | Paid |
| **Correlations & Analytics** | Cross-module data correlations, trend charts, daily/weekly aggregates | Paid |
| **Data Hub** | CSV import/export for 11+ modules with Google Sheets templates; Health Metrics and Workouts imports check the rows first and skip what is already there (a workout logged under the same name that day is skipped unless Import anyway is ticked) | Paid |
| **Life Categories** | One category tree: life areas (Health, Home, Travel...) on top and budget categories under them, so a transaction's life area comes from its budget category; one searchable picker everywhere a category is chosen; an Organize categories screen (suggestions by name you confirm, drag or pick a life area, create, rename, merge, delete); tag tasks, trips, workouts and other items with a life area directly; spending and activity by life area | Paid |
| **Academy (LMS)** | Create/sell courses; CYOA navigation; rotating spaced-recall quizzes; FlashLearn flashcards (multiple-choice + classic); per-module key terms; maps, docs, audio, video | Free |
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
- **Demo reset**: "Reset demo data" on the overview wipes and reseeds the tutorial and visitor demo accounts on demand (the same reset also runs nightly at 00:00 UTC via cron)

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

### Optional: Sign in with WitUS (ecosystem SSO)

```env
WITUS_OIDC_CLIENT_ID=
WITUS_OIDC_CLIENT_SECRET=
```

An OIDC code flow against the shared WitUS identity provider
(`accounts.witus.online`), on top of the normal Supabase session: `app/api/auth/witus/authorize`
-> IdP -> `.../witus/callback`, which finds-or-creates the user by email and mints an ordinary
CentOS session. The same client id also powers two ecosystem behaviours:

- **"Continue as \<name\>"** — the login page asks the IdP, in parallel with rendering the form,
  whether this browser already has a WitUS session, and relabels the button if it does. The answer
  depends on a third-party cookie, so Safari and Firefox return nothing; a failed or blocked check
  is invisible and the ordinary button remains.
- **Global sign-out** — Logout ends the shared IdP session too, so signing out here signs you out of
  every WitUS app in that browser. The local session is always destroyed first.

Without `WITUS_OIDC_CLIENT_ID` both are dark: the button does not render and sign-out is purely
local. Endpoint overrides and the full reasoning are documented in `.env.example` and
`lib/auth/witus-sso.ts`.

### Multi-currency accounts (no setup)

No API key or env var: exchange rates come from Frankfurter (ECB reference rates,
https://frankfurter.dev) and, for currencies it lacks, ExchangeRate-API's open access endpoint
(https://www.exchangerate-api.com, attribution shown wherever fetched rates appear). Both are read
server-side only and cached in `exchange_rates`. Apply `supabase/migrations/210_multi_currency.sql`;
a Vercel cron (`/api/cron/fx-rates`, daily at 17:00 UTC, `CRON_SECRET` Bearer guard) refreshes the
latest rates for every currency in use and fills missing home-currency amounts. Users set their
home currency and their own rates on Settings → Currencies.

### Finance Review page and saved imports (no setup beyond migration 219)

Apply `supabase/migrations/219_finance_review_import_drafts.sql` by hand. It adds two owner-only
tables: `import_drafts` (a statement review saved as the person goes, so it can be resumed: the
server-normalized rows and the per-row choices, never the CSV text or the PDF; 5,000 rows / 8 MB cap;
expires 30 days after the last save, deleted on import or discard, and nightly where pg_cron is
installed) and `finance_review_dismissals` ("Not a transfer", "Not a payment", "Not the same" answers).
Until it is applied, `/dashboard/finance/review` and the import page say "Run migration 219 first",
statements still import, and "Not a transfer" is remembered in the browser only. Code:
`lib/finance/review` (sections, reads, bulk actions), `lib/finance/import-drafts` (save, resume,
finish), `lib/finance/import-history/batch-rows.ts` (editing a past import, re-running transfer
matching); routes under `/api/finance/review` and `/api/finance/import/{drafts,batches/[id]}`.

### Pain log: apply migration 222

The pain form (`/dashboard/engine/pain`) adds a new entry on every save, so pain can be logged as
often as it is noticed; the history page (`/dashboard/engine/history/pain`) lists every entry,
newest first, grouped by day. Entries live in `pain_entries` (migration 222, apply by hand).
`daily_logs.pain_*` stays as each day's summary, recomputed after every add, edit or delete by
`lib/pain/server.ts` `recomputeDaySummary`: the highest intensity, every location, sensation and
activity in the order first logged, and every entry's notes oldest first separated by a blank
line. The correlation engine, `daily_aggregates`, AI weekly review and Coaching Gems keep reading
`daily_logs` unchanged.

Migration 222 copies each existing `daily_logs` day with pain data into one entry, once
(`source = 'daily_log'`, skipped when that day already has an entry). `daily_logs` never stored a
time of day, so those entries get 12:00 UTC and the app shows them as "Time not recorded". Until
the migration is applied, the form keeps the old one-entry-per-day behavior and says "Run
migration 222 first".

### One category tree (migration 223)

Apply `supabase/migrations/223_one_category_tree.sql` by hand. It adds `budget_categories.life_category_id`
(a budget category's life area, same user only, `ON DELETE SET NULL`) and
`entity_life_categories.auto_source` (`'budget_category'` marks a tag the app added from a transaction's
category; NULL means a person added it, and the app never removes those). It does not guess any mapping:
the Organize categories screen (`/dashboard/categories/organize`) lists unplaced budget categories with
suggestions the person confirms. Until it is applied, both lists work as before and the new parts say
"Run migration 223 first". Additive only; Work.WitUS reads and writes both tables unchanged. Code:
`lib/categories/*`, `components/categories/CategoryTreePicker.tsx`, `GET /api/categories/tree`,
`POST /api/categories/merge`.

### Fitness import identity (migration 224)

Apply `supabase/migrations/224_fitness_import_identity.sql` by hand. It adds a nullable `external_id` to
`trips` and `workout_logs`, each with a unique index on `(user_id, external_id)`. Garmin activities get
`garmin:start:<local start YYYY-MM-DD HH:MM:SS>`, the same key from the Activities CSV, the account-export
JSON and (later) the Garmin API, and are written with `ON CONFLICT DO NOTHING`, so an activity can never be
added twice. The indexes are not partial: rows that leave the column NULL (every existing row, Work.WitUS's
own Garmin import, hand-logged trips) never collide. No backfill; older Garmin trips are matched by the start
time in `garmin_activity_id`. The Travel import works before it is applied (it says so and relies on a paged
duplicate check); `scripts/import-garmin-workouts.mjs` needs it. Code: `lib/fitness-import/*`.

To list duplicates already stored (read-only, deletes nothing):
`node --experimental-strip-types --env-file=.env.local scripts/report-fitness-duplicates.mjs [--email <account>] [--json]`,
or the queries in `supabase/sql-snippets/find-fitness-duplicates.sql` in the SQL editor. Re-running the
import scripts is safe: `scripts/import-garmin-workouts.mjs` (run with `--experimental-strip-types`; has
`--dry-run` and `--dir <DI_CONNECT/DI-Connect-Fitness folder>`, and reads every `*_summarizedActivities.json`
in it, since the file numbers change between Garmin exports), `scripts/import-garmin-hume.mjs` and
`scripts/import-apple-health.mjs` (also run with `--experimental-strip-types`; Apple steps: the largest
device total per day, not every device added together).

### Importing a Garmin export

Garmin's full account export (the ZIP you request from your Garmin account, or its unzipped folder) is
JSON, not the CSVs the in-app importers read. `scripts/garmin-export-to-centos.mjs` converts it on your
machine. It reads local files only: no network, no database, no env vars.

```bash
node scripts/garmin-export-to-centos.mjs <export-dir | export.zip> [--out <dir>] [--since YYYY-MM-DD] [--exercises] [--with-notes] [--keep-short]
```

It writes into `<export-dir>/centos-import` (or `--out`). Each importer has a check step that writes
nothing, and importing a file twice adds nothing.

| File | Import it at | What it holds |
| --- | --- | --- |
| `health-metrics-NN-of-MM_<from>_<to>.csv` | Settings > Wearables > Garmin > Import CSV (`/dashboard/metrics/import?source=garmin`), one file at a time | One row per local day: steps, that day's resting HR (not Garmin's 7-day average), active calories, intensity minutes, all-day stress, Body Battery high (as recovery), sleep hours (deep + light + REM), sleep score, sleep SpO2 and weight (the last weigh-in taken that day). At most 365 days per file, the import's cap. |
| `trips-garmin-activities.csv` | Travel > Import Data > Garmin Activities CSV (`/dashboard/travel/import`) | Rides, walks, runs and hikes, with Garmin Connect's Activities.csv headers. Keyed by local start time, so activities already imported are skipped. |
| `workouts[-NN-of-MM].csv` | Data Hub > Import > Workouts (`/dashboard/data/import/workouts`), one file at a time | Every other activity type (strength, HIIT, yoga, ...), with Garmin's RPE in the notes. The import merges rows with the same name and date into one workout, so a name used twice on one day gets its start time: `Strength (07:05)`. At most 200 workouts per file, since the import saves them one at a time in one request. Use these files or `scripts/import-garmin-workouts.mjs` for an export, not both: a renamed workout does not match a row that script wrote. |
| `check-weights-old-script.csv` | - (read it, don't import it) | Only when there are any: the days where the old `scripts/import-garmin-hume.mjs` stored a different weight, or a weight on a day Garmin has none (it dated weigh-ins by their GMT time read as local time). A re-import keeps stored values, so these are the days to check by hand. |
| `summary.txt` | - | Counts, date ranges, what was skipped and why, and these steps. |

Units it converts (checked against a real export and Garmin Connect's CSV for the same activities):
activity durations are milliseconds, distance and elevation centimetres, activity `calories / 4.19` is
kcal, weight is grams. A blank cell means not measured, never 0, so it can't erase a stored value.
Activities shorter than 30 seconds are left out (accidental starts; a trip would be stored with 0
minutes); `--keep-short` keeps them. `--since` keeps only dates on or after that day (a newer export on
top of one already imported).
`--exercises` adds Garmin's exercise sets as exercise rows and splits the workouts file at workout
boundaries (1,000-row cap). `--with-notes` writes logged water and blood-pressure readings into the
notes column, since CentenarianOS has no column for either. Not converted (no column or importer): VO2
max, fitness age, training status and load, respiration, floors, BMI, GPS tracks; HRV is not in the
export. Keep the export and the output out of git (`docs/` and `files/` are ignored). Tests:
`tests/unit/garmin-export-converter.test.ts`.

### Optional: Google Calendar (one-way sync)

```env
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
TOKEN_ENCRYPTION_KEY=       # openssl rand -hex 32; encrypts the stored Google tokens
SUPABASE_JWT_SECRET=        # signs the OAuth state (lib/oauth-state.ts); SUPABASE__SUPABASE_JWT_SECRET also works
```

One-way, Google -> CentenarianOS. The only Calendar scope requested is
`https://www.googleapis.com/auth/calendar.readonly` (plus `openid email` to show which account
is connected), so nothing is ever written to Google.

**What ships today (phases 1 and 2, "connect" + "sync"):** Settings -> Calendar Sync
(`/dashboard/settings/calendar`) connects one or more Google accounts (for example personal and
business; one `calendar_connections` row per Google account, matched on Google's account id), lists
each account's calendars with its own on/off checklist, and shows per account: status, last synced
time, the last run's counts (created / updated / archived / flagged) and errors, **Sync now**,
Reconnect and Disconnect (revokes that account's grant at Google, then deletes its saved tokens and
calendar choices; other accounts stay). **Sync all** syncs every account; a Vercel cron
(`/api/cron/calendar-sync`, daily at 06:00 UTC, `CRON_SECRET` Bearer guard) syncs everyone.

Loading the page re-checks each account with Google (a refresh-token exchange, at most once per 5
minutes per account), so an account whose access was removed at
myaccount.google.com/permissions shows "Needs reconnecting" straight away.

What a sync does (`lib/calendar/google-sync.ts`): the first run of a calendar reads 30 days back to
180 days ahead, later runs read only changes (Google sync token; a 410 Gone falls back to the full
window). Each event becomes a planner task under a "Google Calendar: <calendar name>" milestone
(`resolveImportMilestone`, the Inbox when the user has no roadmap); all-day events at 09:00; times in
the event's or calendar's time zone; moved events move their task, cancelled events archive it,
completed tasks stay completed, and a task the user deleted is not recreated. Titles go through the
capture-token parser and the result is stored in `calendar_sync_items.parsed`.

**Records from tagged events** (`lib/capture/calendar-records.ts`, phase 4.4): a tagged event keeps
its task (the calendar anchor) and also gets a record. `#expense` / `#income` create a transaction
(`source = 'manual'`, tag `google-calendar`, in the chosen account's currency). Each Google account
ticks the finance accounts these may use under "Accounts for #expense and #income" and marks one
the default (`calendar_connections.settings`: `allowed_account_ids`, `default_account_id`; an older single
`default_account_id` reads as that one account ticked). A title names another ticked account with
`@` and its last four digits or its nickname (`financial_accounts.nickname`, migration 218, set on
Finance → Accounts, unique per user among active accounts; before 218, last four only)
(`Lunch Chipotle #expense $12.40 @1234`, `... @visa`); an `@account` that is unticked, unknown or
matches two ticked accounts creates no transaction and is flagged (`lib/capture/calendar-accounts.ts`); `#meal` a meal log; `#workout` a
workout log. Transactions and workouts are linked to the task in `activity_links` (meals only
through `calendar_sync_items.record_type/record_id`, since `activity_links` has no meal type).
`#trip` creates **no** trip: travel is moving to RideWitUS, so the parsed trip stays on the sync row
and the task says so. A title with missing data (an `#expense` with no amount) creates only the task.
The record id and a snapshot of what was written are saved on the sync row before the insert, so a
retried run never doubles a record. When the event changes, the record follows only while it still
equals that snapshot; when the event is cancelled, a transaction is **never** deleted, and a meal or
workout is removed only if untouched. Anything the sync will not do on its own flags the row, and
the settings page lists it under **Needs a look** (`GET/PATCH /api/calendar/google/review`) with
links to the task and record. The create rules live in `lib/capture/create-record.ts`
(`createTransaction`, `createMealLog`, `createWorkoutLog`), shared with
`POST /api/finance/transactions`, `POST /api/workouts/logs` and the new `POST /api/meals`.

**Writing titles the sync can read:** Calendar Sync -> Event builder
(`/dashboard/settings/calendar/event-builder`) builds a title from simple fields, runs it through
the real parser to show what is read and any warnings, copies it, or opens Google's prefilled
create-event link (`calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&details=…&location=…&ctz=…`;
Google does not publish a reference for this URL, so the button is labelled unofficial). It also
downloads the examples as an `.ics` dated in the coming week, for a separate test calendar. The
helpers live in `lib/capture/event-templates.ts`; `public/templates/calendar-event-examples.ics`
and `public/templates/calendar-event-cheat-sheet.md` are generated from them
(`node --experimental-strip-types scripts/generate-calendar-event-templates.ts`) and a unit test
fails when they drift. The printable cheat sheet page is `/dashboard/settings/calendar/event-builder/cheat-sheet`.
The ecosystem-wide title grammar is in the witus repo, `docs/calendar-event-conventions.md`.

**Calendar activity feed to RideWitUS** (RideWitUS PRD §5.8 / §6.5a, migration 216): RideWitUS
suggests trips to and from calendar activities, and gets them from CentenarianOS (it never connects
to Google). Since migration 216 the sync stores `starts_at`, `ends_at`, `all_day`, `time_zone` and
`location` on each `calendar_sync_items` row it writes (`lib/calendar/event-times.ts`). Each
switched-on calendar has two switches on the settings page, both off by default:
**Share with RideWitUS** (`calendar_sync_calendars.share_with_ridewitus`) and **Hide titles**
(`hide_titles_for_ridewitus`, sends `"Event"`). After each sync, the rows it wrote are sent as signed
`calendar.activity` events (`lib/ridewitus/`): shared calendars only, a location required (all-day
events too), start within the past 14 / next 30 days, `event_id` = `cal:` + SHA-256 of the sync row
id, and never the description, attendees, meeting links or Google ids. Switching sharing on (or
changing Hide titles) sends the calendar's window; switching it off sends `is_active: false` for
the calendar's events; an event whose location is removed is retracted the same way. Delivery is a
signed POST (`X-Witus-*`, source `centenarianos`, batches of 500, 3 attempts) behind the
`ActivityDelivery` interface in `lib/ridewitus/delivery.ts`; the identity is the user's
`witus_identities.witus_sub` (users who never signed in with WitUS send nothing). Without the two
env vars below nothing is sent and nothing else changes.

```env
RIDEWITUS_CALENDAR_ACTIVITY_URL=   # RideWitUS POST /api/events/calendar-activity, full URL
CALENDAR_ACTIVITY_EVENTS_SECRET=   # shared HMAC secret, the same value on RideWitUS
```

After applying migration 216, fill the new columns for events synced earlier (read-only against
Google; writes only those columns):
`node --env-file=.env.local --experimental-strip-types scripts/backfill-calendar-event-fields.mjs --dry`,
then without `--dry`. Run it before switching sharing on.

**Where the tokens live:** `calendar_connections`, encrypted with AES-256-GCM
(`lib/crypto/tokens.ts`) before they are written. The table has Row Level Security on and no
policies, so only the service-role API routes under `app/api/calendar/google/` can read it, and
no response to the browser includes a token column.

**Setup:**

1. Apply `supabase/migrations/204_calendar_sync.sql`, then `205_calendar_multi_account.sql`
   (several accounts per user, validation and last-run columns). Until both are applied, the routes
   answer with a JSON error (`code: "migration_missing"`) and the page says so. Then
   `216_calendar_activity_feed.sql` for the RideWitUS feed (event times and location, the share
   switches); until it is applied the sync skips those columns and the switches are greyed out.
2. In Google Cloud Console: enable the Google Calendar API, configure the OAuth consent screen,
   and create an OAuth client of type "Web application".
3. On that client, add one authorized redirect URI per origin the app is served from:
   `<origin>/api/calendar/google/callback` (for local development,
   `http://localhost:3000/api/calendar/google/callback`). The app builds the URI from the origin
   of the request, and Google requires an exact match (scheme, host, case, no trailing slash).
4. Set the four variables above. With any of them missing, the settings page shows "not
   available on this site yet" instead of a Connect button.

**Good to know (from Google's OAuth documentation):** while the consent screen's publishing
status is "Testing", Google issues refresh tokens that expire after 7 days for scopes beyond
name, email and profile
([Refresh token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)).
In that state the page asks the user to Reconnect about once a week. Google describes that
7-day limit only for the "Testing" status.

**Verification status:** connect and disconnect (phase 1) were checked by hand against the live
OAuth client on 2026-10-04. The sync engine, several accounts, and the on-load revocation check
were written from Google's documentation and are covered by unit tests with fakes only. Check by
hand after applying migration 205: a second Google account connects next to the first; Sync now
creates tasks under "Google Calendar: <name>"; a second Sync now changes nothing; moving an event
in Google and syncing moves the task; deleting it archives the task; removing access at
myaccount.google.com/permissions shows "Needs reconnecting" on the next page load (allow up to 5
minutes since the last check); and the daily cron run appears as a new "Last synced" time.

### Optional: RideWitUS integration (server to server)

```env
RIDE_VENDOR_API_SECRET=           # RideWitUS -> CentOS: vendors read API
RIDE_RESYNC_SECRET=               # RideWitUS -> CentOS: "Sync now"
ENVELOPE_BALANCE_EVENTS_URL=      # CentOS -> RideWitUS: its /api/events/envelope-balance URL
ENVELOPE_BALANCE_EVENTS_SECRET=
# WITUS_SOURCE_SLUG=centenarianos # optional; X-Witus-Source on outgoing events
```

Names follow the RideWitUS PRD (§6.5, §6.9, §6.10). Every request in either direction uses the
WitUS signed-request format: `X-Witus-Source`, `X-Witus-Timestamp`,
`X-Witus-Signature: sha256=hex(HMAC(secret, "<timestamp>.<body>"))`, a 300-second window and a
constant-time compare (`lib/events/verify-signature.ts` receives, `lib/events/sign-request.ts`
sends). A **GET signs its path and query string** exactly as sent (for example
`/api/v1/ride/vendors?witus_sub=abc&q=shell`), so the subject cannot be edited in flight. Each
secret is shared with RideWitUS under the same name, and each can be rotated alone.

The user is identified by `witus_sub`, the WitUS sign-in subject, resolved through
`witus_identities` (`lib/witus/identity.ts`). A subject with no row (the person never signed in to
CentenarianOS with WitUS) gets `404 unknown_subject`; RideWitUS keeps its request queued until they do.

| Endpoint | What it does |
|---|---|
| `GET /api/v1/ride/vendors?witus_sub=&q=&limit=&offset=&since=` | The user's vendors (`user_contacts`, type vendor): id, name, company, category, phone, website, city, locations (no coordinates), and with `since` up to 10 recent `item_prices` each. Paginated with `next_offset`; returns `create_vendor_url`, a link to `/dashboard/contacts/new?type=vendor&name=…`. Read-only: RideWitUS never creates vendors (PRD Q14) |
| `GET /api/v1/ride/vendors/[id]?witus_sub=&since=` | One vendor; `404 not_found` when it is not this user's |
| `GET /api/v1/ride/vendors/[id]/prices?witus_sub=&since=&limit=` | Recent prices at that vendor (`currency: null`: prices store no currency yet) |
| `POST /api/v1/ride/resync` `{ witus_sub, scopes?, since? }` | Re-sends this user's facts through the outbox. `envelopes` works today; `calendar` is a hook for the calendar feed; `matches` is not built. One per user per 5 minutes (429 + `Retry-After`). Answers `202` with a `request_id` and per-scope counts |

Responses use `{ ok: true, data } | { ok: false, error, code }`. Missing secret: `503 not_configured`.

**`envelope.balance` (CentOS -> RideWitUS).** A savings goal linked to a planned trip or an
equipment item is sent after every goal or allocation write and nightly: goal id, link type
(`trip` or `equipment`) and the **CentenarianOS** id of the linked record (`link_source:
"centenarian-os"`), saved (`balance`), target, currency (the funding account's), target date,
status and `is_active` (false when the goal is archived, deleted or unlinked). There is no vehicle
link on `savings_goals` yet, so `link_type: "vehicle"` is not sent. Events go through
`integration_outbox` (migration 217, apply by hand): one row per fact holding the latest payload,
sent at once, then retried at 1 min, 5 min, 30 min, 2 h and 12 h by later writes and the daily
cron `/api/cron/integration-outbox` (06:30 UTC, `CRON_SECRET`), then marked failed. A row
RideWitUS refuses with `unknown_subject` waits without failing. With the URL or secret unset,
nothing is queued or sent (logged once per instance).

### Optional: Error Monitoring (Better Stack)

Crash reporting runs through the Sentry SDK, pointed at Better Stack (which speaks
the Sentry protocol). Every variable below is **optional**: with none of them set
the SDK never initializes and the app behaves exactly as it did before.

```env
SENTRY_DSN=                 # server + edge runtimes
NEXT_PUBLIC_SENTRY_DSN=     # browser runtime
SENTRY_ORG=                 # source-map upload only
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=          # omit and the build skips source maps entirely
```

Setting `SENTRY_AUTH_TOKEN` is what turns source maps on. Without it the build
neither generates nor uploads them, so production stack traces stay minified.
That is a deliberate trade: generating maps that cannot be uploaded is expensive
enough to have contributed to an out-of-memory Vercel build.

Because this app holds health data, reports are scrubbed before they leave the
process: `lib/sentry-scrub.ts` drops the user object, cookies, auth headers, the
request body, and every query string, and masks token-shaped URL segments.
Tracing and Session Replay are both hard-coded to `0`.

### Uptime Monitoring: point monitors at `/api/health`

**Point every uptime monitor at `https://<your-domain>/api/health`, not at the
homepage.** The homepage can serve a cached `200` while Supabase is down, so a
green check there proves nothing. `/api/health` is never cached
(`force-dynamic` plus `Cache-Control: no-store`) and always makes a live round
trip to the database before it answers.

| Condition | Status | Body |
|---|---|---|
| Database answered | `200` | `{"ok":true,"service":"centenarian-os","checks":{"database":"ok"},"latencyMs":42,"checkedAt":"..."}` |
| Database errored, timed out (4s), or is not configured | `503` | `{"ok":false,"service":"centenarian-os","error":"database_unreachable","checks":{"database":"fail"},"latencyMs":4001,"checkedAt":"..."}` |

The `error` field is one of two fixed tokens, `database_unreachable` or
`not_configured`. Configure the monitor to alert on any non-`200`, or to expect
the string `"ok":true` in the body.

Design notes, because this app holds health data:

- The route is public and unauthenticated but leaks nothing. The raw database
  error is **never** echoed (it can carry host names and credential context),
  only the fixed reason token is returned.
- It runs on the **anon/publishable key**, never `SUPABASE_SERVICE_ROLE_KEY`. A
  public endpoint must not hold elevated credentials.
- It returns, counts, and hints at **no user data**. The probe is a `HEAD`
  request against `metric_config` (a seeded configuration table of metric labels
  and unlock rules, with no user rows), so PostgREST returns no body and no
  count, and RLS denies the anon role anyway. The only assertion is "Postgres
  answered".
- The check aborts after 4 seconds, so a hung database returns `503` fast
  instead of holding the monitor open.

Source: [`app/api/health/route.ts`](./app/api/health/route.ts).

### Database Setup

```bash
# Option A: Supabase CLI
supabase db push

# Option B: SQL Editor in Supabase Dashboard
# Run migrations in order from supabase/migrations/
```

There are 226 migrations (see [`MIGRATIONS.md`](./MIGRATIONS.md) for the gallery). Run them in numeric order. The database is shared with the Work.WitUS (contractor-os) app, so migrations are additive-only. Read [`CLAUDE.md`](./CLAUDE.md) §"Database" before adding any.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Run Unit Tests

```bash
npm run test:unit
```

Runs the pure-function tests with Node's built-in test runner (`node --test --experimental-strip-types`, Node 22.6+). No database, network or extra dependencies. Covers merchant-name matching and learned vendor categories (`tests/transaction-matching.test.ts`), the stored-secret encryption helper (`tests/unit/crypto-tokens.test.ts`), the Google Calendar client and token refresh (`tests/unit/google-calendar-client.test.ts`, with a fake `fetch`), and the Google Calendar sync helpers: event to task fields, time zones, the sync decision and the 410 fallback (`tests/unit/google-sync.test.ts`), the RideWitUS integration: signing, identity lookup, vendor scoping, the envelope.balance emitter, outbox delivery and resync (`tests/unit/witus-signing.test.ts`, `ridewitus-vendors.test.ts`, `ridewitus-envelope.test.ts`, with a fake `fetch`), and pain entries: several a day, the daily summary rules, the migration 222 backfill, ownership and the history filters (`tests/unit/pain-entries.test.ts`, with an in-memory database fake).

It also covers the one category tree (`tests/unit/category-tree.test.ts`): the tree and picker search,
suggestions by name, ownership of a budget category's life area, the automatic life area of a
transaction (never removing a tag a person added), budgets unchanged, the analytics roll-up and merging.

## Project Structure

```
centenarian-os/
├── app/                        # Next.js App Router
│   ├── api/                   # API route handlers
│   │   ├── cashapp/           # CashApp payment submission
│   │   ├── exercises/         # Exercise library CRUD
│   │   ├── finance/           # Finance APIs
│   │   ├── fuel/              # Nutrition APIs
│   │   ├── health/            # Public uptime probe (checks Supabase)
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
    └── migrations/            # 225 database migrations — see MIGRATIONS.md
```

For the full module map and the cross-app shared-DB story, see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Security

- **Authentication**: Supabase Auth + Cloudflare Turnstile on signup
- **Authorization**: Row Level Security (RLS) on all tables
- **Profiles**: billing, plan and role columns (`subscription_status`, `stripe_*`, `role`, `invite_limit`, `products`, `selected_modules`, ...) can only be changed by server code with the service role; a trigger rejects browser-session writes (migration 206). Other users' names, avatars and bios are read from the `public_profiles` view, and the `profiles` table is readable only by its owner (migration 207). See `lib/profiles/public-profiles.ts`.
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

Proprietary B4C LLC / AwesomeWebStore.com

## Acknowledgments

Built with [Next.js](https://nextjs.org/), [Supabase](https://supabase.com/), [Tailwind CSS](https://tailwindcss.com/), [Stripe](https://stripe.com/), [Google Gemini](https://ai.google.dev/), [Cloudinary](https://cloudinary.com/), [Excalidraw](https://excalidraw.com/)

---

**Status**: Active Development | **Version**: 0.5.0
