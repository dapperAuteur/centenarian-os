# CentenarianOS — Remaining Roadmap Implementation Plan

> Generated: February 2026
> Branch: `feat/lms`
> Highest migration applied: `046_course_interactions.sql`

This plan covers every pending item from the Tech Roadmap page, organized by phase with exact files, migration numbers, and implementation notes. Items with existing API routes are marked **API ✅ / UI ❌** — those are UI-only builds.

---

## Phase 4 — Centenarian Academy: Remaining Items

### 4-A. CYOA Crossroads UI (API ✅ / UI ❌)

**Status:** The backend is fully built:
- `app/api/academy/courses/[id]/lessons/[lessonId]/crossroads/route.ts` — returns linear, semantic, and random lesson options
- `app/api/academy/courses/[id]/generate-embeddings/route.ts` — runs Gemini `text-embedding-004` and stores 768-dim vectors

**What's missing:** The post-lesson Crossroads page and the teacher "Generate AI Paths" button.

**Files to create/modify:**

| File | Action |
|---|---|
| `app/academy/[courseId]/lessons/[lessonId]/crossroads/page.tsx` | New — Crossroads choice page |
| `app/academy/[courseId]/lessons/[lessonId]/page.tsx` | Modify — after lesson complete, if CYOA course redirect to crossroads |
| `app/dashboard/teaching/courses/[id]/page.tsx` | Modify — add "Generate AI Paths" button (only when `navigation_mode = 'cyoa'`) |

**Crossroads page design:**
- Fetch options from GET `/api/academy/courses/[id]/lessons/[lessonId]/crossroads`
- Show cards for each option: "Continue Forward" (linear), "Related Path A/B" (semantic), "Unexpected Path" (random), "View Course Map" (client-side full lesson list)
- Each card clicks to `/academy/[courseId]/lessons/[targetLessonId]`
- Course map toggle shows all lessons in a grid with completion checkmarks

**Lesson player redirect logic:**
- When lesson completes (video ends / text read / submit assignment), check `course.navigation_mode`
- If `'cyoa'` → redirect to `.../crossroads`
- If `'linear'` → show next/prev buttons as today

