# CentenarianOS Academy — Phase 1 Improvements for Foundations Course
## Making the Platform the Classroom

**Version:** 1.0
**Date:** February 27, 2026
**Context:** The "Foundations of Fitness and Health Metrics" 5-week course has been developed with lecture scripts, assignments, and a capstone project. This document specifies how CentenarianOS.com should be improved to deliver and support this course natively — replacing external tools with integrated platform features.

---

## Current State vs. Target State

| Component | Current State | Target State (CentenarianOS Academy) |
|---|---|---|
| **Lecture delivery** | Scripts exist as documents; no delivery mechanism | Video/text lessons hosted in Academy LMS with progress tracking |
| **Assignment submission** | Manual (PDF worksheets) | Interactive forms that auto-populate from student's metric data |
| **Metric tracking** | CentOS Integration Plan (Migration 043) — daily log page | Same, but assignments pull from it automatically |
| **AI insights** | Gemini endpoint exists in plan | Integrated into assignment feedback and weekly check-ins |
| **Quizzes/knowledge checks** | Written in lecture scripts; no delivery mechanism | Interactive quiz component with instant scoring |
| **Capstone (Health Blueprint)** | Markdown template | Interactive form pre-filled from 5-week data history, generates PDF |
| **Data Story assignment** | Defined in revised Week 5 script | Text submission with rubric-linked scoring |
| **Progress tracking** | None | Week-by-week progress bar, locked/unlocked content |
| **Course navigation** | None | CYOA-style supplementary paths + linear core path |
| **Student onboarding** | Email sequence exists | In-app onboarding wizard + device setup help |
| **Instructor dashboard** | None | Class-wide metrics, submission tracking, grade book |

---

## Academy LMS Architecture

### Database Schema

```sql
-- Migration: 051_academy_lms.sql
BEGIN;

-- Courses
CREATE TABLE IF NOT EXISTS public.courses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT        NOT NULL,
  slug            TEXT        UNIQUE NOT NULL,   -- e.g. 'foundations-fitness-health-metrics'
  description     TEXT,
  instructor_id   UUID        NOT NULL REFERENCES auth.users(id),
  total_weeks     INT         NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  price_cents     INT,                           -- null = free
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Course enrollments
CREATE TABLE IF NOT EXISTS public.enrollments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id       UUID        NOT NULL REFERENCES public.courses(id),
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'withdrawn')),
  current_week    INT         NOT NULL DEFAULT 1,
  completed_at    TIMESTAMPTZ,
  UNIQUE (user_id, course_id)
);

-- Lessons (individual content units within a week)
CREATE TABLE IF NOT EXISTS public.lessons (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  week_number     INT         NOT NULL,
  sort_order      INT         NOT NULL,
  title           TEXT        NOT NULL,
  lesson_type     TEXT        NOT NULL CHECK (lesson_type IN ('video', 'text', 'quiz', 'assignment')),
  content         JSONB,          -- video: { url, duration }, text: { markdown }, quiz: { questions[] }
  requires_metrics JSONB,         -- from CentOS plan: { "metrics": [...], "days": 7 }
  is_required     BOOLEAN     NOT NULL DEFAULT true,
  estimated_minutes INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lesson completion tracking
CREATE TABLE IF NOT EXISTS public.lesson_completions (
  user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id       UUID    NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score           NUMERIC(5,2),   -- quiz/assignment score (0-100)
  submission_data JSONB,          -- quiz answers, assignment text, metric snapshots
  PRIMARY KEY (user_id, lesson_id)
);

-- RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published courses readable by all"
  ON public.courses FOR SELECT TO authenticated
  USING (status = 'published');

CREATE POLICY "Users manage own enrollments"
  ON public.enrollments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enrolled users read lessons"
  ON public.lessons FOR SELECT TO authenticated
  USING (course_id IN (SELECT course_id FROM public.enrollments WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own completions"
  ON public.lesson_completions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
```

### API Routes

```
app/api/academy/
  courses/route.ts                    — GET (list available courses)
  courses/[slug]/route.ts             — GET (course detail + week structure)
  courses/[slug]/enroll/route.ts      — POST (enroll)
  courses/[slug]/progress/route.ts    — GET (user's progress: completed lessons, current week)
  lessons/[id]/route.ts               — GET (lesson content)
  lessons/[id]/complete/route.ts      — POST (mark complete, submit quiz/assignment)
  instructor/
    courses/[id]/students/route.ts    — GET (enrolled students + progress)
    courses/[id]/grades/route.ts      — GET (gradebook view)
    submissions/[id]/route.ts         — GET (single submission), PATCH (grade/feedback)
```

