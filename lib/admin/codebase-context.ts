// lib/admin/codebase-context.ts
// Static codebase knowledge for the Admin Education AI assistant.
// Update this file when significant features ship.

export const CODEBASE_CONTEXT = `
## CentenarianOS — Architecture & Feature Reference

### Product Overview
CentenarianOS is a comprehensive longevity-focused life-management platform. It combines financial tracking, health metrics, travel logging, meal planning, fitness programming, and educational courses into a single dashboard — all built around the idea that living to 100+ requires intentional daily systems.

### Tech Stack
- **Framework**: Next.js 15 App Router (TypeScript, app/ directory structure)
- **Styling**: Tailwind CSS v4 (utility-first, dark theme with fuchsia accents)
- **Database**: Supabase (PostgreSQL + Row-Level Security), 219 migrations
- **Auth**: Supabase Auth (email/password, magic link)
- **Payments**: Stripe (checkout sessions, webhooks, subscription management, Stripe Connect for teacher payouts)
- **AI**: Google Gemini 2.5 Flash (chat, coaching, embeddings, vision/OCR)
- **Embeddings**: Gemini text-embedding-004 (768-dim vectors, pgvector)
- **Media**: Cloudinary (image/video uploads for courses, exercises, profiles, blog posts)
- **Video Embedding**: VideoEmbed Tiptap node (YouTube, Viloud.tv, Mux, Cloudinary direct) — used in blog posts and recipes
- **Offline**: offlineFetch wrapper caches GETs in IndexedDB, queues mutations for replay
- **Charts**: Recharts (admin analytics, finance dashboards)
- **Bot Prevention**: Cloudflare Turnstile on signup

### Core Architecture
- **Admin panel** (/admin/*): Dark theme, gated by ADMIN_EMAIL env var. 18 management pages covering users, content, feedback, metrics, academy, institutions, logs, usage analytics, short links, education chat.
- **User dashboard** (/dashboard/*): Subscription-gated. Free routes: blog, recipes, billing, messages, feedback. Paid routes: finance, travel, planner, workouts, health metrics, equipment, data hub, coaching, scan, categories.
- **API routes** (app/api/*): Next.js Route Handlers. Service role client bypasses RLS for admin and webhook operations.
- **Auth pattern**: createServerClient (SSR cookies) for user auth; service role client for admin ops.
- **Middleware**: Route protection for admin-only paths (/coaching, /dashboard/coach, /dashboard/gems).
- **Invited Users**: Admin can grant access without Stripe subscription — trial or lifetime, with optional module-level restrictions.

### Modules (22+)

1. **Finance** — Financial accounts (checking, savings, credit card, loan, cash), transactions with categories, budgets, recurring transactions, invoices, CSV import/export. Balance = opening_balance + SUM(income) - SUM(expenses). No bank connection: bank transactions come in by the bank statement CSV import at /dashboard/finance/import (Teller bank linking was removed in 2026-10; historic rows keep source bank_sync, shown as "Bank import"). **Statement import** (migration 203): four steps on one page (app/dashboard/finance/import/page.tsx + components/finance/import/*): 1 account (required) and file, parsed in the browser by lib/finance/csv-import/parse.ts; 2 column mapping, sign convention (negative_is_expense, positive_is_expense, split_columns, type_column) and date order, saved per account in financial_accounts.csv_import_mapping; 3 review of POST /api/finance/import/preview, where each row is new, duplicate, duplicate_in_file, matches (a manual or scanned entry, linked instead of inserted) or invalid, with per-row action, direction and category; 4 commit via POST /api/finance/import, which re-parses the file on the server and writes an import_batches row. GET /api/finance/import/batches lists imports; POST /api/finance/import/batches/[id]/undo deletes untouched imported rows, keeps edited ones and unlinks matched entries. Rows carry external_id (bank:<id> or a hash), so re-importing a file adds nothing. The page's own decisions live in lib/finance/csv-import/ui-helpers.ts. Limits: 5,000 rows and 4,000,000 characters per import. **PDF statements** (lib/finance/pdf-import, migration 209): the same routes take { account_id, pdf_base64 }; the PDF is read in the Node route with pdfjs-dist (never sent to a third party), parsed by an issuer parser (citi-best-buy, else a low-confidence generic date/description/amount fallback), reconciled (previous - payments - credits + purchases + cash advances + fees + interest = new balance, plus row sums per kind), and goes straight to review (no column step). POST /api/finance/import/pdf reads a PDF before an account is chosen and returns accounts whose last_four matches. Commit needs confirm_unreconciled when it doesn't reconcile, and saves the statement summary, APRs and promotional (deferred-interest) balances to account_statements (one per user/account/period_end); undo deletes it. Settings has a Statements upload box that hands the file to the import page in memory. **Multi-currency** (migration 210, lib/finance/fx): financial_accounts.currency (ISO, default USD), profiles.home_currency (NULL = USD), financial_transactions.currency/fx_rate/amount_home (converted at save at the rate for the transaction date; NULL = home currency). Totals (summary, budgets, brand P&L, life-category analytics) use amountForTotals(): amount_home, else amount when the row is in the home currency, else left out as unconverted. Rates: exchange_rates cache (fetched USD->X rows shared with user_id NULL; manual rows per user, which always win), Frankfurter (ECB, historical) first, ExchangeRate-API open access as fallback (attribution required), cross rates via USD, fetched rates up to 7 days old reused; routes /api/finance/fx/{currencies,rates,refresh,home,exchange}, daily cron /api/cron/fx-rates (17:00 UTC). Exchange money = transfer pair (transfer_kind transfer) + fee as its own expense + the rate got saved as a manual rate. Balances stay in each account's currency. **Debt payoff** (lib/finance/debt, migration 211, page /dashboard/finance/debt): pure math in amortize.ts (APR/12 monthly interest, payoff schedule, payment by date, promo pace, back interest, early-payment savings amount x APR / 365 x days) and plan.ts (avalanche default ranked by the rate a debt charges now, snowball, promo_first, custom; a promo guard clears deferred-interest balances one payment before expiry; freed minimums roll over; comparison with minimums only). interest.ts: interest paid per account/month from account_statements.interest_charged (exact) else source='interest' rows. APIs: GET /api/finance/debt (overview), /debt/interest?year=, /debt/due-soon, POST /debt/due-tasks, GET/PUT /debt/reminders, /debt/saved-plans(/[id]) (debt_plans with a baseline snapshot; progress vs linked card/loan payments). Daily cron /api/cron/bill-due-tasks (CRON_SECRET) writes one planner task per card/loan due date in the next 45 days and per promo deadline (30 days before expiry) under Inbox > Inbox > Bills (lib/planner/bills.ts), tasks.source_type='bill_due', source_id = bill_due_items.id; completes tasks when linked payments reach the minimum; emails reminders per debt_reminder_settings (off/3_days/1_day/both). **Retirement and life insurance** (migration 215, own tables, not financial_accounts): investment_accounts (kind 401k/403b/457b/IRAs/hsa/brokerage/pension/annuity/whole_life_cash_value/other, currency, contribution amount per frequency or percent of annual_pay, employer match rate / limit % of pay / yearly cap, optional expected_annual_return), investment_balance_snapshots (one per account per as_of, source manual; 'statement' reserved for a later import via upsertSnapshot), insurance_policies (term/whole/universal life, coverage, premium + frequency, start/term-end dates, cash value, beneficiaries, premium_category_id / premium_vendor for matching, premium_tasks), retirement_plan_settings (one row per user; NULL = app default). Pure math lib/finance/retirement/logic.ts (monthly compounding, today's dollars via inflation, presets 4/6/8% nominal + 3% inflation as editable assumptions, target = spending x years or need / withdrawal rate with Social Security offset, gap and monthly needed) and lib/finance/insurance/logic.ts (premium schedule, match within 2%/$1 by category or vendor, paid to date, next due, term ending within 365 days). APIs /api/finance/retirement (GET overview; accounts, snapshots, settings) and /api/finance/insurance (GET/POST, [id], POST premium-tasks: next due date as a task under Inbox > Inbox > Bills with tasks.source_type='insurance_premium', source_id = policy id, completed when paid). Pages /dashboard/finance/retirement (projection chart, target, gap, needed per month, net worth estimate) and /dashboard/finance/insurance. Institution policies (APR, fees, rewards, dispute windows). Saved contacts with default categories for auto-fill. **Cash on hand** (lib/finance/cash, migration 213 cash_counts): GET /api/finance/cash lists active cash accounts with balance (own currency, balance_home when foreign), last count and freshness (never/stale after 30 days/fresh) and the last used cash account; POST /api/finance/cash/counts compares a counted total (or denominations in cents) with the recorded balance and saves one adjustment transaction (expense "Unrecorded cash spending" or income "Cash found", tags [cash-count], chosen category, FX fields when foreign) plus a cash_counts row; DELETE /api/finance/cash/counts/[id] undoes only the latest count and deletes its adjustment. UI: components/finance/cash (CashOnHandCard on the dashboard, CountCashModal, PaidCashForm via offlineFetch, CashAccountActions on the Accounts page; Withdraw = TransferModal defaultToId). Statement import: lib/finance/cash/withdrawal.ts adds the cash_withdrawal hint (ATM, cash withdrawal, branch/teller withdrawal, retiro, cajero, disposicion de efectivo, standalone cash back; never fees, rebates, deposits, purchases, SPEI/transferencia); on checking/savings it is TransferRole cash_withdrawal with a picker of same-currency cash accounts (default from suggestCashAccount), linked or recorded by linkStatementTransfers as "Cash withdrawal from <bank>" (transfer_kind transfer), which now refuses cross-currency links.

2. **Health Metrics** — Three tiers: Core (RHR, steps, sleep, activity calories), Enrichment (per-metric unlock with disclaimer), Body Composition (locked, per-metric acknowledgment). Wearable OAuth: Oura, WHOOP, Garmin with auto-sync. CSV imports: Apple Health, Google Health, InBody, Hume Health. Admin controls global enable/disable and per-user access overrides.

3. **Travel** — Vehicles (with ownership/tax/trip categories), trips (one-way + round-trip), fuel logs (with OCR via Gemini Vision), vehicle maintenance, multi-stop routes with trip_routes table, trip templates (single + multi-stop). Garmin activity import. Bike savings calculator. Each trip leg with cost creates a linked finance transaction. **Booking details** (migration 122): confirmation number, booking reference, carrier name, hotel check-in/check-out dates, accommodation name/address/room type, pickup/return addresses and times, flight seat assignment/terminal/gate, booking URL, loyalty program/number. **Trip budgets** (migration 123): budget_amount on trips and routes, brand_id FK to user_brands for brand-associated travel. **Trip sharing** (migration 124): visibility (private/shared/public) on trips and routes, trip_shares table for token-based share links with expiration (anyone with the link can view; the shared_with column for per-user grants is unused), shared itinerary read-only view page.

4. **Planner** — Tasks, milestones, roadmaps, goals. One-field task capture (POST /api/tasks, offline-queued, idempotent client id) files goal-less tasks in an auto-created Inbox roadmap; system roadmaps (Inbox, Work.WitUS Sync) are flagged by roadmaps.system_kind (migration 200) and shown with an Auto badge. Weekly AI review via Gemini. Task location linking via saved contacts with sub-locations. Calendar import (.ics parser, pure TypeScript). Google Calendar one-way sync (read-only, several accounts, daily cron + Sync now) mirrors events into planner tasks; per-calendar "Share with RideWitUS" (off by default, migration 216) sends events with a location (past 14 / next 30 days, optional hidden titles) to RideWitUS as signed calendar.activity events for trip suggestions (lib/ridewitus/). Life retrospective AI analysis of calendar history patterns.

5. **Academy (LMS)** — Full learning management system. Courses with modules and lessons (markdown or Tiptap rich text). CYOA (Choose Your Own Adventure) navigation via semantic embeddings, including cross-course CYOA matching. Course prerequisites (required/recommended) with student override request workflow. Assignments with grading. Live sessions (Viloud.tv iframe embeds). Teacher role with Stripe Connect payouts (configurable platform fee, default 15%). Bulk course import via CSV. Lesson glossary with phonetic spelling. Content-seen tracking for enrollment progress.

6. **Equipment Tracker** — Categories (auto-seeded defaults), items with purchase price, valuations over time (value chart). Links to financial transactions. Cross-module activity linking. Equipment catalog with system-suggested items. Depreciation for every item and vehicle (migration 214, asset_depreciation side table; lib/equipment/depreciation.ts: straight line, declining balance, units of use, salvage floor, yearly schedule, book value) and work use (task <-> equipment activity links with relationship 'work' from the planner's Used equipment picker; vehicles use trip miles with purpose work or tax_category business) giving uses, work share, cost per use and work-share depreciation. /api/equipment/depreciation (+ /summary), vehicle page /dashboard/travel/vehicles/[id]. Save for replacement prefills a savings goal.

7. **Workouts & Exercises** — Exercise library with categories (10 defaults + user-created), instructions, form cues, video/audio/media URLs, muscle groups, equipment links, difficulty levels (beginner/intermediate/advanced), equipment classification (none/minimal/gym). 110+ system-seeded exercises. Workout templates and logs with 16+ enhanced fields: RPE, tempo, supersets, circuits, negatives, isometrics, to-failure, unilateral, balance, distance, hold time. Nomad Longevity OS protocol (28 seeded exercises, 12 templates, AM/PM/Hotel/Gym programs, Friction Protocol). Workout feedback system with mood tracking. Social layer: public visibility toggle, like/copy/done counts, shareable links via public alias (no PII), discover pages for browsing public content.

8. **Coaching Gems** — Custom AI personas with configurable data source access (11 types: health, finance, travel, workouts, recipes, planner, academy, daily logs, focus, meals, correlations). File uploads (CSV, images, PDFs). Knowledge base documents. Action execution (create recipes, log workouts, create transactions/tasks/gems, import transactions). Auto-flashcard extraction. Session persistence.

9. **Life Categories** — Polymorphic tagging system. User-defined life areas (Health, Finance, Career, etc.) with icons and colors. Tags apply across all modules via entity_life_categories junction table. Analytics dashboard with spending pie chart and activity bar chart. Batch tagging for uncategorized items.

10. **Data Hub** — Centralized CSV import/export for all modules (finance, health metrics, trips, fuel, maintenance, vehicles, equipment, contacts, tasks, workouts). Template downloads. GenericImportPage component for consistent UX. Google Sheets paste support.

11. **Cross-Module Activity Links** — Bidirectional linking between any entity types (tasks, trips, routes, transactions, recipes, fuel logs, maintenance, invoices, workouts, equipment, focus sessions, exercises, media_items, podcast_episodes, blog_posts). ActivityLinker component with search + pill UI. Integrated into blog PostForm, media detail, and podcast episode pages.

12. **Smart Scan** — Universal OCR-powered document scanner using Gemini Vision. Auto-detects document type (receipt, recipe, fuel receipt, maintenance invoice, medical). Extracts receipt line items with per-item pricing. Historical price tracking per vendor/item/date via item_prices table. Links to contacts, transactions, and other entities.

13. **Institutions Directory** — Public bank and credit card issuer directory with aggregated rates, fees, rewards programs, and dispute windows. Admin-managed promotional offers (signup bonus, balance transfer, cashback, etc.) with short link affiliate tracking.

14. **Short Links & Analytics** — URL shortener with click tracking, UTM parameters, referrer analytics. Page view tracking across the site. Admin dashboard for traffic insights.

15. **Correlations & Analytics** — Pearson correlation analysis across health and lifestyle metrics. Multi-metric trend visualization. Cross-module pattern discovery.

16. **Module Walkthrough Onboarding** — Interactive step-by-step tours for every module. TourOverlay component highlights UI elements with tooltips. Tour progress persists server-side. Users can restart tours from Settings → Module Tours. ModulePickerModal shows available tours on first login. Tour events tracked (started, step_completed, step_skipped, tour_completed, tour_exited).

17. **Blog & Recipe Video Embedding** — VideoEmbed Tiptap extension node for inline video in blog posts and recipes. Supports YouTube, Viloud.tv, Mux, Cloudinary direct. MediaEmbedModal provides tabbed UI (video URL, social embed, image upload, video upload). Blog CSV import auto-inserts VideoEmbed node when video_url column is present. getEmbedUrl utility auto-detects provider and converts to embed format.

18. **Offline Support** — offlineFetch wrapper (lib/offline/offline-fetch). GET responses cached in IndexedDB. POST/PATCH/DELETE mutations queued offline and replayed on reconnection. Text-based pages (tutorials, lessons) available offline once loaded.

19. **Media Tracker** (migration 125) — RETIRED from CentOS in decomposition Stage 1 (Sept 2026): the job moved to Stream.WitUS (stream.witus.online). Media is gone from the nav, Data Hub, Discover, and the public features list, and /features/media (plus /en and /es) 308-redirects to Stream.WitUS via next.config.mjs redirects(). /dashboard/media pages stay reachable by URL, read-only (no add/edit/delete controls), with a move-to-Stream banner and the CSV export (/api/media/export, snake_case headers that Stream's importer reads). Every media write route, plus the /api/podcasts write routes, returns 410 Gone via lib/media/retired.ts, and categories are no longer auto-seeded. Tables are kept until a later stage. The original design, for reference: "All the Spoilers" brand. media_categories (user-defined, auto-seeded: Books, TV & Film, Music, Podcasts, Art, Other). media_items: title, creator, media_type (book/tv_show/movie/video/song/album/podcast/art/article/other), status (want_to_consume/in_progress/completed/dropped), rating 1-5, start/end dates, genre[], tags[], cover image, external URL, progress tracking, season/episode tracking for TV series, brand_id FK, visibility (private/public), year_released, source_platform, notes, is_favorite, use_count. media_notes: per-item notes with content_format (markdown/tiptap), note_type (general/quote/review/podcast_prep/discussion_point/spoiler). podcast_episodes: title, episode/season numbers, air_date, show_notes (markdown/tiptap), audio_url, duration, status (draft/recorded/published). media_episode_links junction: links media items to podcast episodes with discussion_notes and timestamps. APIs: full CRUD for media, categories, notes, podcasts, episode linking. CSV import/export via Data Hub. Dashboard: media hub with summary cards, type/status filters, grid of media cards; detail page with notes editor, linked episodes, ActivityLinker, LifeCategoryTagger; podcast episode list and detail pages.

20. **Social Interactions** (migration 126) — social_likes table (polymorphic: media_item, equipment), social_shares table (share_method: link/embed/social, platform tracking), social_bookmarks table. Denormalized like_count/share_count/bookmark_count on media_items and equipment. Public visibility toggle on media items and equipment. Discover pages for browsing public content. Like/share/bookmark UI on detail pages. Public read policies for equipment and equipment_media when visibility='public'.

21. **Blog & Recipe Search/Filters** — Client-side search by title, description/excerpt, and tags. Visibility filter pills (blog: All/Draft/Public/Private/Members Only/Scheduled; recipes: All/Draft/Public/Scheduled). Sort controls (newest, recently edited, title A-Z). Result count display. Back navigation arrows from edit/create pages to list pages.

22. **Edit Modal Completeness** — All planner entities (tasks, roadmaps, goals, milestones) have fully editable fields in their edit modals. Tasks: date, time, tag (color-coded pills), priority, milestone assignment via RoadmapItemPicker, contact, location, estimated cost. Roadmaps: status (active/archived). Goals: roadmap assignment (move between roadmaps). Milestones: goal assignment (move between goals).

### Admin Panel (18 pages)
Overview, Users (list + detail), Messages, Content moderation, Engagement analytics, Feedback management, Academy settings, Academy courses, Live sessions, Metrics configuration, Institutions directory, App Logs viewer, Usage analytics, Short Links dashboard, Education AI Chat (persistent sessions with tags, notes, full-text search), Tour Analytics.

### AI Integration
- **Coaching Gems**: Full conversational AI with data source injection, file analysis, action execution, flashcard generation
- **Help Chat**: RAG-powered (pgvector cosine similarity on help_articles embeddings)
- **Weekly Review**: AI-generated planner summaries analyzing task completion patterns
- **Smart Scan OCR**: Gemini Vision for receipt/document scanning with line item extraction and price history
- **Fuel OCR**: Gemini Vision for fuel receipt scanning (up to 4 images)
- **Course Embeddings**: Semantic lesson routing for CYOA navigation (within-course and cross-course)
- **Recipe Ideas**: AI-generated recipe suggestions based on dietary preferences
- **Correlations**: Pearson correlation analysis across health/lifestyle metrics
- **Life Retrospective**: AI analysis of calendar history patterns
- **Admin Education Chat**: Persistent AI assistant for codebase Q&A with 5 modes (interview, investor, onboarding, demo, general), searchable history, tags, and notes

### Business Model
- **Subscription plans**: Monthly ($10.60/mo) + Lifetime ($103.29 one-time) via Stripe checkout
- **Teacher plan**: Stripe metadata sets role='teacher', enables course creation + payouts
- **Platform fee**: Configurable teacher_fee_percent (default 10%) on course enrollments
- **Stripe Connect**: Express accounts for teacher payouts with application_fee_amount
- **No free tier**: Signup redirects to /pricing; free routes limited to blog, recipes, billing
- **Invited users**: Admin can grant trial or lifetime access without payment, with optional module restrictions

### Database Architecture
- **219 migrations** in supabase/migrations/ (000 through 217, plus a few unnumbered drafts)
- **Key tables**: profiles, financial_accounts, financial_transactions, budget_categories, vehicles, trips, trip_routes, trip_shares, fuel_logs, vehicle_maintenance, equipment, equipment_categories, equipment_valuations, equipment_media, asset_depreciation, exercises, exercise_categories, workout_logs, workout_templates, courses, lessons, modules (academy), course_prerequisites, prerequisite_override_requests, gem_personas, language_coach_sessions, life_categories, entity_life_categories, activity_links, user_contacts, contact_locations, witus_identities, integration_outbox, scan_images, receipt_line_items, item_prices, institutions, institution_offers, invited_users, teller_enrollments (deprecated 2026-10, unused), admin_chats, admin_chat_messages, app_logs, usage_events, page_views, media_categories, media_items, media_notes, podcast_episodes, media_episode_links, social_likes, social_shares, social_bookmarks
- **Patterns**: Soft-delete via is_active flags, .maybeSingle() for optional rows, service role for admin ops, fire-and-forget logging
- **RLS**: Enabled on all user-facing tables. Service role key bypasses RLS for admin/webhook routes.

### Security
- **Cloudflare Turnstile** on signup page (with dev fallback)
- **Row-Level Security** on all user tables
- **Profiles**: billing/plan/role columns (subscription_status, stripe_*, role, invite_limit, products, selected_modules, cancel_*) are server-only; a trigger rejects anon/authenticated writes (migration 206). Other users are read via the public_profiles view (id, username, display_name, bio, avatar_url, created_at, updated_at); the profiles table is owner-only (migration 207)
- **ADMIN_EMAIL** env var gate for admin routes
- **Middleware** protects admin-only paths
- **File upload limits**: 5 files max, 10MB each for AI chat
- **Rate limiting**: 10 workout feedback submissions per day

### Key Technical Decisions
- **Gemini over OpenAI**: Chose Google's Gemini for chat, embeddings, and vision — single vendor for all AI
- **Supabase over custom DB**: PostgreSQL with built-in auth, RLS, real-time, and pgvector
- **Stripe Connect Express**: Simplest payout model for teacher marketplace
- **Static codebase context over RAG**: For admin education chat, injecting a static knowledge document is simpler and more reliable than embedding source code
- **Fire-and-forget logging**: App logs and usage events never block the user's request
- **CYOA via embeddings**: Lesson navigation uses cosine similarity rather than manual prerequisite graphs, with cross-course matching option
- **Tiptap + Markdown dual support**: Lessons can use either format, stored in same column with content_format flag
- **No bank linking**: Teller was removed in 2026-10 so the app keeps no bank credentials (scripts/teller-revoke-all.mjs revokes the enrollments and overwrites the stored tokens); bank transactions come in by CSV import. The teller_enrollments table and teller_* columns remain, unused, under the shared-database additive rule (migration 201)
- **RideWitUS integration (server to server)**: signed X-Witus-* requests both ways (lib/events/verify-signature.ts receives, lib/events/sign-request.ts sends; a GET signs its path + query). Users are matched by WitUS sign-in subject through witus_identities (lib/witus/identity.ts: userIdForWitusSub / witusSubForUserId; no row = 404 unknown_subject). Incoming: GET /api/v1/ride/vendors (+ /[id], /[id]/prices) is a read-only, paginated list of the user's vendor contacts with locations (no lat/lng), category name and recent item_prices, plus create_vendor_url -> /dashboard/contacts/new?type=vendor (RIDE_VENDOR_API_SECRET); POST /api/v1/ride/resync { witus_sub, scopes, since } re-sends facts, 1 per user per 5 min (RIDE_RESYNC_SECRET; scope envelopes works, calendar is a registerResyncHandler hook, matches not built). Outgoing: envelope.balance for savings goals linked to a trip or equipment item (CentOS link ids, link_source centenarian-os; no vehicle link column yet), queued after goal/allocation writes via after() and nightly, through integration_outbox (migration 217: latest payload per (receiver, user, event_id), backoff 1m/5m/30m/2h/12h then failed, unknown_subject waits; daily cron /api/cron/integration-outbox). ENVELOPE_BALANCE_EVENTS_URL / _SECRET unset = logged no-op. Code: lib/integrations/outbox.ts, lib/integrations/ridewitus/*.
- **offlineFetch pattern**: Drop-in fetch replacement caches in IndexedDB, queues mutations — enables offline-first pages
- **VideoEmbed Tiptap node**: Isomorphic custom node stores src URL, auto-detects provider (YouTube/Viloud/Mux/Cloudinary)
- **Module tours**: TourOverlay component with server-persisted step progress, event tracking, and restart capability

### Tutorial Courses (17 series, 170+ lessons)
Getting Started, Planner, Finance, Travel, Fuel, Engine, Health Metrics, Workouts, Exercises, Blog & Publishing, Recipes, Equipment, Correlations & Analytics, Academy (student), Teaching (teacher), Settings & Billing, Data Hub, Life Categories, Coach & Gems (admin-only). All use CYOA navigation with free preview lessons.

### Project Stats
- ~450+ TypeScript files
- 218 database migrations
- 22+ user-facing modules (including social layer and trip sharing; the media tracker moved to Stream.WitUS)
- 20 admin management pages
- 12 AI-powered features
- 3 wearable integrations (Oura, WHOOP, Garmin)
- All-module CSV import/export pipelines (including media)
- 17 tutorial course series (170+ lessons)
- Interactive module walkthrough onboarding for all major features
- Video embedding in blog posts and recipes (YouTube, Viloud, Mux, Cloudinary)
- Social interactions: likes, shares, bookmarks, discover pages for public content
- Trip sharing with token-based share links (optional expiration, revocable)
- Full booking detail tracking for business travel (flights, hotels, car rentals)
`;