**DB prerequisite — `match_lessons` pgvector function:**
Check if it exists. If not, add to a new migration:
```sql
-- Part of migration 048 if not already present
CREATE OR REPLACE FUNCTION public.match_lessons(
  query_embedding vector(768),
  course_id_filter UUID,
  exclude_lesson_id UUID,
  match_count INT DEFAULT 2
)
RETURNS TABLE (id UUID, title TEXT, similarity FLOAT)
LANGUAGE sql
AS $$
  SELECT l.id, l.title, 1 - (le.embedding <=> query_embedding) AS similarity
  FROM lesson_embeddings le
  JOIN lessons l ON l.id = le.lesson_id
  WHERE l.course_id = course_id_filter
    AND le.lesson_id <> exclude_lesson_id
  ORDER BY le.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

### 4-B. Threaded Chat on Submissions (API ✅ / UI ❌)

**Status:** API fully built at `app/api/academy/assignments/[assignmentId]/submissions/[submissionId]/messages/route.ts` (GET/POST).

**Files to modify:**

| File | Action |
|---|---|
| `app/academy/[courseId]/assignments/[id]/page.tsx` | Add `SubmissionMessageThread` component below submission form |
| `app/dashboard/teaching/courses/[id]/assignments/page.tsx` | Add thread view per submission in teacher grading UI |

**`SubmissionMessageThread` component** (`components/academy/SubmissionMessageThread.tsx`):
- Fetches GET messages on mount
- Auto-refresh every 30s or on focus
- Shows sender avatar, name, timestamp, body
- Input at bottom to POST new message
- Teacher messages styled differently (fuchsia bubble vs gray)
- Media URL support (link to attachment)

---

### 4-C. Course Direct Messages (Student ↔ Teacher Inbox)

**Status:** No API or UI exists. `course_messages` table was defined in `039_lms_schema.sql`.

**Files to create:**

| File | Action |
|---|---|
| `app/api/academy/courses/[id]/messages/route.ts` | New — GET (thread), POST (send) |
| `app/dashboard/teaching/students/messages/page.tsx` | New — teacher inbox: list conversations by course/student |
| `app/dashboard/messages/page.tsx` | New — student inbox: list conversations with teachers |
| `components/academy/CourseMessageThread.tsx` | New — reusable DM thread component |

**API design:**
- `GET /api/academy/courses/[id]/messages?partner_id={userId}` — fetch conversation between current user and partner for this course
- `POST /api/academy/courses/[id]/messages` — body: `{ recipient_id, body, media_url? }`
- Auth: sender must be enrolled student OR teacher of the course

**Inbox pages:** Show list of conversations grouped by course → click to open thread.

---

### 4-D. Teacher Promo Codes (Stripe Coupons)

**Status:** No API or UI. `promo_codes` table defined in `039_lms_schema.sql`. Stripe Coupons API ready to use.

**Files to create:**

| File | Action |
|---|---|
| `app/api/teacher/promo-codes/route.ts` | New — GET (list), POST (create) |
| `app/api/teacher/promo-codes/[id]/route.ts` | New — PATCH (update uses/expiry), DELETE (deactivate) |
| `app/dashboard/teaching/promo-codes/page.tsx` | New — list + create form |

**Create flow:**
1. Teacher fills: code text, discount %, max uses (optional), expiry (optional)
2. POST creates Stripe Coupon → gets `stripe_coupon_id` back
3. Inserts row into `promo_codes` with `stripe_coupon_id`

**Enrollment integration:**
- Add optional `promo_code` field to enrollment checkout body
- `app/api/academy/courses/[id]/enroll/route.ts` — look up `promo_codes` by code, verify it belongs to the course teacher, apply Stripe Coupon to checkout session via `discounts: [{ coupon: stripe_coupon_id }]`

**No new migration needed** — `promo_codes` table already in `039_lms_schema.sql`.

---

### 4-E. Free Trial Periods for Subscription Courses

**Status:** No implementation.

**Files to modify:**

| File | Action |
|---|---|
| `app/api/academy/courses/[id]/route.ts` | PATCH — allow teacher to set `trial_period_days` (1–30) |
| `app/api/academy/courses/[id]/enroll/route.ts` | Pass `subscription_data: { trial_period_days }` to Stripe for subscription-type courses |
| `app/dashboard/teaching/courses/[id]/page.tsx` | Add "Free trial period" field (number input, 0 = no trial) |

**DB change — add to migration `048`:**
```sql
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS trial_period_days INT DEFAULT 0;
```

**Enrollment logic:**
- Only applies when `course.price_type = 'subscription'` AND `trial_period_days > 0`
- Add `subscription_data: { trial_settings: { end_behavior: 'cancel' }, trial_period_days: course.trial_period_days }` to Stripe checkout params

---

### 4-F. Course Reviews and Star Ratings

**Status:** No migration, no API, no UI. Next migration is `048_academy_completion.sql` (or `047` after Switchy).

**DB — Migration `048_academy_completion.sql`:**
```sql
CREATE TABLE public.course_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES public.courses ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, student_id)  -- one review per student per course
);