### UI Pages

**`/academy`** — Course catalog. Shows available courses with enrollment status.

**`/academy/[slug]`** — Course home page. Shows:
- Week-by-week outline with progress indicators (locked/available/complete)
- Current week highlighted
- Overall progress bar (X of Y lessons complete)
- "Continue where I left off" button

**`/academy/[slug]/week/[number]`** — Week content page. Linear list of lessons for that week:
- Video lessons: embedded player with transcript toggle
- Text lessons: rendered markdown with inline images
- Quiz lessons: interactive quiz component (see below)
- Assignment lessons: interactive assignment form with metric pre-fill (see below)

---

## Feature: Interactive Quiz Component

Each week's knowledge checks (currently written in lecture scripts) become interactive quizzes.

### Quiz Content Schema (stored in `lessons.content` JSONB)

```typescript
interface QuizContent {
  questions: Array<{
    id: string;
    questionText: string;
    questionType: 'multiple_choice' | 'true_false';
    options: Array<{ id: string; text: string }>;
    correctOptionId: string;
    explanation: string;  // shown after answering
    citation?: string;    // APA citation supporting the answer
  }>;
  passingScore: number;  // percentage (e.g., 80)
  attemptsAllowed: number;  // -1 for unlimited
}
```

### UI Component: `components/academy/QuizPlayer.tsx`

- One question at a time, sequential navigation
- Immediate feedback after each answer (correct/incorrect + explanation + citation)
- Score summary at end
- If below passing score, option to retry (if attempts remain)
- Score saved to `lesson_completions.score`

### Foundations Course Quiz Content

Quiz questions are already defined in the lecture scripts. They need to be extracted and entered into the `lessons` table:

| Week | Quiz | Questions | Source Document |
|---|---|---|---|
| 1 | Foundations Knowledge Check | 5 questions | Week 1 Complete Lecture Script |
| 2 | Wearable Tech Knowledge Check | 5 questions | Week 2 Complete Lecture Script |
| 3 | Data Analytics Knowledge Check | 5 questions | Week 3 Complete Lecture Script |
| 4 | N-of-1 Experiments Quiz (REVISED) | 5 questions | Week 4 Revised Script (corrected Shcherbina/PURE) |
| 5A | Data Review Quiz | 3 questions | Week 5 Revised Script Session A |
| 5B | Blueprint Readiness Check | 3 questions | Week 5 Revised Script Session B |

---

## Feature: Interactive Assignment Forms

Assignments auto-populate from the student's CentenarianOS health metric data. This is the core integration described in the CentOS Integration Plan.

### Assignment Content Schema (stored in `lessons.content` JSONB)

```typescript
interface AssignmentContent {
  instructions: string;      // markdown
  requiresMetrics: {
    metrics: string[];       // column names from user_health_metrics
    days: number;            // minimum days of data required
    dateRange?: 'last_7' | 'last_14' | 'last_30' | 'course_start_to_now' | 'custom';
  };
  sections: Array<{
    id: string;
    label: string;
    type: 'auto_populated' | 'text_input' | 'number_input' | 'select';
    autoPopulateField?: string;   // e.g. 'avg_resting_hr_7day'
    placeholder?: string;
    minWords?: number;
    maxWords?: number;
  }>;
  rubric: Array<{
    criteria: string;
    maxPoints: number;
    description: string;
  }>;
  totalPoints: number;
  dueOffset?: string;  // e.g., 'week_end' or 'session_b_minus_48h'
}
```

### Week-by-Week Assignment Specifications

**Week 1: "My Starting Dashboard" (Baseline Assessment)**
- Auto-populates: 7-day averages for RHR, steps, sleep, activity minutes
- Student writes: "Which metric surprised you?" + initial goals
- Points: 20
- Minimum data: 5 of 7 days logged

**Week 2: "How Accurate Is My Device?"**
- Auto-populates: last 7 days of selected metric
- Student writes: comparison observations, preferred source, precision discussion
- Points: 25
- Minimum data: 7 days with notes field containing comparison data

**Week 3: "My Sleep Variable Test"**
- Auto-populates: 7-day baseline averages → 7-day intervention averages (sleep_hours, sleep_score)
- Student writes: variable changed, hypothesis, results vs. hypothesis, keep/discard decision
- Points: 25
- Minimum data: 10 days (5 baseline + 5 intervention minimum)

**Week 4: "My Personal Activity Experiment"**
- Auto-populates: experiment date range from Experiment Builder (Feature 1), activity_min averages, RHR correlation
- Student writes: experiment design, adherence, outcome analysis
- Points: 30
- Minimum data: 10 days logged during experiment period
- Gemini AI generates correlation insight (automatically appended to submission)

