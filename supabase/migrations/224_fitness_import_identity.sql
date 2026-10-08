-- 224_fitness_import_identity.sql
-- A stable identity for trips and workout logs that come from a device, so a re-import can never
-- add the same activity twice (the Garmin dedupe, plans/app-improvements/2026-10-08-bugs.md).
--
-- PURPOSE
--   trips.external_id, workout_logs.external_id
--       The identity of the device record a row came from. CentenarianOS writes
--       'garmin:start:<local start YYYY-MM-DD HH:MM:SS>' for Garmin activities: the same key from
--       the Activities CSV (the Date column), the account-export JSON (startTimeLocal) and,
--       later, the Health API (startTimeInSeconds + startTimeOffsetInSeconds). The title is left
--       out on purpose, because it can be edited in Garmin Connect. NULL = not from a device
--       (a hand-logged, template or CSV row).
--
--   ux_trips_user_external_id, ux_workout_logs_user_external_id
--       Unique on (user_id, external_id). The imports insert with
--       ON CONFLICT (user_id, external_id) DO NOTHING, so two imports racing still add a record
--       once.
--
-- SHARED DATABASE (Work.WitUS / contractor-os)
--   - Additive only: two nullable columns and two indexes. Nothing is dropped, renamed or
--     backfilled, no CHECK is added and no RLS policy changes.
--   - The indexes are deliberately NOT partial. Postgres treats NULLs as distinct, so every
--     existing row (all NULL) and every insert that leaves the column out (Work.WitUS's copy of
--     the Garmin import, the duplicate-trip button, manual logging) never collides. A
--     non-partial index is also one PostgREST's on_conflict can target; it cannot target a
--     partial one (see lib/finance/csv-import/commit.ts).
--   - Rows imported before this migration keep external_id NULL. The app matches them by the
--     start time at the front of trips.garmin_activity_id ('<Date>|<Title>') instead, so
--     building the indexes can never fail on duplicates already in the table.
--
-- The app works before this is applied: the Garmin trips import detects the missing column,
-- leaves external_id out and relies on its paged duplicate check. The workout-log script
-- (scripts/import-garmin-workouts.mjs) needs it and says so.
--
-- Safe to run more than once. After applying, reload PostgREST's schema cache:
--   NOTIFY pgrst, 'reload schema';
--
-- To list duplicates that already exist (read-only, deletes nothing):
--   supabase/reports/fitness-duplicates.sql, or scripts/report-fitness-duplicates.mjs

BEGIN;

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.workout_logs ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_trips_user_external_id
  ON public.trips (user_id, external_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_workout_logs_user_external_id
  ON public.workout_logs (user_id, external_id);

COMMENT ON COLUMN public.trips.external_id IS
  'Device identity of an imported trip, e.g. garmin:start:2025-06-08 17:20:53 (local start). NULL = not from a device. Unique per user (CentenarianOS, migration 224).';
COMMENT ON COLUMN public.workout_logs.external_id IS
  'Device identity of an imported workout, e.g. garmin:start:2025-06-08 17:20:53 (local start). NULL = logged by hand or from a CSV. Unique per user (CentenarianOS, migration 224).';

COMMIT;

NOTIFY pgrst, 'reload schema';
