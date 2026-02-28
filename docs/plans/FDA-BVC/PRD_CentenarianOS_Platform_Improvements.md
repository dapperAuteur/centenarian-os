# Product Requirements Document: CentenarianOS Platform Improvements
## Features 1–11 — Supporting Follow-Up Courses & Community Growth

**Version:** 1.0
**Date:** February 27, 2026
**Author:** Brand Anthony McDonald
**Status:** Draft
**Depends On:** CentOS Integration Plan v1 (Migration 043), Existing Supabase Auth, Next.js App Router

---

## 1. Executive Summary

This PRD defines 11 new platform features for CentenarianOS.com that enable three follow-up courses (Intervention Design, Data-Informed Coach, Longevity Lab) and strengthen the alumni community. All features extend the existing Supabase + Next.js architecture established in the CentOS Integration Plan.

**Guiding principles:**
- Every feature extends existing tables/patterns — no architecture rewrites
- Students own their data; sharing is always opt-in with granular consent
- Features are built in dependency order so each release is usable on its own
- Type-safe throughout (TypeScript, Zod validation, Prisma-generated types)

---

## 2. Technical Architecture Context

**Existing stack (from CentOS Integration Plan):**
- **Auth:** Supabase Auth (`auth.users`)
- **Database:** Supabase Postgres with RLS
- **API:** Next.js App Router (`app/api/`)
- **AI:** Gemini API for personalized insights
- **Frontend:** Next.js + Tailwind + Recharts
- **Deployment:** Vercel

**Existing tables this PRD extends:**
- `user_health_metrics` — daily metric logs (one row per user per day)
- `health_metric_goals` — user targets for each metric
- `assignments` — course assignment definitions (has `requires_metrics` JSONB)
- `assignment_submissions` — student work (has `metric_snapshot` JSONB)

---

## 3. Feature Specifications

---

### Feature 1: Experiment Builder

**Priority:** 1 (build first)
**Unlocks:** Intervention Design Course, improved Foundations Week 4, all experiment-dependent features
**Estimated effort:** 2 weeks

#### What It Does

A guided workflow where students create structured self-experiments. Replaces the manual N-of-1 paper worksheet from Foundations Week 4. The builder walks students through: hypothesis → metric selection → baseline dates → intervention dates → daily protocol → success criteria. Once created, the experiment links to the student's `user_health_metrics` rows for those date ranges.

#### Database Schema

```sql
-- Migration: 044_experiments.sql
BEGIN;

CREATE TYPE experiment_status AS ENUM ('draft', 'baseline', 'active', 'complete', 'abandoned');

CREATE TABLE IF NOT EXISTS public.user_experiments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Design
  title             TEXT        NOT NULL,               -- e.g. "14-Day Bedtime Consistency Test"
  hypothesis        TEXT        NOT NULL,               -- "If I go to bed at the same time..."
  intervention_desc TEXT        NOT NULL,               -- what the student will change
  control_desc      TEXT,                               -- what stays the same
  success_criteria  TEXT,                               -- "Sleep score improves by 5+ points"

  -- Metrics
  primary_metric    TEXT        NOT NULL,               -- column name from user_health_metrics (e.g. 'sleep_hours')
  secondary_metrics TEXT[],                             -- additional metrics to track

  -- Dates
  baseline_start    DATE        NOT NULL,
  baseline_end      DATE        NOT NULL,
  intervention_start DATE       NOT NULL,
  intervention_end  DATE        NOT NULL,

  -- State
  status            experiment_status NOT NULL DEFAULT 'draft',

  -- Linking
  course_id         UUID,                               -- optional: links to course assignment
  protocol_id       UUID,                               -- optional: links to shared protocol (Feature 8)

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily adherence log (did the student follow the protocol today?)
CREATE TABLE IF NOT EXISTS public.experiment_adherence (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   UUID    NOT NULL REFERENCES public.user_experiments(id) ON DELETE CASCADE,
  logged_date     DATE    NOT NULL,
  adherence       TEXT    NOT NULL CHECK (adherence IN ('yes', 'partial', 'no')),
  notes           TEXT,
  UNIQUE (experiment_id, logged_date)
);

-- RLS
ALTER TABLE public.user_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_adherence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own experiments"
  ON public.user_experiments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own adherence"
  ON public.experiment_adherence FOR ALL TO authenticated
  USING (
    experiment_id IN (SELECT id FROM public.user_experiments WHERE user_id = auth.uid())
  );

COMMIT;
```

#### API Routes