**Week 5: Data Story (Session A)**
- No auto-populate — student writes from memory + dashboard reference
- 200–300 words, three-paragraph structure
- Points: 30
- Due: 48 hours before Session B

**Week 5: My Health Blueprint (Capstone)**
- Auto-populates: full 5-week history (Week 1 avg vs. Week 5 avg, all 4 core metrics)
- Gemini AI generates 5-week journey summary
- Student fills in: goals, 90-day plan, N-of-1 experiment plan, support system
- Points: 70
- Generates downloadable PDF "My Health Blueprint"

---

## Feature: Course Progress Tracking

### Progress Logic

Week content unlocks sequentially: Week N+1 becomes available when all required lessons in Week N are complete. Non-required lessons (supplementary content, CYOA paths) don't block progression.

```typescript
// lib/academy/progress.ts
export async function getNextAvailableWeek(
  userId: string,
  courseId: string
): Promise<number> {
  const requiredLessons = await getRequiredLessons(courseId);
  const completions = await getUserCompletions(userId, courseId);

  for (let week = 1; week <= course.totalWeeks; week++) {
    const weekRequired = requiredLessons.filter(l => l.weekNumber === week);
    const weekCompleted = weekRequired.filter(l =>
      completions.some(c => c.lessonId === l.id)
    );
    if (weekCompleted.length < weekRequired.length) return week;
  }
  return course.totalWeeks; // all complete
}
```

### UI: Progress Dashboard Widget

On `/academy/[slug]`:
- Circular progress indicator: "Week 3 of 5"
- Linear progress bar: "12 of 18 lessons complete (67%)"
- Week cards: ✅ Week 1, ✅ Week 2, 🔓 Week 3 (current), 🔒 Week 4, 🔒 Week 5
- "Continue" button links to first incomplete lesson in current week

---

## Feature: Student Onboarding Wizard

First-time experience after enrollment, before Week 1 content unlocks.

### Steps

**Step 1: Welcome** — Brief video or text from BAM explaining what to expect, how the course works, what tools they need.

**Step 2: Device Check** — "What device do you use to track health metrics?"
- Options: Apple Watch, Fitbit, Garmin, Oura Ring, phone only, no device
- Based on selection, shows device-specific instructions for finding RHR, steps, sleep, and activity minutes
- "I don't have a device" path: recommendations for free phone-based tracking apps

**Step 3: First Metric Log** — Interactive walk-through of the daily log form:
- Student enters today's metrics with guided tooltips
- "Where do I find my resting heart rate?" help links per device
- Validates entry, shows confirmation: "You just logged your first day!"

**Step 4: Goal Preview** — "By the end of this course, you'll be able to look at numbers like these and know exactly what they mean — and what to do about them." Shows a sample dashboard with mock data to preview what their data will look like after 5 weeks.

**Step 5: Community Opt-In** — "Would you like to join the community feed?"
- Toggle: community participation (can change later)
- Toggle: Health Buddy matching interest (can change later)
- These are non-blocking — student proceeds to Week 1 either way

### Database

```sql
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS
  onboarding_completed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS
  device_type TEXT;  -- 'apple_watch', 'fitbit', 'garmin', 'oura', 'phone', 'none'
```

---

## Feature: Instructor Dashboard

### Pages

**`/instructor/courses/[id]`** — Course overview:
- Enrollment count and active vs. completed students
- Average progress (which week most students are on)
- Average quiz scores per week
- Assignment submission rate per week

**`/instructor/courses/[id]/students`** — Student list:
- Table: name, enrollment date, current week, quiz avg, assignments submitted, last active
- Sortable and filterable
- Click student → individual detail view

**`/instructor/courses/[id]/gradebook`** — Grade book:
- Matrix: students × assignments
- Color-coded cells: green (submitted + graded), yellow (submitted, needs grading), gray (not submitted)
- Click cell → view submission + add grade/feedback

**`/instructor/submissions/[id]`** — Submission detail:
- Student's submitted content (text + auto-populated metrics)
- Metric snapshot (frozen at submission time)
- Rubric with point allocation fields
- Feedback text area
- "Approve" / "Request Revision" buttons

### Instructor RLS Policy

```sql
-- Instructors read enrollments and submissions for their courses
CREATE POLICY "Instructor reads course enrollments"
  ON public.enrollments FOR SELECT TO authenticated
  USING (course_id IN (SELECT id FROM public.courses WHERE instructor_id = auth.uid()));

CREATE POLICY "Instructor reads submissions"
  ON public.lesson_completions FOR SELECT TO authenticated
  USING (lesson_id IN (
    SELECT id FROM public.lessons WHERE course_id IN (
      SELECT id FROM public.courses WHERE instructor_id = auth.uid()
    )
  ));
```

