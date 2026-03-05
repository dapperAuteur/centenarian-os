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
- **Database**: Supabase (PostgreSQL + Row-Level Security), 85+ migrations
- **Auth**: Supabase Auth (email/password, magic link)
- **Payments**: Stripe (checkout sessions, webhooks, subscription management, Stripe Connect for teacher payouts)
- **AI**: Google Gemini 2.5 Flash (chat, coaching, embeddings, vision/OCR)
- **Embeddings**: Gemini embedding-001 (768-dim vectors, pgvector)
- **Media**: Cloudinary (image/video uploads for courses, exercises, profiles)
- **Charts**: Recharts (admin analytics, finance dashboards)
- **Bot Prevention**: Cloudflare Turnstile on signup

### Core Architecture
- **Admin panel** (/admin/*): Dark theme, gated by ADMIN_EMAIL env var. 12+ management pages covering users, content, feedback, metrics, academy, institutions, logs, usage analytics.
- **User dashboard** (/dashboard/*): Subscription-gated. Free routes: blog, recipes, billing, messages, feedback. Paid routes: finance, travel, planner, workouts, health metrics, equipment, data hub, coaching.
- **API routes** (app/api/*): Next.js Route Handlers. Service role client bypasses RLS for admin and webhook operations.
- **Auth pattern**: createServerClient (SSR cookies) for user auth; service role client for admin ops.
- **Middleware**: Route protection for admin-only paths (/coaching, /dashboard/coach, /dashboard/gems).

### Modules (11+)

1. **Finance** — Financial accounts (checking, savings, credit card, loan, cash), transactions with categories, budgets, recurring transactions, invoices, CSV import/export. Balance = opening_balance + SUM(income) - SUM(expenses). Teller API integration for bank account linking.

2. **Health Metrics** — Three tiers: Core (RHR, steps, sleep, activity calories), Enrichment (per-metric unlock with disclaimer), Body Composition (locked, per-metric acknowledgment). Wearable OAuth: Oura, WHOOP, Garmin with auto-sync. CSV imports: Apple Health, Google Health, InBody, Hume Health. Admin controls global enable/disable and per-user access overrides.

3. **Travel** — Vehicles (with ownership/tax/trip categories), trips (one-way + round-trip), fuel logs (with OCR via Gemini Vision), vehicle maintenance, multi-stop routes, trip templates. Garmin activity import. Bike savings calculator. Each trip leg with cost creates a linked finance transaction.

4. **Planner** — Tasks, milestones, roadmaps, goals. Weekly AI review via Gemini. Task location linking via saved contacts. Calendar import (.ics parser, pure TypeScript). Life retrospective AI analysis.

5. **Academy (LMS)** — Full learning management system. Courses with modules and lessons (markdown or Tiptap rich text). CYOA (Choose Your Own Adventure) navigation via semantic embeddings. Assignments with grading. Live sessions (Viloud.tv iframe embeds). Teacher role with Stripe Connect payouts (configurable platform fee, default 15%). Bulk course import via CSV. Lesson glossary with phonetic spelling.

6. **Equipment Tracker** — Categories (auto-seeded defaults), items with purchase price, valuations over time (value chart). Links to financial transactions. Cross-module activity linking.

7. **Workouts & Exercises** — Exercise library with categories (10 defaults), instructions, form cues, video/audio/media URLs, muscle groups, equipment links. Workout templates and logs with 16+ enhanced fields: RPE, tempo, supersets, circuits, negatives, isometrics, to-failure, unilateral, balance, distance, hold time. Nomad Longevity OS protocol (28 seeded exercises, 12 templates, AM/PM/Hotel/Gym programs, Friction Protocol).

8. **Coaching Gems** — Custom AI personas with configurable data source access (11 types: health, finance, travel, workouts, recipes, planner, academy, daily logs, focus, meals, correlations). File uploads (CSV, images, PDFs). Knowledge base documents. Action execution (create recipes, log workouts, create transactions/tasks/gems, import transactions). Auto-flashcard extraction. Session persistence.

9. **Life Categories** — Polymorphic tagging system. User-defined life areas (Health, Finance, Career, etc.) with icons and colors. Tags apply across all modules via entity_life_categories junction table. Analytics dashboard with spending pie chart and activity bar chart. Batch tagging for uncategorized items.

10. **Data Hub** — Centralized CSV import/export for 10 modules (finance, health metrics, trips, fuel, maintenance, vehicles, equipment, contacts, tasks, workouts). Template downloads. GenericImportPage component for consistent UX.

11. **Cross-Module Activity Links** — Bidirectional linking between any entity types (tasks, trips, routes, transactions, recipes, fuel logs, maintenance, invoices, workouts, equipment, focus sessions, exercises). ActivityLinker component with search + pill UI.

### AI Integration
- **Coaching Gems**: Full conversational AI with data source injection, file analysis, action execution, flashcard generation
- **Help Chat**: RAG-powered (pgvector cosine similarity on help_articles embeddings)
- **Weekly Review**: AI-generated planner summaries analyzing task completion patterns
- **Fuel OCR**: Gemini Vision for receipt scanning (up to 4 images)
- **Course Embeddings**: Semantic lesson routing for CYOA navigation
- **Recipe Ideas**: AI-generated recipe suggestions based on dietary preferences
- **Correlations**: Pearson correlation analysis across health/lifestyle metrics
- **Life Retrospective**: AI analysis of calendar history patterns

### Business Model
- **Subscription plans**: Monthly + Lifetime via Stripe checkout
- **Teacher plan**: Stripe metadata sets role='teacher', enables course creation + payouts
- **Platform fee**: Configurable teacher_fee_percent (default 15%) on course enrollments
- **Stripe Connect**: Express accounts for teacher payouts with application_fee_amount
- **No free tier**: Signup redirects to /pricing; free routes limited to blog, recipes, billing

### Database Architecture
- **85+ migrations** in supabase/migrations/ (000 through 085)
- **Key tables**: profiles, financial_accounts, financial_transactions, budget_categories, vehicles, trips, fuel_logs, vehicle_maintenance, equipment, exercises, workout_logs, workout_templates, courses, lessons, modules (academy), gem_personas, language_coach_sessions, life_categories, entity_life_categories, activity_links, app_logs, usage_events
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
- **CYOA via embeddings**: Lesson navigation uses cosine similarity rather than manual prerequisite graphs
- **Tiptap + Markdown dual support**: Lessons can use either format, stored in same column with content_format flag

### Project Stats
- ~300+ TypeScript files
- 85+ database migrations
- 11+ user-facing modules
- 12+ admin management pages
- 6 AI-powered features
- 3 wearable integrations (Oura, WHOOP, Garmin)
- 10 module CSV import/export pipelines
`;
