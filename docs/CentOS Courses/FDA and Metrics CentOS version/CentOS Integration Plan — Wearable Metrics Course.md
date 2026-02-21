# CentOS Integration Plan — Foundations of Fitness and Health Metrics Course

## Overview

This document defines the technical architecture and product design for integrating the "Foundations of Fitness and Health Metrics" course into CentenarianOS. The goal is to allow **paid users to log their real wearable data inside the app** and have that data automatically woven into course lessons and assignments — so each student's learning is personalized to their actual numbers.

---

## Core Concept

The course teaches users to read the metrics their Apple Watch, Fitbit, Garmin, Oura Ring, or phone tracks — and use those numbers to make small decisions that compound into big health results over time.

Right now the course material references "your data" as something students fill into a paper worksheet. The CentOS integration makes this live:

- Students log their 4 core metrics daily inside the app
- Assignments auto-populate with the student's real baseline numbers
- Gemini AI analyzes their personal trends and generates insights
- The capstone ("My Health Blueprint") is built directly from their 5-week data history

---

## Course Structure (5 Weeks)

| Week | Topic | Key Assignment |
|---|---|---|
| 1 | Foundations of Health Metrics | Baseline Assessment — log first 7 days of metrics |
| 2 | Wearable Technology & Data Collection | Device Accuracy Experiment — track same metric multiple ways |
| 3 | Sleep Optimization | Sleep Experiment — change one variable, track for 7 days |
| 4 | N-of-1 Experiments with Intensity Minutes | Personal Experiment — run controlled test for 10+ days |
| 5 | Long-Term Trends & Sustainable Improvement | My Health Blueprint — capstone 90-day plan using full data history |

---

## The 4 Core Metrics (Plus Optionals)

### Required for Course
| Metric | Unit | Source Device |
|---|---|---|
| **Resting Heart Rate (RHR)** | BPM | Watch, ring, app |
| **Daily Steps** | steps | Watch, phone, ring |
| **Sleep Duration** | hours (decimal) | Watch, ring, phone |
| **Activity Minutes** | minutes | Watch, app |

### Optional Enrichment Metrics
| Metric | Unit | Notes |
|---|---|---|
| Sleep Score | 0–100 | Fitbit, Oura, Garmin |
| HRV (Heart Rate Variability) | ms | Apple Watch, Garmin, Oura, Whoop |
| SpO2 (Blood Oxygen) | % | Apple Watch, Fitbit, Garmin |
| Calories Burned (Active) | kcal | Watch, app |
| Body Weight | lbs or kg | Smart scale, manual |
| Stress Score | 0–100 | Garmin, Fitbit |
| Recovery Score | 0–100 | Whoop, Oura |

---

## Database Schema

### Migration: `043_health_metrics.sql`

```sql
BEGIN;

-- Daily metric logs (one row per user per day)
CREATE TABLE IF NOT EXISTS public.user_health_metrics (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date     DATE        NOT NULL,

  -- Core 4 metrics
  resting_hr      INT,            -- BPM
  steps           INT,            -- count
  sleep_hours     NUMERIC(4,2),   -- e.g. 7.25
  activity_min    INT,            -- minutes

  -- Optional enrichment
  sleep_score     INT,            -- 0-100
  hrv_ms          INT,            -- milliseconds
  spo2_pct        NUMERIC(5,2),   -- e.g. 98.5
  active_calories INT,            -- kcal
  weight_lbs      NUMERIC(6,2),
  stress_score    INT,            -- 0-100
  recovery_score  INT,            -- 0-100

  notes           TEXT,           -- free-form daily journal note

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, logged_date)
);

-- Goals (user sets targets for each metric)
CREATE TABLE IF NOT EXISTS public.health_metric_goals (
  user_id         UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rhr_target      INT,
  steps_target    INT,
  sleep_hours_target NUMERIC(4,2),
  activity_min_target INT,
  hrv_target      INT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_metric_goals ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own data
CREATE POLICY "Users manage own metrics"
  ON public.user_health_metrics FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own goals"
  ON public.health_metric_goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_health_metrics_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_health_metrics_updated_at
  BEFORE UPDATE ON public.user_health_metrics
  FOR EACH ROW EXECUTE FUNCTION update_health_metrics_updated_at();

COMMIT;
```

---

## API Routes