---

## Feature: CYOA Navigation (Supplementary Content Paths)

Week 5 revised script introduced the concept of Choose-Your-Own-Adventure supplementary paths — optional content students can explore based on their interests. This is implemented through the existing `lessons` table using `is_required = false`.

### Structure

Each week can have optional "deep dive" lessons tagged with a topic:

```sql
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS
  cyoa_tag TEXT;  -- e.g. 'sleep_deep_dive', 'heart_rate_advanced', 'experiment_design_extra'
```

### Foundations Course CYOA Content

| Week | Required Lessons | Optional CYOA Paths |
|---|---|---|
| 1 | Lecture + Baseline Assignment + Quiz | "What Is a Normal Resting Heart Rate?" deep dive |
| 2 | Lecture + Device Accuracy Assignment + Quiz | "How Wearable Sensors Actually Work" deep dive |
| 3 | Lecture + Sleep Experiment Assignment + Quiz | "Sleep Stages Explained" deep dive, "HRV for Beginners" |
| 4 | Lecture + N-of-1 Assignment + Quiz | "Effect Size: When Is a Change Meaningful?" deep dive |
| 5 | Data Story + Blueprint + Graduation | "Further Reading: Longevity Research" resource list |

### UI

On the week content page, optional lessons appear below the required path in a collapsible "Explore More" section. Completing optional lessons earns badge progress but doesn't affect course completion.

---

## Feature: Automated Metric Logging Reminders

Students who haven't logged metrics for 2+ days receive a gentle push notification or email.

### Logic

Vercel Cron Job runs daily at 6 PM user's local time (approximated by timezone from account settings):

```typescript
// app/api/cron/metric-reminders/route.ts
// Runs daily at 6 PM UTC (adjustable per timezone)
export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const twoDaysAgo = subtractDays(today, 2);

  // Find enrolled students who haven't logged in 2+ days
  const staleStudents = await supabase
    .from('enrollments')
    .select('user_id, courses(title)')
    .eq('status', 'active')
    .not('user_id', 'in',
      supabase.from('user_health_metrics')
        .select('user_id')
        .gte('logged_date', twoDaysAgo)
    );

  for (const student of staleStudents) {
    await sendReminderEmail(student.userId, student.courses.title);
  }
}
```

**Email content:** Friendly, non-judgmental. "Quick reminder: You haven't logged your metrics in a couple of days. Remember, consistency matters more than perfection — even logging partial data helps you spot patterns. [Log Today's Metrics →]"

**Frequency cap:** Maximum one reminder email per 3 days. Students can opt out in notification settings.

---

## Implementation Priority Order

| Priority | Feature | Effort | Unlocks |
|---|---|---|---|
| 1 | Academy LMS schema + API (Migration 051) | 2 weeks | Everything below |
| 2 | Course content loading (enter Foundations lessons into DB) | 1 week | Students can access content |
| 3 | Interactive quiz component | 1 week | Knowledge checks work |
| 4 | Interactive assignment forms with metric pre-fill | 2 weeks | Assignments pull from dashboard |
| 5 | Course progress tracking + week locking | 3 days | Sequential progression works |
| 6 | Student onboarding wizard | 3 days | Better first-time experience |
| 7 | Instructor dashboard + gradebook | 1.5 weeks | BAM can grade and monitor |
| 8 | CYOA navigation | 2 days | Supplementary content accessible |
| 9 | Automated metric logging reminders | 1 day | Engagement retention |
| 10 | Capstone PDF generation | 2 days | Blueprint downloadable |

**Total estimated effort: ~8 weeks**

This work runs in parallel with the Platform Improvements PRD (Features 1–11). The Academy LMS (Migration 051) is independent of the experiment features (Migration 044–050), so both tracks can proceed simultaneously.

---

## Relationship to Platform Improvements PRD

| Platform Feature | Academy Integration Point |
|---|---|
| Feature 1: Experiment Builder | Week 4 assignment links directly to student's experiment |
| Feature 2: Experiment Results Dashboard | Week 4 assignment auto-appends experiment results |
| Feature 3: Achievement Badges | Course completion awards "Foundations Graduate" badge |
| Feature 5: Experiment Templates | Week 4 offers official templates as starting points |
| Feature 6: Coaching View | Health Buddy feature accessible from Academy community |

The Academy LMS should be built first (it's needed for the current Foundations course), and the Platform Improvements should be built in parallel starting with Feature 1 (Experiment Builder), which enhances the Week 4 assignment experience.