-- Denormalised average rating on courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS review_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating   NUMERIC(3,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_course_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.courses
  SET
    review_count = (SELECT COUNT(*) FROM public.course_reviews WHERE course_id = COALESCE(NEW.course_id, OLD.course_id)),
    avg_rating   = (SELECT COALESCE(AVG(rating), 0) FROM public.course_reviews WHERE course_id = COALESCE(NEW.course_id, OLD.course_id))
  WHERE id = COALESCE(NEW.course_id, OLD.course_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS course_rating_trigger ON public.course_reviews;
CREATE TRIGGER course_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.course_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_course_rating();

ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select" ON public.course_reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON public.course_reviews FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "reviews_update" ON public.course_reviews FOR UPDATE USING (auth.uid() = student_id);
CREATE POLICY "reviews_delete" ON public.course_reviews FOR DELETE USING (auth.uid() = student_id);
```

**Files to create:**

| File | Action |
|---|---|
| `app/api/academy/courses/[id]/reviews/route.ts` | New — GET (list), POST (create/update) |
| `components/academy/CourseReviews.tsx` | New — star picker + review list |

**Course detail page** (`app/academy/[courseId]/page.tsx`):
- Show average star rating in header (if `review_count > 0`)
- Show review list below course description
- Show "Write a Review" form if student is enrolled and has completed ≥1 lesson
- Only one review per student (POST upserts)

---

### 4-G. Progressive Metric Slots + Re-Enrollment

**Status:** No implementation. Requires migration change to `enrollments`.

**DB — add to Migration `048_academy_completion.sql`:**
```sql
-- Allow re-enrollment (remove old unique constraint, add attempt-based one)
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_user_id_course_id_key,
  ADD COLUMN IF NOT EXISTS attempt_number INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metric_slots   INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS slots_override_by UUID REFERENCES auth.users;

-- New unique: one active enrollment per attempt
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_user_course_attempt
  ON public.enrollments (user_id, course_id, attempt_number);
```

**Re-enrollment API:**
- `app/api/academy/courses/[id]/enroll/route.ts` — add `reattempt: true` to POST body
- If `reattempt`, count existing attempts for this user+course, set `attempt_number = count + 1`, `metric_slots = MIN(attempt_number, 3)`
- Create new Stripe checkout if paid (with new enrollment row), or insert free enrollment directly

**Re-enrollment UI (`app/academy/my-courses/page.tsx`):**
- Completed courses show "Take Again" button
- Clicking POSTs enroll with `reattempt: true`

**Metric slots in assignment UI:**
- `app/academy/[courseId]/assignments/[id]/page.tsx` — read `enrollment.metric_slots` to determine how many metric pickers to show
- Pickers limited to the 4 core metrics (resting_hr, steps, sleep_hours, activity_min)
- Teacher/admin can PATCH `metric_slots` on any enrollment via admin UI

---

### 4-H. AI-Recommended Learning Paths for Students (API ✅ / UI ❌)

**Status:** `app/api/academy/paths/recommend/route.ts` is fully built (Gemini ranking).

**What's missing:** The UI on `/academy/paths` that calls this endpoint and shows the recommended section.

**File to modify:** `app/academy/paths/page.tsx`
- Add "Recommended for You" section above the full path catalog
- Call `GET /api/academy/paths/recommend` client-side
- Show top 3 paths as cards with the AI-generated one-sentence reason
- Skeleton/loading state while fetching

---

### 4-I. AI Path Suggestions for Teachers

**Status:** No API or UI.

**Files to create:**

| File | Action |
|---|---|
| `app/api/teaching/learning-paths/suggest/route.ts` | New — POST, Gemini suggests path groupings |
| `app/dashboard/teaching/learning-paths/page.tsx` | Modify — add "Suggest Paths" button + draft card UI |

**API behavior:**
1. Fetch all of teacher's published courses (titles + descriptions + categories)
2. Send to Gemini: *"Given these courses, suggest 2–3 logical learning path groupings with a title, description, and ordered course list for each. Return JSON."*
3. Return draft path objects — teacher can Accept (creates path), Edit, or Discard

---

## Phase 4 Implementation Order

| Step | Item | Migration | Key Files |
|---|---|---|---|
| 1 | CYOA Crossroads UI | `048` (match_lessons fn) | `app/academy/[courseId]/lessons/[lessonId]/crossroads/page.tsx` |
| 2 | Submission thread UI | none | `components/academy/SubmissionMessageThread.tsx`, assignment pages |
| 3 | Course reviews | `048` | `app/api/academy/courses/[id]/reviews/route.ts` |
| 4 | Progressive slots + re-enrollment | `048` | enroll route, my-courses page |
| 5 | Course DMs | none | `app/api/academy/courses/[id]/messages/route.ts`, inbox pages |
| 6 | Promo codes | none | `app/api/teacher/promo-codes/route.ts`, promo codes page |
| 7 | Free trials | `048` (`trial_period_days` col) | enroll route, course editor |
| 8 | AI path recommendations UI | none | `app/academy/paths/page.tsx` |
| 9 | AI path suggestions for teachers | none | suggest route, teaching paths page |

---

## Phase 5 — Focus Engine & AI Insights: Remaining Items

### 5-A. AI Weekly Review Generation

**Files to create:**

| File | Action |
|---|---|
| `app/api/ai/weekly-review/route.ts` | New — POST, generates review via Gemini |
| `app/dashboard/weekly-review/page.tsx` | New — display generated review |

**API behavior:**
1. Accept `{ week_start: ISO date }` in body
2. Fetch for the user: health metrics (7 days), focus sessions (count, total minutes), meal logs (days logged), lesson progress (lessons completed), task completions
3. Send structured summary to Gemini: *"You are a longevity coach. Based on this week's data, write an encouraging, personalized weekly review (250–400 words) covering: energy/focus patterns, nutrition consistency, learning progress, and one recommended focus for next week."*
4. Return `{ review: string, generated_at: string }`

**Dashboard integration:**
- Add "Weekly Review" card to `/dashboard` home — shows latest review or "Generate This Week's Review" button
- Review page archives past reviews (store in a `weekly_reviews` table or return on-demand without storage)

**Migration (if storing reviews):**
```sql
-- Migration 049_ai_reviews.sql
CREATE TABLE public.weekly_reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);
```

---

### 5-B. Correlation Analysis — Nutrition ↔ Focus/Energy

**Files to create:**

| File | Action |
|---|---|
| `app/api/ai/correlations/route.ts` | New — GET, runs correlation analysis |
| `app/dashboard/correlations/page.tsx` | New — charts + AI insight text |

**API behavior:**
1. Fetch 30 days of: daily_logs (energy_rating, focus_rating), meal_logs (calories, protein_g, etc.), health_metrics (steps, sleep_hours, activity_min)
2. Compute Pearson correlation coefficient for key pairs (e.g., protein intake ↔ focus_rating, sleep_hours ↔ energy_rating, steps ↔ activity_min)
3. Send top correlations to Gemini: *"Given these statistical correlations from a user's 30-day data, write 3 practical insights in plain language. Example: 'On days when you logged 7+ hours of sleep, your focus rating was 23% higher on average.'"*
4. Return `{ correlations: [...], insights: string[] }`

**Charts:** Recharts scatter plots — x-axis = nutrient/metric, y-axis = focus/energy rating, one point per day, linear regression line overlay.

---

### 5-C. Recipe Ideas from Current Inventory (Gemini)

**Files to create:**

| File | Action |
|---|---|
| `app/api/ai/recipe-ideas/route.ts` | New — POST with inventory context |
| `app/dashboard/nutrition/recipe-ideas/page.tsx` | New — generated recipe cards |

**API behavior:**
1. Fetch user's current ingredient inventory (items with quantity > 0)
2. Also read user's dietary preferences / protocol from profile (if stored)
3. Send to Gemini: *"Given these ingredients the user has available: [list]. Suggest 3 recipes that can be made primarily from these ingredients. For each recipe return: name, ingredients used, brief instructions (3–5 steps), estimated prep time, and one nutritional highlight."*
4. Return array of 3 recipe suggestions with structured fields

**UI:** Show recipe cards with an "Import this Recipe" button that pre-fills the recipe editor.

---

### 5-D. Offline-First Architecture (IndexedDB Sync)

This is the most complex Phase 5 item and should be the last to implement.

**Approach:** Use [Dexie.js](https://dexie.org) for IndexedDB with a sync queue.

**Migration:** None needed — server data model stays the same.

**Files to create:**

| File | Action |
|---|---|
| `lib/offline/db.ts` | New — Dexie schema (local tables for tasks, metric logs, focus sessions) |
| `lib/offline/sync.ts` | New — sync queue flush on reconnect |
| `hooks/useOfflineSync.ts` | New — hook that listens for `navigator.onLine` and flushes queue |

**Scope (start minimal):**
- Offline create/update tasks (synced to Supabase on reconnect)
- Offline log daily health metrics (synced on reconnect)
- Read-only access to previously loaded data while offline

**Service worker:** Add `next-pwa` for basic asset caching and shell caching so the dashboard loads offline.

---

## Phase 6 — Switchy.io Short Link Integration

> **Detailed plan already written** at `docs/plans/switchy-shortlinks.md`. Follow that document exactly.

**Summary of work:**

| Step | File |
|---|---|
| 1 | Add `SWITCHY_API_TOKEN`, `SWITCHY_DOMAIN` to `.env.local`, `.env.example`, Vercel |
| 2 | Migration `047_shortlinks.sql` — add `short_link_id`, `short_link_url` to `blog_posts`, `recipes`, `courses` |
| 3 | Create `lib/switchy.ts` — `createShortLink()`, `updateShortLink()`, `toSwitchySlug()` |
| 4 | Update `app/api/blog/[id]/route.ts` PATCH — fire-and-forget Switchy on publish |
| 5 | Update `app/api/recipes/[id]/route.ts` PATCH — same pattern |
| 6 | Update `app/api/academy/courses/[id]/route.ts` PATCH — create on `is_published = true` |
| 7 | Update `lib/blog/share.ts` and `lib/recipes/share.ts` — use `short_link_url ?? fullUrl` |
| 8 | Create `app/admin/shortlinks/page.tsx` + `app/api/admin/shortlinks/sync/route.ts` — backfill page |

---

## Phase 7 — Biometrics & Recovery

### 7-A. Wearable Integrations

All three integrations follow the same pattern: OAuth connect → token storage → daily sync job → normalized data in `user_health_metrics`.

**DB — Migration `050_wearables.sql`:**
```sql
CREATE TABLE public.wearable_connections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  provider       TEXT NOT NULL CHECK (provider IN ('oura','whoop','apple_health')),
  access_token   TEXT,
  refresh_token  TEXT,
  token_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  is_active      BOOL NOT NULL DEFAULT true,
  UNIQUE (user_id, provider)
);
```

**Oura Ring:**
- OAuth: `GET /api/wearables/oura/connect` → redirect to Oura OAuth
- Callback: `GET /api/wearables/oura/callback` → exchange code for token → store in `wearable_connections`
- Sync: `POST /api/wearables/oura/sync` — fetch `/v2/usercollection/daily_readiness`, `/daily_sleep`, `/daily_activity` → upsert into `user_health_metrics` (hrv_ms, sleep_hours, sleep_score, steps, active_calories, recovery_score)

**Whoop:**
- Same pattern with Whoop API v1 (OAuth 2.0)
- Maps: strain → activity_min, recovery → recovery_score, sleep → sleep_hours + hrv_ms

**Apple Health:**
- No OAuth — user exports XML from Health app and uploads it
- `POST /api/wearables/apple-health/import` — parses XML, extracts steps/HR/sleep, upserts to metrics

**UI (`app/dashboard/settings/wearables/page.tsx`):**
- Connect/disconnect buttons per provider
- Last synced timestamp
- Manual "Sync Now" button per connected provider

---

### 7-B. Body Composition Logging

Extend the existing health metrics daily log.

**DB — add to `050_wearables.sql`:**
```sql
ALTER TABLE public.user_health_metrics
  ADD COLUMN IF NOT EXISTS body_fat_pct    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS muscle_mass_lbs NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS bmi             NUMERIC(5,2);