```
app/api/experiments/
  route.ts              — GET (list user's experiments), POST (create new)
  [id]/route.ts         — GET (single), PATCH (update), DELETE
  [id]/status/route.ts  — PATCH (transition status: draft→baseline→active→complete)
  [id]/adherence/route.ts — GET (list), POST (log daily adherence)
  [id]/results/route.ts — GET (computed baseline vs intervention comparison)
  templates/route.ts    — GET (list available templates — Feature 5)
```

**`GET /api/experiments/[id]/results`** — The key endpoint. Queries `user_health_metrics` for the baseline and intervention date ranges, computes averages/min/max for primary and secondary metrics, calculates absolute and percentage change, and returns a structured comparison object:

```typescript
interface ExperimentResults {
  experimentId: string;
  primaryMetric: {
    name: string;
    baseline: { avg: number; min: number; max: number; days: number };
    intervention: { avg: number; min: number; max: number; days: number };
    absoluteChange: number;
    percentChange: number;
  };
  secondaryMetrics: Array<{
    name: string;
    baseline: { avg: number; min: number; max: number };
    intervention: { avg: number; min: number; max: number };
    absoluteChange: number;
    percentChange: number;
  }>;
  adherence: { total: number; yes: number; partial: number; no: number };
  geminiSummary?: string;  // AI-generated plain-language interpretation
}
```

#### UI Pages

**`/dashboard/experiments`** — List view showing all user experiments with status badges (Draft, Baseline, Active, Complete). "New Experiment" button launches the builder wizard.

**`/dashboard/experiments/new`** — 4-step wizard:
1. **Hypothesis** — text inputs for title, hypothesis, intervention description, success criteria
2. **Metrics** — dropdown selects from the 4 core + optional metrics in `user_health_metrics`
3. **Timeline** — date pickers for baseline start/end and intervention start/end. Validation: baseline minimum 7 days, intervention minimum 7 days, intervention starts after baseline ends.
4. **Review & Launch** — summary card showing all selections. "Start Experiment" button sets status to `baseline`.

**`/dashboard/experiments/[id]`** — Experiment detail page:
- Status bar showing current phase with progress
- During baseline/active: daily adherence check-in card ("Did you follow your protocol today?")
- Chart showing primary metric values with vertical line at intervention start date
- After completion: results summary (Feature 2)

#### Validation Rules (Zod)

```typescript
const experimentSchema = z.object({
  title: z.string().min(5).max(200),
  hypothesis: z.string().min(10).max(500),
  interventionDesc: z.string().min(10).max(500),
  controlDesc: z.string().max(500).optional(),
  successCriteria: z.string().max(300).optional(),
  primaryMetric: z.enum(['resting_hr', 'steps', 'sleep_hours', 'activity_min',
    'sleep_score', 'hrv_ms', 'spo2_pct', 'active_calories', 'weight_lbs',
    'stress_score', 'recovery_score']),
  secondaryMetrics: z.array(z.string()).max(3).optional(),
  baselineStart: z.string().date(),
  baselineEnd: z.string().date(),
  interventionStart: z.string().date(),
  interventionEnd: z.string().date(),
});
```

#### Acceptance Criteria

- Student can create, edit, and delete experiments
- Experiment status transitions enforce correct order (draft → baseline → active → complete)
- Results endpoint returns accurate averages computed from `user_health_metrics` for the experiment's date ranges
- Daily adherence log is optional but prompted during active phase
- Experiments with fewer than 5 baseline days logged show a warning
- Mobile-responsive wizard works on screens ≥ 320px

---

### Feature 2: Experiment Results Dashboard

**Priority:** 2
**Unlocks:** Intervention Design capstone, student "aha moment," Gemini AI experiment analysis
**Estimated effort:** 1 week
**Depends on:** Feature 1

#### What It Does

Auto-generated comparison view displayed on the experiment detail page after an experiment reaches `complete` status. Shows baseline vs. intervention averages for primary and secondary metrics, with before/after bar charts, a trend line chart with intervention-start marker, and a Gemini AI plain-language summary.

#### UI Components

**`components/experiments/ExperimentResultsCard.tsx`:**
- Before/after comparison bars (primary metric: large display, secondary: smaller)
- Absolute change with ↑/↓ arrow
- Percentage change badge (green if improvement direction, amber if neutral, red if regression)
- Adherence score: "You followed the protocol 12 of 14 days (86%)"

**`components/experiments/ExperimentTrendChart.tsx`:**
- Recharts `LineChart` spanning baseline + intervention dates
- Vertical dashed line at intervention start with label "Intervention started"
- Dots colored by adherence (green = yes, yellow = partial, gray = no)

