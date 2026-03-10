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
- **Database**: Supabase (PostgreSQL + Row-Level Security), 104+ migrations
- **Auth**: Supabase Auth (email/password, magic link)
- **Payments**: Stripe (checkout sessions, webhooks, subscription management, Stripe Connect for teacher payouts)
- **AI**: Google Gemini 2.5 Flash (chat, coaching, embeddings, vision/OCR)
- **Embeddings**: Gemini text-embedding-004 (768-dim vectors, pgvector)
- **Media**: Cloudinary (image/video uploads for courses, exercises, profiles, blog posts)
- **Video Embedding**: VideoEmbed Tiptap node (YouTube, Viloud.tv, Mux, Cloudinary direct) — used in blog posts and recipes
- **Offline**: offlineFetch wrapper caches GETs in IndexedDB, queues mutations for replay — all contractor/lister pages
- **Charts**: Recharts (admin analytics, finance dashboards)
- **Banking**: Teller API (bank account OAuth linking and auto-sync)
- **Bot Prevention**: Cloudflare Turnstile on signup

### Core Architecture
- **Admin panel** (/admin/*): Dark theme, gated by ADMIN_EMAIL env var. 18 management pages covering users, content, feedback, metrics, academy, institutions, logs, usage analytics, short links, education chat.
- **User dashboard** (/dashboard/*): Subscription-gated. Free routes: blog, recipes, billing, messages, feedback. Paid routes: finance, travel, planner, workouts, health metrics, equipment, data hub, coaching, scan, categories.
- **API routes** (app/api/*): Next.js Route Handlers. Service role client bypasses RLS for admin and webhook operations.
- **Auth pattern**: createServerClient (SSR cookies) for user auth; service role client for admin ops.
- **Middleware**: Route protection for admin-only paths (/coaching, /dashboard/coach, /dashboard/gems).
- **Invited Users**: Admin can grant access without Stripe subscription — trial or lifetime, with optional module-level restrictions.

### Modules (15+)

1. **Finance** — Financial accounts (checking, savings, credit card, loan, cash), transactions with categories, budgets, recurring transactions, invoices, CSV import/export. Balance = opening_balance + SUM(income) - SUM(expenses). Teller API integration for bank account OAuth linking and auto-sync. Institution policies (APR, fees, rewards, dispute windows). Saved contacts with default categories for auto-fill.

2. **Health Metrics** — Three tiers: Core (RHR, steps, sleep, activity calories), Enrichment (per-metric unlock with disclaimer), Body Composition (locked, per-metric acknowledgment). Wearable OAuth: Oura, WHOOP, Garmin with auto-sync. CSV imports: Apple Health, Google Health, InBody, Hume Health. Admin controls global enable/disable and per-user access overrides.

3. **Travel** — Vehicles (with ownership/tax/trip categories), trips (one-way + round-trip), fuel logs (with OCR via Gemini Vision), vehicle maintenance, multi-stop routes with trip_routes table, trip templates (single + multi-stop). Garmin activity import. Bike savings calculator. Each trip leg with cost creates a linked finance transaction.

4. **Planner** — Tasks, milestones, roadmaps, goals. Weekly AI review via Gemini. Task location linking via saved contacts with sub-locations. Calendar import (.ics parser, pure TypeScript). Life retrospective AI analysis of calendar history patterns.

5. **Academy (LMS)** — Full learning management system. Courses with modules and lessons (markdown or Tiptap rich text). CYOA (Choose Your Own Adventure) navigation via semantic embeddings, including cross-course CYOA matching. Course prerequisites (required/recommended) with student override request workflow. Assignments with grading. Live sessions (Viloud.tv iframe embeds). Teacher role with Stripe Connect payouts (configurable platform fee, default 15%). Bulk course import via CSV. Lesson glossary with phonetic spelling. Content-seen tracking for enrollment progress.

6. **Equipment Tracker** — Categories (auto-seeded defaults), items with purchase price, valuations over time (value chart). Links to financial transactions. Cross-module activity linking. Equipment catalog with system-suggested items.

7. **Workouts & Exercises** — Exercise library with categories (10 defaults + user-created), instructions, form cues, video/audio/media URLs, muscle groups, equipment links, difficulty levels (beginner/intermediate/advanced), equipment classification (none/minimal/gym). 110+ system-seeded exercises. Workout templates and logs with 16+ enhanced fields: RPE, tempo, supersets, circuits, negatives, isometrics, to-failure, unilateral, balance, distance, hold time. Nomad Longevity OS protocol (28 seeded exercises, 12 templates, AM/PM/Hotel/Gym programs, Friction Protocol). Workout feedback system with mood tracking. Social layer: public visibility toggle, like/copy/done counts, shareable links via public alias (no PII), discover pages for browsing public content.

8. **Coaching Gems** — Custom AI personas with configurable data source access (11 types: health, finance, travel, workouts, recipes, planner, academy, daily logs, focus, meals, correlations). File uploads (CSV, images, PDFs). Knowledge base documents. Action execution (create recipes, log workouts, create transactions/tasks/gems, import transactions). Auto-flashcard extraction. Session persistence.

9. **Life Categories** — Polymorphic tagging system. User-defined life areas (Health, Finance, Career, etc.) with icons and colors. Tags apply across all modules via entity_life_categories junction table. Analytics dashboard with spending pie chart and activity bar chart. Batch tagging for uncategorized items.

10. **Data Hub** — Centralized CSV import/export for all modules (finance, health metrics, trips, fuel, maintenance, vehicles, equipment, contacts, tasks, workouts). Template downloads. GenericImportPage component for consistent UX. Google Sheets paste support.

11. **Cross-Module Activity Links** — Bidirectional linking between any entity types (tasks, trips, routes, transactions, recipes, fuel logs, maintenance, invoices, workouts, equipment, focus sessions, exercises). ActivityLinker component with search + pill UI.

12. **Smart Scan** — Universal OCR-powered document scanner using Gemini Vision. Auto-detects document type (receipt, recipe, fuel receipt, maintenance invoice, medical). Extracts receipt line items with per-item pricing. Historical price tracking per vendor/item/date via item_prices table. Links to contacts, transactions, and other entities.

13. **Institutions Directory** — Public bank and credit card issuer directory with aggregated rates, fees, rewards programs, and dispute windows. Admin-managed promotional offers (signup bonus, balance transfer, cashback, etc.) with short link affiliate tracking.

14. **Short Links & Analytics** — URL shortener with click tracking, UTM parameters, referrer analytics. Page view tracking across the site. Admin dashboard for traffic insights.

15. **Correlations & Analytics** — Pearson correlation analysis across health and lifestyle metrics. Multi-metric trend visualization. Cross-module pattern discovery.

16. **Module Walkthrough Onboarding** — Interactive step-by-step tours for every module. TourOverlay component highlights UI elements with tooltips. Tour progress persists server-side. Users can restart tours from Settings → Module Tours. ModulePickerModal shows available tours on first login. Tour events tracked (started, step_completed, step_skipped, tour_completed, tour_exited).

17. **Blog & Recipe Video Embedding** — VideoEmbed Tiptap extension node for inline video in blog posts and recipes. Supports YouTube, Viloud.tv, Mux, Cloudinary direct. MediaEmbedModal provides tabbed UI (video URL, social embed, image upload, video upload). Blog CSV import auto-inserts VideoEmbed node when video_url column is present. getEmbedUrl utility auto-detects provider and converts to embed format.

18. **Offline Support (Contractor & Lister)** — All 24 contractor and lister pages use offlineFetch wrapper (lib/offline/offline-fetch). GET responses cached in IndexedDB. POST/PATCH/DELETE mutations queued offline and replayed on reconnection. Text-based pages (tutorials, lessons) available offline once loaded.

### Admin Panel (18 pages)
Overview, Users (list + detail), Messages, Content moderation, Engagement analytics, Feedback management, Academy settings, Academy courses, Live sessions, Metrics configuration, Institutions directory, App Logs viewer, Usage analytics, Short Links dashboard, Education AI Chat (persistent sessions with tags, notes, full-text search), Tour Analytics, Contractor Users management.

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
- **Subscription plans**: Monthly ($10/mo) + Lifetime ($100 one-time) via Stripe checkout
- **Teacher plan**: Stripe metadata sets role='teacher', enables course creation + payouts
- **Platform fee**: Configurable teacher_fee_percent (default 15%) on course enrollments
- **Stripe Connect**: Express accounts for teacher payouts with application_fee_amount
- **No free tier**: Signup redirects to /pricing; free routes limited to blog, recipes, billing
- **Invited users**: Admin can grant trial or lifetime access without payment, with optional module restrictions

### Database Architecture
- **117+ migrations** in supabase/migrations/ (000 through 117)
- **Key tables**: profiles, financial_accounts, financial_transactions, budget_categories, vehicles, trips, trip_routes, fuel_logs, vehicle_maintenance, equipment, equipment_categories, equipment_valuations, exercises, exercise_categories, workout_logs, workout_templates, courses, lessons, modules (academy), course_prerequisites, prerequisite_override_requests, gem_personas, language_coach_sessions, life_categories, entity_life_categories, activity_links, user_contacts, contact_locations, scan_images, receipt_line_items, item_prices, institutions, institution_offers, invited_users, teller_enrollments, admin_chats, admin_chat_messages, app_logs, usage_events, page_views
- **Patterns**: Soft-delete via is_active flags, .maybeSingle() for optional rows, service role for admin ops, fire-and-forget logging
- **RLS**: Enabled on all user-facing tables. Service role key bypasses RLS for admin/webhook routes.

### Security
- **Cloudflare Turnstile** on signup page (with dev fallback)
- **Row-Level Security** on all user tables
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
- **Teller API for banking**: OAuth-based bank account linking for transaction auto-sync, institution policy tracking
- **offlineFetch pattern**: Drop-in fetch replacement caches in IndexedDB, queues mutations — enables offline-first contractor/lister apps
- **VideoEmbed Tiptap node**: Isomorphic custom node stores src URL, auto-detects provider (YouTube/Viloud/Mux/Cloudinary)
- **Module tours**: TourOverlay component with server-persisted step progress, event tracking, and restart capability

### Tutorial Courses (19 series, 200+ lessons)
Getting Started, Planner, Finance, Travel, Fuel, Engine, Health Metrics, Workouts, Exercises, Blog & Publishing, Recipes, Equipment, Correlations & Analytics, Academy (student), Teaching (teacher), Settings & Billing, Data Hub, Life Categories, Coach & Gems (admin-only), Contractor (JobHub, 15 lessons), Lister (CrewOps, 13 lessons). All use CYOA navigation with free preview lessons.

### Project Stats
- ~400+ TypeScript files
- 117+ database migrations
- 18+ user-facing modules (including contractor, lister, social layer)
- 20 admin management pages
- 12 AI-powered features
- 3 wearable integrations (Oura, WHOOP, Garmin)
- All-module CSV import/export pipelines
- 19 tutorial course series (200+ lessons)
- Offline-first contractor and lister apps (24 pages)
- Interactive module walkthrough onboarding for all major features
- Video embedding in blog posts and recipes (YouTube, Viloud, Mux, Cloudinary)
`;