```

**UI:** Add these fields to `components/metrics/DailyMetricForm.tsx` (behind same unlock mechanism as weight).

---

### 7-C. Recovery ↔ Performance Correlation Dashboard

Extends Phase 5-B with wearable data included in the correlation analysis. No new API needed — update `app/api/ai/correlations/route.ts` to also pull from wearable-sourced metrics (hrv_ms, recovery_score, sleep_score).

Add a dedicated page: `app/dashboard/recovery/page.tsx`
- Shows 7/30-day rolling charts: HRV, recovery score, sleep quality
- Recharts area chart overlaid with energy/focus ratings
- AI insight panel from correlations API

---

## Phase 8 — Financial Dashboard

### 8-A. Budget Tracking by Goal Category

**DB — Migration `051_financial_dashboard.sql`:**
```sql
CREATE TABLE public.budget_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name        TEXT NOT NULL,    -- "Supplements", "Gym", "Courses", "Food", etc.
  monthly_budget NUMERIC(10,2),
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.financial_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category_id   UUID REFERENCES public.budget_categories ON DELETE SET NULL,
  amount        NUMERIC(10,2) NOT NULL,
  description   TEXT,
  transaction_date DATE NOT NULL,
  source        TEXT DEFAULT 'manual' CHECK (source IN ('manual','csv_import','stripe')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Files to create:**

| File | Action |
|---|---|
| `app/api/finance/categories/route.ts` | New — CRUD for budget categories |
| `app/api/finance/transactions/route.ts` | New — GET (filtered), POST (manual add) |
| `app/dashboard/finance/page.tsx` | New — budget overview with Recharts donut + bar charts |
| `app/dashboard/finance/transactions/page.tsx` | New — full transaction list with filters |

---

### 8-B. Nutrition Cost Integration

Nutrition spending already tracked per ingredient in the Fuel module. Connect it to the financial dashboard by:
- Auto-categorizing ingredient purchases as "Food" budget category
- `app/api/finance/transactions/route.ts` — GET query joins meal_log costs when `include_nutrition=true`

---

### 8-C. CSV Import / Export

**Import:**
- `app/api/finance/import/route.ts` — POST multipart CSV, parse with `papaparse` (add to dependencies)
- Map columns: date, description, amount, category
- Preview page before confirming import: `app/dashboard/finance/import/page.tsx`

**Export:**
- `app/api/finance/export/route.ts` — GET, returns CSV (set `Content-Type: text/csv; charset=utf-8`)
- Downloadable template: static file at `public/templates/finance-import-template.csv`

---

## Migration Sequence Summary

| Migration | Contents |
|---|---|
| `047_shortlinks.sql` | `short_link_id`, `short_link_url` on blog_posts, recipes, courses |
| `048_academy_completion.sql` | course_reviews + trigger, trial_period_days on courses, match_lessons pgvector fn, enrollments attempt_number + metric_slots |
| `049_ai_reviews.sql` | weekly_reviews table |
| `050_wearables.sql` | wearable_connections, body composition columns on user_health_metrics |
| `051_financial_dashboard.sql` | budget_categories, financial_transactions |

---

## Recommended Execution Order (Overall)

### Sprint 1 — Academy Completion (Phase 4)
1. `048_academy_completion.sql` migration
2. CYOA Crossroads page
3. Submission threaded chat UI
4. Course reviews UI
5. Re-enrollment + progressive metric slots
6. Course DMs
7. Promo codes
8. Free trials
9. AI path UI (student recommendations + teacher suggestions)

### Sprint 2 — Link Tracking (Phase 6)
10. `047_shortlinks.sql` migration
11. `lib/switchy.ts`
12. Blog/recipe/course publish triggers
13. Share bar updates
14. Admin backfill page

### Sprint 3 — AI Insights (Phase 5)
15. AI weekly review generation + storage
16. Correlation analysis charts
17. Recipe ideas from inventory
18. Offline-first (IndexedDB + next-pwa) — last, most disruptive

### Sprint 4 — Biometrics (Phase 7)
19. `050_wearables.sql` migration
20. Oura Ring OAuth + sync
21. Whoop OAuth + sync
22. Apple Health XML import
23. Body composition fields
24. Recovery dashboard

### Sprint 5 — Financial (Phase 8)
25. `051_financial_dashboard.sql` migration
26. Budget categories + transaction CRUD
27. Dashboard charts
28. CSV import (with papaparse)
29. CSV export + template

---

## Environment Variables Needed

| Var | Phase | Purpose |
|---|---|---|
| `SWITCHY_API_TOKEN` | 6 | Switchy.io REST API auth |
| `SWITCHY_DOMAIN` | 6 | `i.centenarianos.com` |
| `OURA_CLIENT_ID` | 7 | Oura OAuth app ID |
| `OURA_CLIENT_SECRET` | 7 | Oura OAuth secret |
| `WHOOP_CLIENT_ID` | 7 | Whoop OAuth app ID |
| `WHOOP_CLIENT_SECRET` | 7 | Whoop OAuth secret |

---

## New npm Dependencies Needed

| Package | Phase | Reason |
|---|---|---|
| `dexie` | 5-D | IndexedDB ORM for offline-first |
| `next-pwa` | 5-D | Service worker / asset caching |
| `papaparse` + `@types/papaparse` | 8 | CSV parsing for financial import |