**`components/experiments/ExperimentAISummary.tsx`:**
- Calls `POST /api/health-metrics/insights` with experiment-specific prompt:

```
Analyze this student's self-experiment:
Title: [title]
Hypothesis: [hypothesis]
Intervention: [intervention_desc]

Baseline period ([baseline_start] to [baseline_end]):
[primary_metric] average: [X], range: [min]–[max]

Intervention period ([intervention_start] to [intervention_end]):
[primary_metric] average: [Y], range: [min]–[max]

Adherence: [X] of [Y] days followed protocol

In 150 words or less:
1. Did the data support the hypothesis?
2. What's one thing that might explain the result?
3. What would you suggest the student try next?
```

#### Acceptance Criteria

- Results display automatically when experiment status changes to `complete`
- Chart renders correctly with 7–30 day date ranges
- Gemini summary generates within 5 seconds
- Works on mobile (chart scrolls horizontally if needed)

---

### Feature 3: Achievement Badges System

**Priority:** 3
**Unlocks:** Alumni retention, gamification across all courses, profile enrichment
**Estimated effort:** 1 week

#### Database Schema

```sql
-- Migration: 045_badges.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id          TEXT    PRIMARY KEY,   -- e.g. 'foundations_graduate'
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL,
  icon_url    TEXT,                  -- path to badge SVG/PNG
  category    TEXT    NOT NULL,      -- 'course', 'streak', 'community', 'experiment'
  sort_order  INT     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    TEXT        NOT NULL REFERENCES public.badge_definitions(id),
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB,       -- optional context: { "experiment_count": 3, "streak_days": 30 }
  UNIQUE (user_id, badge_id)
);

-- RLS: users read own badges; badge_definitions readable by all authenticated
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own badges"
  ON public.user_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts badges"
  ON public.user_badges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone reads badge definitions"
  ON public.badge_definitions FOR SELECT TO authenticated
  USING (true);

COMMIT;
```

#### Initial Badge Definitions

| ID | Name | Criteria | Category | Trigger |
|---|---|---|---|---|
| `foundations_graduate` | Foundations Graduate | Complete Foundations course | course | Course completion webhook |
| `intervention_designer` | Intervention Designer | Complete Intervention Design course | course | Course completion webhook |
| `community_coach` | Community Coach | Complete Data-Informed Coach course | course | Course completion webhook |
| `cohort_contributor` | Cohort Contributor | Participate in Longevity Lab | course | Course completion webhook |
| `streak_7` | Week Warrior | 7 consecutive days logged | streak | Nightly cron job |
| `streak_30` | Monthly Master | 30 consecutive days logged | streak | Nightly cron job |
| `streak_365` | Centenarian in Training | 365 consecutive days logged | streak | Nightly cron job |
| `first_experiment` | First Experiment | Complete one experiment | experiment | Experiment status → complete |
| `protocol_scientist` | Protocol Scientist | Complete 3+ experiments | experiment | Experiment status → complete |
| `one_metric_challenge` | Challenge Complete | Finish One Metric Challenge | community | 30-day challenge completion |

#### Badge Award Logic

Badges are awarded by a server-side function (`lib/badges/award-badge.ts`) called from relevant event handlers. Streak badges are checked by a Vercel Cron Job running nightly at 2 AM UTC.

```typescript
// lib/badges/award-badge.ts
export async function awardBadge(
  userId: string,
  badgeId: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase
    .from('user_badges')
    .upsert({ user_id: userId, badge_id: badgeId, metadata }, {
      onConflict: 'user_id,badge_id'
    });
  return !error;
}
```

#### UI Components

**`components/badges/BadgeGrid.tsx`** — Displays earned badges on user profile. Unearned badges shown as grayed-out silhouettes with criteria tooltips.

**`components/badges/BadgeNotification.tsx`** — Toast notification when a badge is awarded. Animated badge icon with confetti effect (lightweight CSS animation, no heavy libraries).

#### API Routes

```
app/api/badges/
  route.ts             — GET (list user's earned badges)
  definitions/route.ts — GET (all badge definitions for display grid)
```

#### Acceptance Criteria

