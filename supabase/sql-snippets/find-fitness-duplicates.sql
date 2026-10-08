-- supabase/sql-snippets/find-fitness-duplicates.sql
-- READ-ONLY audit: fitness and wearable records that were brought in more than once.
-- Every statement is a SELECT. Nothing is changed or deleted.
--
-- Background: the Garmin Activities CSV import keyed trips on "<Date>|<Title>" and checked
-- for existing keys with one unpaged read (it saw at most PostgREST's row cap), the workouts
-- CSV import never checked at all, and the workout script compared name + UTC date with an
-- unpaged read. The fixes (migration 224 and lib/fitness-import/) stop new duplicates; this
-- lists the ones already stored so they can be reviewed. Any clean-up goes through a screen
-- where each merge or delete is confirmed; never delete from here.
--
-- Run each query on its own in the Supabase SQL editor. To look at one person only, add
-- `AND user_id = '<uuid>'` (or `t.user_id`, `w.user_id`, ...) to its WHERE clause.
-- The same checks, with counts and ids, run from: scripts/report-fitness-duplicates.mjs
--
-- Note: the trips table is shared with Work.WitUS, whose own Garmin import writes the same
-- source 'garmin_import' rows.

-- ─── 1. Is migration 080's unique key on user_health_metrics in place? ────────────────
-- Expect user_health_metrics_user_id_date_source_key UNIQUE (user_id, logged_date, source)
-- and no constraint on (user_id, logged_date) alone.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.user_health_metrics'::regclass
  AND contype = 'u';

-- ─── 2. Garmin trips stored more than once under the same key ─────────────────────────
SELECT user_id,
       garmin_activity_id,
       count(*)                                   AS copies,
       array_agg(id ORDER BY created_at)          AS trip_ids,
       array_agg(created_at ORDER BY created_at)  AS imported_at
FROM public.trips
WHERE garmin_activity_id IS NOT NULL
GROUP BY user_id, garmin_activity_id
HAVING count(*) > 1
ORDER BY copies DESC, garmin_activity_id;

-- ─── 3. Garmin trips with the same start time (renamed in Garmin Connect, or uploaded twice) ─
-- garmin_activity_id is "<local start>|<title>"; the part before '|' is the activity's start.
SELECT user_id,
       split_part(garmin_activity_id, '|', 1)               AS local_start,
       count(*)                                             AS copies,
       count(DISTINCT garmin_activity_id)                   AS different_titles,
       array_agg(id ORDER BY created_at)                    AS trip_ids,
       array_agg(split_part(garmin_activity_id, '|', 2) ORDER BY created_at) AS titles,
       array_agg(created_at ORDER BY created_at)            AS imported_at
FROM public.trips
WHERE garmin_activity_id IS NOT NULL
  AND split_part(garmin_activity_id, '|', 1) ~ '^\d{4}-\d{2}-\d{2} '
GROUP BY user_id, split_part(garmin_activity_id, '|', 1)
HAVING count(*) > 1
ORDER BY local_start;

-- ─── 4. Garmin trips that look like a trip logged another way ─────────────────────────
-- Same person, date and mode, and distance within max(0.1 mi, 5%) or duration within 5 min.
-- Both may be right (two outings); review each pair.
SELECT g.user_id,
       g.date,
       g.mode,
       g.id              AS garmin_trip_id,
       o.id              AS other_trip_id,
       o.source          AS other_source,
       g.distance_miles  AS garmin_miles,
       o.distance_miles  AS other_miles,
       g.duration_min    AS garmin_min,
       o.duration_min    AS other_min
FROM public.trips g
JOIN public.trips o
  ON o.user_id = g.user_id
 AND o.date = g.date
 AND o.mode = g.mode
 AND o.id <> g.id
 AND o.source <> 'garmin_import'
 AND o.garmin_activity_id IS NULL
WHERE g.source = 'garmin_import'
  AND (
        (g.distance_miles IS NOT NULL AND o.distance_miles IS NOT NULL
         AND abs(g.distance_miles - o.distance_miles)
             <= greatest(0.1, 0.05 * greatest(abs(g.distance_miles), abs(o.distance_miles))))
     OR (g.duration_min IS NOT NULL AND o.duration_min IS NOT NULL
         AND abs(g.duration_min - o.duration_min) <= 5)
      )
ORDER BY g.date, g.mode;

-- ─── 5. Workout logs with the same name on the same day ───────────────────────────────
-- same_start = true: one recording imported twice (certain duplicate).
-- same_start = false: possibly two real sessions (a morning and an evening walk).
SELECT w.user_id,
       lower(w.name)                                  AS name,
       w.date,
       count(*)                                       AS copies,
       count(DISTINCT w.started_at) <= 1
         AND count(w.started_at) = count(*)           AS same_start,
       array_agg(w.id ORDER BY w.created_at)          AS log_ids,
       array_agg(w.started_at ORDER BY w.created_at)  AS started_at,
       array_agg(w.created_at ORDER BY w.created_at)  AS logged_at,
       array_agg((SELECT count(*) FROM public.workout_log_exercises e WHERE e.log_id = w.id)
                 ORDER BY w.created_at)               AS exercise_counts
FROM public.workout_logs w
GROUP BY w.user_id, lower(w.name), w.date
HAVING count(*) > 1
ORDER BY w.date, name;

-- ─── 6. Workout logs from the old Garmin workout script with impossible durations ─────
-- The old scripts/import-garmin-workouts.mjs read the export's duration (milliseconds) as
-- seconds, so duration_min came out 1000 times too large. Over a day is not a real session.
SELECT user_id,
       count(*)                           AS logs,
       array_agg(id ORDER BY date)        AS log_ids,
       min(date)                          AS first_date,
       max(date)                          AS last_date
FROM public.workout_logs
WHERE duration_min > 1440
GROUP BY user_id;

-- ─── 7. Informational: manual daily rows identical to a device row on the same day ────
-- Before migration 080 the wearable syncs wrote into the one row per day, so some manual rows
-- may be copies of device data. Same person and date, at least two metrics set, and every
-- metric the same.
SELECT m.user_id,
       m.logged_date,
       d.source        AS device_source,
       m.id            AS manual_row_id,
       d.id            AS device_row_id
FROM public.user_health_metrics m
JOIN public.user_health_metrics d
  ON d.user_id = m.user_id
 AND d.logged_date = m.logged_date
 AND d.source <> 'manual'
WHERE m.source = 'manual'
  AND num_nonnulls(m.resting_hr, m.steps, m.sleep_hours, m.activity_min, m.sleep_score, m.hrv_ms,
                   m.spo2_pct, m.active_calories, m.stress_score, m.recovery_score, m.weight_lbs) >= 2
  AND m.resting_hr      IS NOT DISTINCT FROM d.resting_hr
  AND m.steps           IS NOT DISTINCT FROM d.steps
  AND m.sleep_hours     IS NOT DISTINCT FROM d.sleep_hours
  AND m.activity_min    IS NOT DISTINCT FROM d.activity_min
  AND m.sleep_score     IS NOT DISTINCT FROM d.sleep_score
  AND m.hrv_ms          IS NOT DISTINCT FROM d.hrv_ms
  AND m.spo2_pct        IS NOT DISTINCT FROM d.spo2_pct
  AND m.active_calories IS NOT DISTINCT FROM d.active_calories
  AND m.stress_score    IS NOT DISTINCT FROM d.stress_score
  AND m.recovery_score  IS NOT DISTINCT FROM d.recovery_score
  AND m.weight_lbs      IS NOT DISTINCT FROM d.weight_lbs
ORDER BY m.logged_date;
