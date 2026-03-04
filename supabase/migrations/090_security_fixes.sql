-- migration: 090_security_fixes.sql
-- Fix SECURITY DEFINER warnings on views and enable RLS on 3 tables.
--
-- Background:
--   Supabase's security advisor flags views owned by the `postgres` role because
--   PostgREST queries them AS postgres, bypassing RLS on underlying tables.
--   The fix is `WITH (security_invoker = true)` (PostgreSQL 15+), which makes the
--   view execute with the querying user's permissions so RLS is enforced.
--
--   The two reminder views (payment_reminders, account_due_reminders) are dropped —
--   they are dead code; the API routes duplicate the logic directly.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Drop dead-code reminder views
-- ────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.payment_reminders;
DROP VIEW IF EXISTS public.account_due_reminders;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Recreate analytics views with security_invoker = true
--    All three already filter by auth.uid() in their subqueries; this change
--    additionally enforces RLS policies on the underlying tables.
--    Drop in dependency order (dependents first) then recreate.
-- ────────────────────────────────────────────────────────────────────────────

-- 2a. daily_aggregates (drop dependents first)
DROP VIEW IF EXISTS public.correlation_candidates;
DROP VIEW IF EXISTS public.weekly_aggregates;
DROP VIEW IF EXISTS public.daily_aggregates;
CREATE VIEW public.daily_aggregates
  WITH (security_invoker = true)
AS
 WITH date_series AS (
   SELECT (generate_series(
     (CURRENT_DATE - '90 days'::interval),
     CURRENT_DATE::timestamp without time zone,
     '1 day'::interval
   ))::date AS date
 )
 SELECT
   date,
   auth.uid() AS user_id,
   COALESCE((
     SELECT count(*) FROM public.tasks t
     JOIN public.milestones m ON m.id = t.milestone_id
     JOIN public.goals g ON g.id = m.goal_id
     JOIN public.roadmaps r ON r.id = g.roadmap_id
     WHERE t.date = ds.date AND r.user_id = auth.uid() AND t.completed = true
   ), 0::bigint) AS tasks_completed,
   COALESCE((
     SELECT count(*) FROM public.tasks t
     JOIN public.milestones m ON m.id = t.milestone_id
     JOIN public.goals g ON g.id = m.goal_id
     JOIN public.roadmaps r ON r.id = g.roadmap_id
     WHERE t.date = ds.date AND r.user_id = auth.uid()
   ), 0::bigint) AS tasks_total,
   CASE
     WHEN COALESCE((
       SELECT count(*) FROM public.tasks t
       JOIN public.milestones m ON m.id = t.milestone_id
       JOIN public.goals g ON g.id = m.goal_id
       JOIN public.roadmaps r ON r.id = g.roadmap_id
       WHERE t.date = ds.date AND r.user_id = auth.uid()
     ), 0::bigint) = 0 THEN 0::double precision
     ELSE (
       COALESCE((
         SELECT count(*) FROM public.tasks t
         JOIN public.milestones m ON m.id = t.milestone_id
         JOIN public.goals g ON g.id = m.goal_id
         JOIN public.roadmaps r ON r.id = g.roadmap_id
         WHERE t.date = ds.date AND r.user_id = auth.uid() AND t.completed = true
       ), 0::bigint)::double precision
       / COALESCE((
         SELECT count(*) FROM public.tasks t
         JOIN public.milestones m ON m.id = t.milestone_id
         JOIN public.goals g ON g.id = m.goal_id
         JOIN public.roadmaps r ON r.id = g.roadmap_id
         WHERE t.date = ds.date AND r.user_id = auth.uid()
       ), 1::bigint)::double precision * 100.0
     )
   END AS completion_rate,
   COALESCE((
     SELECT avg(
       CASE
         WHEN p.ncv_score = 'Green' THEN 3
         WHEN p.ncv_score = 'Yellow' THEN 2
         WHEN p.ncv_score = 'Red' THEN 1
         ELSE 0
       END
     ) FROM public.meal_logs ml
     JOIN public.protocols p ON p.id = ml.protocol_id
     WHERE ml.date = ds.date AND ml.user_id = auth.uid() AND ml.is_restaurant_meal = false
   ), 0::numeric) AS avg_ncv_numeric,
   COALESCE((
     SELECT p.ncv_score FROM public.meal_logs ml
     JOIN public.protocols p ON p.id = ml.protocol_id
     WHERE ml.date = ds.date AND ml.user_id = auth.uid() AND ml.is_restaurant_meal = false
     GROUP BY p.ncv_score ORDER BY count(*) DESC LIMIT 1
   ), 'Unknown') AS ncv_score_mode,
   COALESCE((
     SELECT count(*) FROM public.meal_logs ml
     WHERE ml.date = ds.date AND ml.user_id = auth.uid()
   ), 0::bigint) AS meal_count,
   COALESCE((
     SELECT count(*) FROM public.meal_logs ml
     WHERE ml.date = ds.date AND ml.user_id = auth.uid() AND ml.is_restaurant_meal = true
   ), 0::bigint) AS restaurant_meal_count,
   COALESCE((
     SELECT sum(p.total_cost) FROM public.meal_logs ml
     JOIN public.protocols p ON p.id = ml.protocol_id
     WHERE ml.date = ds.date AND ml.user_id = auth.uid() AND ml.is_restaurant_meal = false
   ), 0::numeric) AS daily_food_cost,
   COALESCE((
     SELECT (sum(fs.duration)::numeric / 60.0) FROM public.focus_sessions fs
     WHERE fs.start_time::date = ds.date AND fs.user_id = auth.uid()
   ), 0::numeric) AS focus_minutes,
   COALESCE((
     SELECT count(*) FROM public.focus_sessions fs
     WHERE fs.start_time::date = ds.date AND fs.user_id = auth.uid()
   ), 0::bigint) AS focus_session_count,
   COALESCE((
     SELECT dl.pain_intensity FROM public.daily_logs dl
     WHERE dl.date = ds.date AND dl.user_id = auth.uid() LIMIT 1
   ), 0) AS pain_score,
   COALESCE((
     SELECT dl.energy_rating FROM public.daily_logs dl
     WHERE dl.date = ds.date AND dl.user_id = auth.uid() LIMIT 1
   ), 0) AS energy_rating,
   EXTRACT(dow FROM date) AS day_of_week,
   EXTRACT(week FROM date) AS week_number
 FROM date_series ds
 ORDER BY date DESC;