```
app/api/
  health-metrics/
    route.ts           — GET (fetch range), POST (log/upsert today's data)
    [date]/route.ts    — GET (single day), PATCH (update), DELETE
    goals/route.ts     — GET/PUT user metric goals
    summary/route.ts   — GET 7-day and 30-day aggregates (avg, min, max)
    insights/route.ts  — POST → Gemini analyzes last N days, returns personalized insights
```

### `GET /api/health-metrics?from=YYYY-MM-DD&to=YYYY-MM-DD`
Returns all logged metric rows for the authenticated user in the date range. Used for charts and assignment pre-fill.

### `POST /api/health-metrics`
Body: `{ logged_date, resting_hr?, steps?, sleep_hours?, activity_min?, ...optionals, notes? }`
Upserts the row for the given date (creates if missing, updates if exists).

### `GET /api/health-metrics/summary`
Returns:
```json
{
  "7day": { "resting_hr": { "avg": 62, "min": 58, "max": 66 }, "steps": { "avg": 7200, ... }, ... },
  "30day": { ... },
  "streak": 12,  // consecutive days logged
  "total_days_logged": 34
}
```

### `POST /api/health-metrics/insights`
Body: `{ days: 7 | 14 | 30 }`
Fetches the user's last N days of data, builds a prompt, calls Gemini, returns a 150–300 word personalized insight.

---

## UI Pages

### `/dashboard/metrics` — Daily Metrics Log

The main data entry hub. Accessed from Dashboard sidebar under "My Metrics."

**Layout:**
- **Date selector** at top — defaults to today, can navigate to past dates
- **Quick-entry cards** — one card per metric with large number input:
  - Resting Heart Rate (BPM)
  - Steps
  - Sleep (hours — number input with 0.25 step, or slider)
  - Activity Minutes
- **Optional metrics accordion** — expand to log enrichment metrics
- **Notes field** — free-text daily reflection
- **Save button** — upserts the row
- **"Metrics this week" mini chart** — small sparkline charts showing last 7 days for each metric (Recharts `LineChart`)
- **Streak badge** — "X consecutive days logged" — gamification nudge

**Empty state:**
First-time view shows onboarding card explaining what to log and why, with links to course Week 1.

### `/dashboard/metrics/history` — History & Trends

Full chart view:
- **Date range selector** — 7 days, 30 days, 90 days, custom
- **Line chart per metric** with goal line overlaid (if user has set a goal)
- **Summary stats** — avg, min, max per metric for the period
- **Export CSV** button — downloads all logged data as CSV

### Metrics Widget on Dashboard Home

A compact card on `/dashboard` showing:
- Today's logged metrics (or prompt to log if not yet done)
- 7-day trend arrows (↑ ↓ →) for each core metric
- Streak count

---

## Course Assignment Integration

This is the core differentiator. Each course assignment can access the student's logged metric data, pre-filling numbers and validating that real data was submitted.

### How It Works

1. When a student opens an assignment, the assignment template detects which **metric fields** are expected
2. The app fetches the student's relevant metrics from the date range covered by the assignment
3. Metric values auto-populate into assignment form fields
4. Student reviews, adds reflection/analysis text, and submits
5. Teacher sees both the raw numbers (from the DB) and the student's written analysis

### Assignment Template Schema (additions to `assignments` table)

```sql
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS
  requires_metrics JSONB; -- e.g. {"metrics": ["resting_hr","steps","sleep_hours"], "days": 7}
```

When `requires_metrics` is set, the assignment UI fetches and displays a read-only metrics summary panel pulled from `user_health_metrics` for the assignment period.

### Assignment `submissions` additions

```sql
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS
  metric_snapshot JSONB; -- captured metric data at time of submission
```

At submission time, the current metric summary is captured and saved alongside the student's written response. Teachers can see the actual data even if the student later logs more entries.

---

## Week-by-Week Assignment Design

### Week 1 — Baseline Assessment

**Assignment title:** "My Starting Dashboard"

**What it does:**
- Prompts student to log 7 days of metrics before submitting
- App checks `user_health_metrics` for the past 7 days — if < 5 days are logged, shows a warning ("Log at least 5 days before submitting for the most accurate baseline")
- Auto-populates the submission form with:
  - 7-day averages for each core metric
  - Min and max values
  - Best and worst days
- Student fills in:
  - "Which metric surprised you most and why?"
  - "Which metric do you most want to improve?"
  - Their initial goal for each metric (saved to `health_metric_goals`)