- Badges award correctly based on triggers
- Duplicate awards are silently ignored (upsert)
- Profile page displays badge grid
- Toast notification appears on new badge award
- Streak calculation handles timezone correctly (uses user's logged_date, not server time)

---

### Feature 4: Protocol Library (Personal)

**Priority:** 4
**Unlocks:** Intervention Design capstone asset, long-term user retention
**Estimated effort:** 1 week
**Depends on:** Feature 1

#### What It Does

A section of the user's dashboard where completed experiments are stored as reusable "protocols" — personal reference cards showing: what was tested, what happened, and whether the student would do it again. Think recipe box for health experiments.

#### Database Schema

No new tables needed. Extends `user_experiments` with two columns:

```sql
-- Migration: 046_protocol_library.sql
ALTER TABLE public.user_experiments ADD COLUMN IF NOT EXISTS
  is_in_library BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_experiments ADD COLUMN IF NOT EXISTS
  library_tags TEXT[];  -- e.g. ['sleep', 'effective', 'easy']

ALTER TABLE public.user_experiments ADD COLUMN IF NOT EXISTS
  would_repeat BOOLEAN;  -- "Would I do this again?"

ALTER TABLE public.user_experiments ADD COLUMN IF NOT EXISTS
  effectiveness_rating INT CHECK (effectiveness_rating BETWEEN 1 AND 5);
```

#### UI Pages

**`/dashboard/protocols`** — Library view. Grid of protocol cards, filterable by tag and effectiveness rating. Each card shows: title, primary metric, change achieved, effectiveness stars, "would repeat" badge.

**Protocol card expanded view** — Shows full experiment details + results (links to Feature 2 results dashboard).

#### API

Extend existing `GET /api/experiments` with `?library=true` filter parameter.

`PATCH /api/experiments/[id]` — accepts `is_in_library`, `library_tags`, `would_repeat`, `effectiveness_rating` fields.

#### Acceptance Criteria

- Completed experiments can be added to library with one click
- Library view loads with cards sorted by effectiveness rating (highest first)
- Tags are user-defined freetext (no predefined taxonomy)
- Protocol Library is accessible from dashboard sidebar navigation

---

### Feature 5: Experiment Templates

**Priority:** 5
**Unlocks:** Faster experiment setup, reusable course content, peer sharing
**Estimated effort:** 1 week
**Depends on:** Feature 1

#### Database Schema

```sql
-- Migration: 047_experiment_templates.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.experiment_templates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by        UUID        NOT NULL REFERENCES auth.users(id),
  title             TEXT        NOT NULL,
  hypothesis_template TEXT      NOT NULL,   -- e.g. "If I [change], then my [metric] will [direction]"
  intervention_desc TEXT        NOT NULL,
  control_desc      TEXT,
  primary_metric    TEXT        NOT NULL,
  secondary_metrics TEXT[],
  suggested_baseline_days INT   NOT NULL DEFAULT 7,
  suggested_intervention_days INT NOT NULL DEFAULT 14,
  tags              TEXT[],
  is_public         BOOLEAN     NOT NULL DEFAULT false,  -- instructor-published
  is_official       BOOLEAN     NOT NULL DEFAULT false,  -- BAM-curated
  use_count         INT         NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.experiment_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read public templates; users can read their own
CREATE POLICY "Read public or own templates"
  ON public.experiment_templates FOR SELECT TO authenticated
  USING (is_public = true OR created_by = auth.uid());

-- Users can create their own
CREATE POLICY "Users create own templates"
  ON public.experiment_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

COMMIT;
```

#### Initial Official Templates

| Title | Primary Metric | Intervention | Baseline/Intervention Days |
|---|---|---|---|
| 14-Day Bedtime Consistency Test | sleep_hours | Go to bed within ±15 min of target time | 7 / 14 |
| Morning Walk Experiment | resting_hr | 10-min walk within 30 min of waking | 7 / 14 |
| Screen Curfew Sleep Test | sleep_score | No screens 60 min before bed | 7 / 14 |
| Step Count Challenge | steps | Increase daily steps by 2,000 | 7 / 14 |
| Activity Minutes Boost | activity_min | Add 3 × 20-min exercise sessions per week | 7 / 21 |

#### UI

**Template browser** inside the experiment wizard (Step 0 before the 4-step flow): "Start from scratch" or "Use a template." Template cards show title, metric, suggested duration, use count.

**"Save as template"** button on completed experiments in Protocol Library — creates a template from the experiment's design.

#### API

```
app/api/experiments/templates/
  route.ts       — GET (list public + own), POST (create from experiment)
  [id]/route.ts  — GET (single template), POST /clone (create experiment from template)
```

---

### Feature 6: Guest Dashboard / Coaching View

**Priority:** 6
**Unlocks:** Data-Informed Coach course, Health Buddy upgrade
**Estimated effort:** 2 weeks

#### What It Does

Allows one user (the "coach") to view another user's (the "student's") selected health metrics — with explicit, granular, revocable consent from the student. The student chooses exactly which metric categories to share. The coach sees trends and averages but cannot export raw data.

#### Database Schema

```sql
-- Migration: 048_coaching_view.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.metric_sharing_consents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  grantor_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- student
  grantee_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- coach
  shared_metrics  TEXT[]      NOT NULL,   -- e.g. ['steps', 'sleep_hours'] (column names from user_health_metrics)
  relationship    TEXT        NOT NULL DEFAULT 'buddy',  -- 'buddy', 'coach', 'mentee'
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  granted_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.metric_sharing_consents ENABLE ROW LEVEL SECURITY;

-- Both parties can see their own consents
CREATE POLICY "Users see own consents"
  ON public.metric_sharing_consents FOR SELECT TO authenticated
  USING (auth.uid() = grantor_id OR auth.uid() = grantee_id);

-- Only the grantor (student) can create/update consent
CREATE POLICY "Grantor manages consent"
  ON public.metric_sharing_consents FOR ALL TO authenticated
  USING (auth.uid() = grantor_id) WITH CHECK (auth.uid() = grantor_id);

COMMIT;
```

#### Consent Flow

1. Coach sends sharing request via CentenarianOS (specifies which metrics they'd like to see)
2. Student receives notification: "[Name] would like to view your [steps, sleep] data"
3. Student reviews request, can modify which metrics to share, then approves or declines
4. If approved: `status` → `active`, `granted_at` set
5. Either party can revoke at any time: `status` → `revoked`, `revoked_at` set

#### API Routes

```
app/api/coaching/
  consents/route.ts          — GET (list my consents, both as grantor and grantee)
  consents/request/route.ts  — POST (coach requests access)
  consents/[id]/route.ts     — PATCH (approve/revoke/modify metrics)
  view/[userId]/route.ts     — GET (fetch shared metrics for a specific user — checks consent)
```

**`GET /api/coaching/view/[userId]`** — Critical endpoint. Before returning any data:
1. Verify an `active` consent exists where `grantee_id = auth.uid()` and `grantor_id = [userId]`
2. Filter `user_health_metrics` to only return columns listed in `shared_metrics`
3. Return 30-day summary (averages, trends) — never raw daily rows
4. If no active consent → 403 Forbidden

#### UI Pages

**`/dashboard/coaching`** — List of people the user coaches (where they're the grantee) and people who coach them (where they're the grantor).

**`/dashboard/coaching/[userId]`** — Read-only trend view of the shared person's approved metrics. Shows 7-day and 30-day averages, sparkline trends. No export button. Banner at top: "You're viewing [Name]'s shared metrics. They've chosen to share: steps, sleep duration."

**`/dashboard/settings/sharing`** — User manages all their active consents. Can revoke any consent, modify which metrics are shared, see who has access.

#### Privacy Requirements

- No data leaves the platform (no export, no API for raw daily rows)
- Consent is stored with timestamps for audit trail
- Revocation is immediate — cached views invalidate on next request
- Student name displayed to coach only if student has opted into public profile
- All coaching view access is logged for compliance monitoring

#### Acceptance Criteria

- Student can grant, modify, and revoke metric sharing with a single toggle
- Coach can only view approved metrics (server-side enforcement, not just UI)
- Revoking consent immediately blocks access (no stale data)
- Sharing request notifications appear in the student's notification center
- Works on mobile

---

### Feature 7: Cohort View (Anonymized Aggregate Dashboard)

**Priority:** 7
**Unlocks:** Longevity Lab course launch requirement
**Estimated effort:** 2 weeks
**Depends on:** Feature 1

#### What It Does

A real-time anonymized display showing a cohort's collective data during an active group experiment. No individual identification — only distributions and aggregates. Requires minimum cohort size to display (differential privacy threshold).

#### Database Schema

```sql
-- Migration: 049_cohorts.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.cohorts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT        NOT NULL,
  description     TEXT,
  instructor_id   UUID        NOT NULL REFERENCES auth.users(id),
  protocol_id     UUID,       -- links to shared protocol (Feature 8)
  status          TEXT        NOT NULL DEFAULT 'enrolling'
    CHECK (status IN ('enrolling', 'baseline', 'active', 'complete', 'archived')),
  min_cohort_size INT         NOT NULL DEFAULT 10,  -- minimum for aggregate display
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cohort_members (
  cohort_id       UUID    NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  experiment_id   UUID    REFERENCES public.user_experiments(id),  -- their individual experiment instance
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_aggregate BOOLEAN NOT NULL DEFAULT false,  -- opted into aggregate display
  PRIMARY KEY (cohort_id, user_id)
);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;

-- Instructor manages cohorts they created
CREATE POLICY "Instructor manages cohorts"
  ON public.cohorts FOR ALL TO authenticated
  USING (auth.uid() = instructor_id);

-- Members can read their own cohort
CREATE POLICY "Members read own cohort"
  ON public.cohorts FOR SELECT TO authenticated
  USING (id IN (SELECT cohort_id FROM public.cohort_members WHERE user_id = auth.uid()));

-- Users manage own membership
CREATE POLICY "Users manage own membership"
  ON public.cohort_members FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
```

#### API Routes

```
app/api/cohorts/
  route.ts                  — GET (list user's cohorts), POST (instructor creates)
  [id]/route.ts             — GET (cohort detail + member count)
  [id]/join/route.ts        — POST (student joins)
  [id]/aggregate/route.ts   — GET (anonymized aggregate data)
```

**`GET /api/cohorts/[id]/aggregate`** — The critical endpoint:
1. Verify requesting user is a member of the cohort
2. Count members with `consent_aggregate = true`
3. If count < `min_cohort_size` → return `{ status: 'insufficient_participants', required: X, current: Y }`
4. Query `user_health_metrics` for all consenting members for the cohort's date range
5. Return ONLY aggregates — never individual rows:

```typescript
interface CohortAggregate {
  cohortId: string;
  participantCount: number;
  dateRange: { start: string; end: string };
  metrics: {
    [metricName: string]: {
      groupAvg: number;
      groupMedian: number;
      groupMin: number;
      groupMax: number;
      stdDev: number;
      distribution: number[];  // histogram buckets for chart
    };
  };
  todayLoggedCount: number;   // "32 of 45 participants logged today"
  overallAdherenceRate: number;
}
```

#### Differential Privacy Implementation

- Minimum cohort size configurable per cohort (default 10, minimum 5)
- Individual rows never exposed through any API — aggregate queries only
- Distribution histograms use wide enough bins that individual data points aren't identifiable
- Instructor sees same aggregate view as students (no individual student data through cohort view)
- Consent is opt-in per cohort (`consent_aggregate` field)

#### UI Pages

**`/dashboard/cohorts/[id]`** — Cohort home page showing:
- Cohort status and timeline
- Participation bar: "38 of 45 members logged today"
- Aggregate metric cards with group averages and distributions
- Histogram charts (Recharts `BarChart`) showing distribution of each metric across the cohort

**`/dashboard/cohorts/[id]/my-data`** — Student's personal experiment within the cohort context. Shows their individual data overlaid against the group average (their line vs. group average line).

---

### Feature 8: Protocol Builder (Collaborative)

**Priority:** 8
**Unlocks:** Longevity Lab course launch requirement
**Estimated effort:** 1.5 weeks
**Depends on:** Features 1, 5, 7

#### What It Does

Instructor creates a protocol template; students vote on parameters; once finalized, the protocol auto-generates individual experiments for all enrolled cohort members.

#### Database Schema

```sql
-- Migration: 050_protocols.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.shared_protocols (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id           UUID        NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  created_by          UUID        NOT NULL REFERENCES auth.users(id),  -- instructor
  title               TEXT        NOT NULL,
  description         TEXT,
  hypothesis_template TEXT        NOT NULL,
  primary_metric      TEXT        NOT NULL,
  secondary_metrics   TEXT[],
  baseline_days       INT         NOT NULL DEFAULT 7,
  intervention_days   INT         NOT NULL DEFAULT 14,

  -- Voting options (instructor provides 2-4 intervention choices)
  intervention_options JSONB      NOT NULL,  -- [{ "id": "a", "label": "Consistent bedtime", "desc": "..." }, ...]
  selected_option     TEXT,                  -- winning option ID after vote closes
  vote_status         TEXT        NOT NULL DEFAULT 'open' CHECK (vote_status IN ('open', 'closed')),

  -- Dates (set by instructor after vote closes)
  baseline_start      DATE,
  intervention_start  DATE,

  status              TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'voting', 'finalized', 'active', 'complete')),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.protocol_votes (
  protocol_id     UUID    NOT NULL REFERENCES public.shared_protocols(id) ON DELETE CASCADE,
  user_id         UUID    NOT NULL REFERENCES auth.users(id),
  option_id       TEXT    NOT NULL,
  voted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (protocol_id, user_id)
);

ALTER TABLE public.shared_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cohort members read protocols"
  ON public.shared_protocols FOR SELECT TO authenticated
  USING (cohort_id IN (SELECT cohort_id FROM public.cohort_members WHERE user_id = auth.uid()));

CREATE POLICY "Instructor manages protocols"
  ON public.shared_protocols FOR ALL TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users vote on protocols"
  ON public.protocol_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
```

#### Protocol Lifecycle

1. **Draft** — Instructor creates protocol with 2–4 intervention options
2. **Voting** — Students vote on preferred intervention (one vote per student)
3. **Finalized** — Instructor closes vote, selects winning option, sets dates
4. **Active** — System auto-creates individual `user_experiments` for each cohort member with the finalized protocol parameters. Students begin baseline tracking.
5. **Complete** — All experiments complete. Cohort Results Dashboard (Feature 9) generates.

#### Bulk Experiment Creation

When protocol status transitions to `active`, a server function creates one `user_experiments` row per cohort member:

```typescript
async function createCohortExperiments(protocolId: string) {
  const protocol = await getProtocol(protocolId);
  const members = await getCohortMembers(protocol.cohortId);

  for (const member of members) {
    await supabase.from('user_experiments').insert({
      user_id: member.userId,
      title: protocol.title,
      hypothesis: protocol.hypothesisTemplate,
      intervention_desc: protocol.selectedOptionDescription,
      primary_metric: protocol.primaryMetric,
      secondary_metrics: protocol.secondaryMetrics,
      baseline_start: protocol.baselineStart,
      baseline_end: addDays(protocol.baselineStart, protocol.baselineDays - 1),
      intervention_start: protocol.interventionStart,
      intervention_end: addDays(protocol.interventionStart, protocol.interventionDays - 1),
      status: 'baseline',
      protocol_id: protocolId,
      course_id: protocol.cohortId
    });
  }
}
```

---

### Feature 9: Cohort Results Dashboard

**Priority:** 9
**Unlocks:** Longevity Lab capstone, marketing content, Cohort Reports
**Estimated effort:** 1.5 weeks
**Depends on:** Features 2, 7, 8

#### What It Does

After a cohort experiment completes, auto-generates group-level analysis: distribution of outcomes (histogram), responder vs. non-responder split, adherence correlation, and Gemini AI narrative summary. This data powers the published Cohort Report.

#### API

**`GET /api/cohorts/[id]/results`** — Returns:

```typescript
interface CohortResults {
  cohortId: string;
  protocolTitle: string;
  participantCount: number;
  completionRate: number;  // % who reached 'complete' status

  primaryMetric: {
    name: string;
    groupBaselineAvg: number;
    groupInterventionAvg: number;
    groupAbsoluteChange: number;
    groupPercentChange: number;
    improvedCount: number;     // participants whose metric improved
    unchangedCount: number;
    worsenedCount: number;
    distributionOfChanges: number[];  // histogram of individual % changes
  };

  adherenceCorrelation: {
    highAdherence: { count: number; avgChange: number };   // >80% adherence
    lowAdherence: { count: number; avgChange: number };    // <80% adherence
  };

  geminiNarrative?: string;  // AI-generated 300-word Cohort Report summary
}
```

#### UI

**`/dashboard/cohorts/[id]/results`** — Cohort results page:
- Big number cards: "42 participants, 38 completed (90%)"
- Pie chart: improved / unchanged / worsened split
- Histogram: distribution of individual changes (e.g., "most participants improved sleep by 5–15%")
- Adherence correlation card: "Participants with >80% adherence saw X% improvement vs Y% for lower adherence"
- Gemini AI narrative block
- "Publish as Cohort Report" button (instructor only) — creates a community blog post

---

### Feature 10: Adherence Tracker

**Priority:** 10
**Unlocks:** Longevity Lab analysis quality, experiment reliability
**Estimated effort:** 3 days
**Depends on:** Feature 1 (already built into experiment_adherence table)

This feature is largely implemented by the `experiment_adherence` table in Feature 1. The remaining work is UI polish:

**Daily prompt card** — During active experiment phase, shows on the dashboard home widget: "Today's experiment check-in: Did you follow your protocol? [Yes] [Partially] [No]" with optional notes field.

**Adherence timeline** — Visual on experiment detail page: row of colored dots for each day (green/yellow/red). Helps students see adherence patterns at a glance.

**Aggregate adherence** — For cohort experiments, the adherence data feeds into Feature 9's correlation analysis.

---

### Feature 11: Coaching Playbook Templates

**Priority:** 11
**Unlocks:** Data-Informed Coach course polish
**Estimated effort:** 2 days

#### What It Does

A structured blog post template specifically for coaching documentation. When a student in the Data-Informed Coach course publishes their coaching playbook, it uses this template for consistent structure.

#### Implementation

No new database tables. Uses the existing CentenarianOS blog/post system with a `post_type` field or tag:

```sql
-- If blog posts have a type field:
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'standard';
-- Coaching playbooks use post_type = 'coaching_playbook'
```

#### Template Sections (rendered as structured form)

1. **My Coaching Philosophy** (200 words max)
2. **First Week Checklist** — what to track, what to ignore, how to set up
3. **Conversation Starters** — 3–5 questions to ask someone about their data
4. **My Go-To Experiment Templates** — links to templates from Feature 5
5. **Scope of Practice Statement** — pre-filled with standard language the student customizes

#### UI

Blog editor shows the template sections as labeled text areas when `post_type = 'coaching_playbook'`. Published playbooks display with the "Coaching Playbook" tag and a distinctive card design in the community feed.

---

## 4. Implementation Plan — Phased Build Order

### Phase A: Experimentation Core (Weeks 1–4)
*Unlocks: Intervention Design course*

| Week | Features | Deliverable |
|---|---|---|
| 1–2 | Feature 1: Experiment Builder | Migration 044, API routes, wizard UI, experiment detail page |
| 3 | Feature 2: Experiment Results Dashboard | Results card, trend chart, Gemini experiment summary |
| 3 | Feature 3: Achievement Badges | Migration 045, badge definitions, award logic, profile grid, streak cron |
| 4 | Feature 4: Protocol Library | Migration 046, library view, tagging, effectiveness rating |
| 4 | Feature 5: Experiment Templates | Migration 047, template browser, official templates seeded, "save as template" |

**Milestone:** Intervention Design course can launch.

### Phase B: Coaching & Sharing (Weeks 5–6)
*Unlocks: Data-Informed Coach course, Health Buddy upgrade*

| Week | Features | Deliverable |
|---|---|---|
| 5–6 | Feature 6: Guest Dashboard / Coaching View | Migration 048, consent flow, coaching view page, sharing settings |
| 6 | Feature 11: Coaching Playbook Templates | Blog template type, structured editor, community feed integration |

**Milestone:** Data-Informed Coach course can launch.

### Phase C: Collaborative Science (Weeks 7–10)
*Unlocks: Longevity Lab course*

| Week | Features | Deliverable |
|---|---|---|
| 7–8 | Feature 7: Cohort View | Migration 049, cohort creation, aggregate API with differential privacy, aggregate dashboard |
| 8–9 | Feature 8: Protocol Builder | Migration 050, protocol lifecycle, voting UI, bulk experiment creation |
| 9–10 | Feature 9: Cohort Results Dashboard | Group results API, histograms, responder analysis, Gemini cohort narrative |
| 10 | Feature 10: Adherence Tracker | Daily prompt card, adherence timeline, aggregate adherence for cohort |

**Milestone:** Longevity Lab course can launch.

### Total Timeline: 10 weeks

**Dependencies visualization:**

```
Feature 1 (Experiment Builder) ──┬── Feature 2 (Results Dashboard) ──── Feature 9 (Cohort Results)
                                 ├── Feature 4 (Protocol Library)
                                 ├── Feature 5 (Templates) ──── Feature 8 (Protocol Builder)
                                 └── Feature 10 (Adherence Tracker)

Feature 3 (Badges) ──── standalone

Feature 6 (Coaching View) ──── Feature 11 (Coaching Playbook Templates)

Feature 7 (Cohort View) ──── Feature 8 (Protocol Builder) ──── Feature 9 (Cohort Results)
```

---

## 5. Testing Strategy

Each feature requires:
- **Unit tests** (Jest): Zod schema validation, badge award logic, aggregate computation functions
- **Integration tests** (Jest): API route tests with mock Supabase client — verify RLS enforcement, consent checks, cohort membership verification
- **E2E tests** (Cypress): Full user flows — create experiment, complete it, view results, add to library

**Critical security tests:**
- Coaching View: verify a user CANNOT access another user's metrics without active consent
- Cohort Aggregate: verify individual rows are NEVER returned, only aggregates
- Consent revocation: verify data access stops immediately after revocation
- RLS enforcement: verify direct Supabase queries respect row-level security

---

## 6. Migration Execution Order

```
044_experiments.sql          — Feature 1 (Experiment Builder + Adherence)
045_badges.sql               — Feature 3 (Achievement Badges)
046_protocol_library.sql     — Feature 4 (Protocol Library — ALTER TABLE)
047_experiment_templates.sql — Feature 5 (Experiment Templates)
048_coaching_view.sql        — Feature 6 (Guest Dashboard / Coaching View)
049_cohorts.sql              — Feature 7 (Cohort View)
050_protocols.sql            — Feature 8 (Protocol Builder)
```

All migrations use `IF NOT EXISTS` and `BEGIN/COMMIT` for safe re-runs.
