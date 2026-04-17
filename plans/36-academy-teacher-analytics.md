# Plan 36 — Academy Teacher Analytics Dashboard

> **Status:** Backlog. Not blocking BVC Episode 1 launch; becomes valuable once there are ≥5 real students per course.
> **Source:** owner request 2026-04-16 — close "final 10%" of Academy polish. Listed in [`ecosystem/centenarianos-direction.md §3.2`](ecosystem/centenarianos-direction.md) as a minor gap.
> **Effort:** Small-medium — 1–2 days. Mostly UI + one aggregate query.

---

## 1. Context

Today's teacher dashboard has a per-student detail view: which lessons are completed, which are in progress, assignment submissions. What's missing is a **cohort view** — one screen that shows a teacher how the whole class is distributed across the course at a glance.

For a 20-student classroom on a 6-lesson BVC episode, a heatmap surfaces patterns instantly: lesson 3 is a logjam, or students are skipping the quiz, or two students are ahead of everyone else.

---

## 2. Scope

**In scope:**
- New tab or page on teacher's course detail: "Cohort" or "Students × Lessons".
- Grid/heatmap: rows = enrolled students, columns = lessons in order, cell color by completion state (not started / in progress / completed / quiz-passed).
- Per-cell hover: timestamp of last activity, quiz score if applicable.
- Filters: enrollment status (active / cancelled / all), attempt number (for re-enrollments).
- Export button: CSV of the heatmap data for offline analysis.
- Summary stats above the grid: avg completion %, median time-to-complete, most-stuck lesson.

**Out of scope:**
- Per-question quiz analytics (which questions most-missed). Separate plan if teachers ask.
- Engagement predictions / ML. Premature optimization.
- Email automation (nudge students stuck on a lesson). Separate plan — would need opt-in.
- Per-assignment grading UI improvements beyond what exists today.

---

## 3. Data shape

Single aggregate endpoint: `GET /api/academy/courses/[id]/cohort`

Returns:

```ts
{
  students: Array<{ user_id, display_name, enrolled_at, status }>,
  lessons: Array<{ id, title, order, lesson_type }>,
  progress: Array<{
    user_id, lesson_id,
    state: 'not_started' | 'in_progress' | 'completed',
    completed_at: string | null,
    quiz_score: number | null,
  }>,
  summary: {
    enrolled_count, active_count,
    avg_completion_pct,
    median_time_to_complete_days,
    most_stuck_lesson_id,
  },
}
```

Query joins `enrollments` + `lessons` + `lesson_progress` scoped to `course_id`. RLS already restricts to teacher's courses.

## 4. UI component

`components/academy/teacher/CohortHeatmap.tsx`:

- Sticky-left column of student names + cohort order (by enrolled_at).
- Scrolling body of cells. Color scale: gray (not started) → amber (in progress) → green (completed). Quiz cells: green with a small score overlay.
- Mobile: horizontal-scroll with sticky student-name column. Desktop: all fit.
- `aria-label` per cell conveying state + student + lesson so screen readers work.

## 5. Files to add

- `app/api/academy/courses/[id]/cohort/route.ts`
- `app/dashboard/teaching/[username]/courses/[id]/cohort/page.tsx`
- `components/academy/teacher/CohortHeatmap.tsx`

## 6. Files to modify

- Course-detail teacher dashboard sidebar/tab list — add "Cohort" link.

## 7. Verification

1. As teacher with a course that has ≥3 enrolled students → visit Cohort tab.
2. Grid renders with one row per student, one column per lesson.
3. Hover a cell → tooltip shows completion timestamp.
4. Summary stats at top match the data in the grid.
5. Export CSV → opens in Excel/Sheets with correct rows + columns.
6. Mobile viewport: grid scrolls horizontally, student-name column stays pinned.

## 8. Risks

- **Performance with many students:** cap initial query at 200 students; paginate or lazy-load beyond that.
- **Data accuracy with re-enrollments:** when a student re-enrolls (`attempt_number > 1`), default to showing their latest attempt with a filter to see history.

## 9. Not a rewrite

This plan does not replace the existing per-student detail view. It adds a complementary cohort view. Both are linked from the course-detail teacher page.