- Teacher sees: the pre-populated numbers + the student's reflection

**Deliverable:** Completed baseline form with real data + written reflection

---

### Week 2 — Device Accuracy Experiment

**Assignment title:** "How Accurate Is My Device?"

**What it does:**
- Student chooses one metric to compare across two measurement sources (e.g., steps from Apple Watch vs steps from iPhone, or resting HR from watch vs manual count)
- Logs each source's readings for 7 days (manual entry for the second source in the notes field)
- App displays the logged data in a comparison table
- Student fills in:
  - Variance they observed between sources
  - Which source they'll trust going forward and why
  - Implication for their personal precision (not accuracy) baseline

**Deliverable:** Comparison data + 200-word analysis

---

### Week 3 — Sleep Experiment

**Assignment title:** "My Sleep Variable Test"

**What it does:**
- Student picks one sleep variable to change (bedtime, screen cutoff, temperature, caffeine cutoff, etc.)
- Logs baseline sleep hours and sleep score (if available) for 7 days before the change
- Logs the same metrics for 7 days after the change
- App auto-fetches both 7-day windows from `user_health_metrics` and presents:
  - Before average vs After average
  - Change in sleep hours
  - Change in sleep score (if logged)
  - Chart showing the trend across both periods
- Student fills in:
  - What variable they changed
  - Their hypothesis before the experiment
  - Observed result vs hypothesis
  - Whether they'll keep the change

**Deliverable:** Before/after data (auto-populated) + experiment analysis

---

### Week 4 — N-of-1 Intensity Minutes Experiment

**Assignment title:** "My Personal Activity Experiment"

**What it does:**
- Student selects a specific activity change to test (e.g., add 20 min walks 3x/week, shift to morning workouts, add one strength session per week)
- Logs activity minutes (and optionally RHR and sleep) for 10–14 days during the experiment
- App fetches the experiment window from `user_health_metrics`
- Generates a simple correlation analysis (did activity minutes correlate with improved RHR or sleep?)
- Student fills in:
  - Experiment design (what, when, duration)
  - Did they meet their activity target each day? (streak from logged data)
  - Outcome: what changed in other metrics

**Deliverable:** 10-day data window + experiment write-up + Gemini-generated correlation insight

---

### Week 5 — My Health Blueprint (Capstone)

**Assignment title:** "My 90-Day Health Blueprint"

**What it does:**
- Pulls the student's full 5-week data history (all logged metrics from course start date)
- Generates a personalized Gemini AI summary:
  - "Your 5-week journey: [what improved, what stayed flat, standout patterns]"
  - Top 2 recommendations based on their data
- Auto-populates the capstone form with:
  - All 4 core metric averages across the 5 weeks
  - Week 1 baseline vs Week 5 current (change over the course)
  - Their stated goals from Week 1
- Student fills in:
  - Top 3 health goals for the next 90 days (informed by their data)
  - Key habits they commit to (from the experiment results)
  - Which metric they'll prioritize and their target value
- Generates a printable/downloadable "My Health Blueprint" PDF

**Deliverable:** Complete capstone document with real data + AI summary + student commitments

---

## Gemini AI Insights Feature

Accessible on the `/dashboard/metrics` page and embedded in assignments.

### How It Works

1. User (or assignment) triggers an insight request
2. API fetches last N days of metric data from `user_health_metrics`
3. Builds a structured prompt:

```
You are a health metrics coach for Centenarian Academy.

Here are the student's health metrics for the past 14 days:
[date] | RHR: 64 | Steps: 7200 | Sleep: 7.5h | Activity: 45min
[date] | RHR: 61 | Steps: 8100 | Sleep: 6.8h | Activity: 62min
...

Their stated goals:
- Resting HR target: 58 BPM
- Steps target: 8000/day
- Sleep target: 7.5 hours
- Activity target: 150 min/week

In 200 words or less, provide:
1. One specific positive trend you see
2. One specific area to focus on this week
3. One small, actionable experiment they could try

Be specific to their numbers. Be encouraging and science-informed.
```

4. Returns a personalized 200-word insight block displayed in the UI

### Privacy Note

The Gemini prompt never sends the user's name, email, or identifying information — only metric data and goals.

---

## Access Control — Paid Users Only

The metrics dashboard and course data integration are gated behind a paid plan.

### Gating Logic