GRANT SELECT ON public.daily_aggregates TO authenticated;

-- 2b. weekly_aggregates (chains from daily_aggregates — inherits security_invoker)
CREATE VIEW public.weekly_aggregates
  WITH (security_invoker = true)
AS
 SELECT
   week_number,
   min(date) AS week_start,
   max(date) AS week_end,
   sum(tasks_completed) AS tasks_completed,
   sum(tasks_total) AS tasks_total,
   avg(completion_rate) AS avg_completion_rate,
   avg(avg_ncv_numeric) AS avg_ncv_score,
   sum(meal_count) AS total_meals,
   sum(restaurant_meal_count) AS total_restaurant_meals,
   sum(daily_food_cost) AS total_food_cost,
   sum(focus_minutes) AS total_focus_minutes,
   avg(focus_session_count) AS avg_sessions_per_day,
   avg(pain_score) AS avg_pain_score,
   avg(energy_rating) AS avg_energy_rating,
   count(*) AS days_in_week,
   count(CASE WHEN completion_rate >= 90 THEN 1 ELSE NULL END) AS high_completion_days
 FROM public.daily_aggregates
 GROUP BY week_number
 ORDER BY week_number DESC;

GRANT SELECT ON public.weekly_aggregates TO authenticated;

-- 2c. correlation_candidates (chains from daily_aggregates)
CREATE VIEW public.correlation_candidates
  WITH (security_invoker = true)
AS
 SELECT
   (SELECT avg(energy_rating) FROM public.daily_aggregates WHERE ncv_score_mode = 'Green' AND energy_rating > 0) AS green_day_avg_energy,
   (SELECT avg(energy_rating) FROM public.daily_aggregates WHERE ncv_score_mode <> 'Green' AND energy_rating > 0) AS non_green_day_avg_energy,
   (SELECT avg(completion_rate) FROM public.daily_aggregates WHERE focus_minutes >= 180 AND tasks_total > 0) AS high_focus_completion_rate,
   (SELECT avg(completion_rate) FROM public.daily_aggregates WHERE focus_minutes < 180 AND tasks_total > 0) AS low_focus_completion_rate,
   (SELECT avg(focus_minutes) FROM public.daily_aggregates WHERE pain_score >= 4) AS high_pain_avg_focus,
   (SELECT avg(focus_minutes) FROM public.daily_aggregates WHERE pain_score < 4) AS low_pain_avg_focus,
   (SELECT avg(completion_rate) FROM public.daily_aggregates WHERE restaurant_meal_count = 0 AND tasks_total > 0) AS no_restaurant_completion_rate,
   (SELECT avg(completion_rate) FROM public.daily_aggregates WHERE restaurant_meal_count > 0 AND tasks_total > 0) AS restaurant_day_completion_rate,
   (SELECT count(*) FROM public.daily_aggregates WHERE ncv_score_mode = 'Green') AS green_day_count,
   (SELECT count(*) FROM public.daily_aggregates WHERE focus_minutes >= 180) AS high_focus_day_count,
   (SELECT count(*) FROM public.daily_aggregates WHERE pain_score >= 4) AS high_pain_day_count,
   (SELECT count(*) FROM public.daily_aggregates WHERE restaurant_meal_count > 0) AS restaurant_day_count;

GRANT SELECT ON public.correlation_candidates TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Enable RLS on tables that were missing it
-- ────────────────────────────────────────────────────────────────────────────

-- 3a. academy_course_categories — admin-managed shared reference data.
--     All authenticated users may read; writes are service-role-only (admin API).
ALTER TABLE public.academy_course_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_course_categories_read" ON public.academy_course_categories
  FOR SELECT TO authenticated USING (true);

-- 3b. exercise_equipment — junction table between exercises and equipment.
--     Users may only see/modify links belonging to their own exercises.
ALTER TABLE public.exercise_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercise_equipment_select" ON public.exercise_equipment
  FOR SELECT USING (
    exercise_id IN (SELECT id FROM public.exercises WHERE user_id = auth.uid())
  );

CREATE POLICY "exercise_equipment_insert" ON public.exercise_equipment
  FOR INSERT WITH CHECK (
    exercise_id IN (SELECT id FROM public.exercises WHERE user_id = auth.uid())
  );

CREATE POLICY "exercise_equipment_delete" ON public.exercise_equipment
  FOR DELETE USING (
    exercise_id IN (SELECT id FROM public.exercises WHERE user_id = auth.uid())
  );

-- 3c. admin_notifications — service-role-only table.
--     Enabling RLS with no user-facing policies means direct PostgREST access is
--     blocked for all roles; the admin API routes use the service role which bypasses RLS.
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
-- (intentionally no policies — service role bypasses RLS entirely)