- `user_health_metrics` table accessible to any authenticated user (for future free-tier logging)
- `/dashboard/metrics` page: available to members with `status = 'active'` (paid plan)
- AI insights (`/api/health-metrics/insights`): requires paid plan
- Assignment metric pre-fill: requires course enrollment (already handled by existing enrollment gating)

### Enforcement

In `/dashboard/metrics/page.tsx`, check subscription status using the existing `useSubscription` hook:

```ts
const { status } = useSubscription();
if (status !== 'active') redirect('/dashboard/upgrade');
```

---

## Data Import (Future: Phase 2)

Manual daily log is the MVP. Phase 2 can add automated imports:

| Source | Method | Notes |
|---|---|---|
| Apple Health | HealthKit export → parse XML | User exports from Health app, uploads XML |
| Fitbit | OAuth2 API | Fitbit Web API with user auth |
| Garmin | Garmin Connect API | OAuth2 |
| Oura | Oura Cloud API v2 | Token-based |
| Google Fit | OAuth2 | Android/Wear users |
| CSV upload | Parse generic CSV | Works for any device that exports data |

MVP focus: manual entry only. The form is fast (< 30 seconds per day).

---

## Implementation Phases

### Phase 1 — MVP (Build This First)
1. Migration `043_health_metrics.sql`
2. `GET/POST /api/health-metrics` routes
3. `GET /api/health-metrics/summary` route
4. `/dashboard/metrics` daily log page
5. Metrics widget on dashboard home
6. Week 1 assignment integration (baseline auto-populate)

### Phase 2 — Full Course Integration
7. `POST /api/health-metrics/insights` (Gemini AI)
8. Week 2–4 assignment metric pre-fill
9. Week 5 capstone with full history + AI summary
10. `/dashboard/metrics/history` with charts and CSV export
11. Health metric goals setting

### Phase 3 — Enrichment
12. Optional metric fields (HRV, SpO2, recovery score)
13. Apple Health XML import
14. Fitbit OAuth import
15. Correlation charts (activity minutes vs RHR, sleep hours vs steps next day)
16. Community aggregate view (anonymized — "How do you compare to community averages?")

---

## Marketing Angle

The in-app metrics tracker is itself a marketing hook for the course:

- Free users see the metrics dashboard teaser with a "Unlock with any plan" CTA
- Landing page emphasizes: "Your data, your curriculum — lessons that adapt to your actual numbers"
- Email drip (existing sequences in supporting docs): add "Your wearable is teaching you something — learn to listen" angle
- Social posts: "What if your Fitbit data was part of your homework?"

---

## Files to Create/Modify

### New Files
- `supabase/migrations/043_health_metrics.sql`
- `app/api/health-metrics/route.ts`
- `app/api/health-metrics/[date]/route.ts`
- `app/api/health-metrics/goals/route.ts`
- `app/api/health-metrics/summary/route.ts`
- `app/api/health-metrics/insights/route.ts`
- `app/dashboard/metrics/page.tsx`
- `app/dashboard/metrics/history/page.tsx`
- `components/metrics/DailyMetricForm.tsx`
- `components/metrics/MetricSparkline.tsx`
- `components/metrics/MetricsSummaryCard.tsx`
- `components/metrics/InsightCard.tsx`

### Modified Files
- `app/dashboard/page.tsx` — add MetricsSummaryCard widget
- `app/dashboard/layout.tsx` — add "My Metrics" nav item
- `app/academy/[courseId]/assignments/[id]/page.tsx` — add metric pre-fill panel when `requires_metrics` is set
- `supabase/migrations/039_lms_schema.sql` (or new migration) — add `requires_metrics` and `metric_snapshot` columns

---

## Key Design Decisions

**Why manual entry first?**
Every device exports data differently. Manual entry works for everyone on day one — Apple Watch, Fitbit, Garmin, Oura, or just a phone step counter. Users who log manually develop the habit of reading their metrics daily, which is itself a core learning outcome of the course.

**Why one row per day per user?**
Simplicity. Daily averages are what the course works with. Intra-day granularity (minute-by-minute HR) is outside the scope of this course.

**Why NUMERIC(4,2) for sleep hours?**
Allows 7.25, 6.75, etc. Devices report in 15-minute increments commonly, and users often remember approximate times.

**Why capture `metric_snapshot` at submission?**
Students who continue logging after submitting would otherwise have their submission data change retroactively. Snapshot at submit preserves the state the teacher saw.
