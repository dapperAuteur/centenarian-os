-- 222_pain_entries.sql
-- More than one pain entry per day (plans/63 section D).
--
-- PURPOSE
--   pain_entries   one row per pain or body-check entry. A day can have any number of them,
--                  each with its own time, intensity, locations, sensations, aggravating
--                  activities and notes.
--
--   Before this migration the pain form wrote straight onto daily_logs (one row per user and
--   day, UNIQUE (user_id, date)), so a second entry on the same day overwrote the first.
--
-- THE DAY SUMMARY STAYS ON daily_logs
--   daily_logs.pain_intensity / pain_locations / pain_sensations / pain_activities / pain_notes
--   are NOT dropped or changed. They become the day's summary, recomputed by the app
--   (lib/pain/server.ts recomputeDaySummary, called by every write in
--   app/api/engine/pain-entries/*) whenever an entry is added, edited or deleted:
--     pain_intensity   the day's highest entry (kept within daily_logs' own 1-10 check)
--     pain_locations   every location of the day, in the order first logged (jsonb array)
--     pain_sensations  every sensation of the day, same rule
--     pain_activities  every activity of the day, same rule
--     pain_notes       every entry's notes, oldest first, separated by a blank line
--   A day with no entries left keeps its daily_logs row (it can hold debrief data) with the
--   pain columns cleared. The correlation engine, the daily_aggregates view, AI reports,
--   Coaching Gems and charts keep reading daily_logs unchanged.
--
-- BACKFILL (runs once)
--   Every existing daily_logs row with pain data (pain_intensity set) is copied into
--   pain_entries as one entry for that day, marked source = 'daily_log'. Its time is
--   12:00 UTC on that date, because daily_logs never stored a time of day. The entry's
--   local_date is the daily_logs date, so it always groups under the right day.
--   A day is skipped when pain_entries already has ANY entry for that user and date, and the
--   partial unique index pain_entries_backfill_once (one source = 'daily_log' row per user
--   and day) backs that up with ON CONFLICT DO NOTHING. Re-running this file copies nothing
--   twice, and never copies a day the app has already been writing entries for.
--   The table, its policy and the backfill run in one transaction, so the app never sees the
--   table before the old days are in it.
--
-- WHO CAN READ WHAT
--   Row Level Security is on. Owners can read and write their own rows (auth.uid() = user_id).
--   The policy is app-agnostic: it does not assume which app wrote the row.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): this file
-- creates one new table with its indexes, trigger and policy, and inserts rows into it. It
-- reads daily_logs and changes nothing that exists.
--
-- SAFE TO RE-RUN: CREATE ... IF NOT EXISTS, the policy and trigger sit in DO blocks that check
-- first, the backfill skips days that already have entries, and ENABLE ROW LEVEL SECURITY /
-- COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied the
-- pain form keeps the old one-entry-per-day behavior and says "Run migration 222 first".

BEGIN;

CREATE TABLE IF NOT EXISTS public.pain_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- When the pain was felt. Defaults to now; the person can change it.
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- occurred_at as a calendar date in the person's own time zone (the app sends it).
  -- This is the day the entry belongs to, and the daily_logs.date it summarizes into.
  local_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 0-10. The app's scale is 1 (no discomfort) to 10 (acute, debilitating).
  intensity    INTEGER NOT NULL,
  locations    TEXT[] NOT NULL DEFAULT '{}',
  sensations   TEXT[] NOT NULL DEFAULT '{}',
  activities   TEXT[] NOT NULL DEFAULT '{}',
  notes        TEXT,
  -- 'app' = logged in the app. 'daily_log' = copied from daily_logs by this migration.
  source       TEXT NOT NULL DEFAULT 'app',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pain_entries_intensity_range CHECK (intensity BETWEEN 0 AND 10)
);

CREATE INDEX IF NOT EXISTS idx_pain_entries_user_occurred
  ON public.pain_entries (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pain_entries_user_day
  ON public.pain_entries (user_id, local_date);
CREATE INDEX IF NOT EXISTS idx_pain_entries_locations
  ON public.pain_entries USING GIN (locations);
-- At most one backfilled entry per user and day.
CREATE UNIQUE INDEX IF NOT EXISTS pain_entries_backfill_once
  ON public.pain_entries (user_id, local_date)
  WHERE source = 'daily_log';

ALTER TABLE public.pain_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pain_entries'
      AND policyname = 'Users manage their own pain entries'
  ) THEN
    CREATE POLICY "Users manage their own pain entries" ON public.pain_entries
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_pain_entries_updated_at'
      AND tgrelid = 'public.pain_entries'::regclass
  ) THEN
    CREATE TRIGGER update_pain_entries_updated_at
      BEFORE UPDATE ON public.pain_entries
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Backfill: one entry per existing daily_logs day with pain data.
-- daily_logs.pain_* arrays are jsonb; anything that is not an array (a lone string) becomes a
-- one-item list, and blank items are dropped.
INSERT INTO public.pain_entries
  (user_id, occurred_at, local_date, intensity, locations, sensations, activities, notes, source)
SELECT
  dl.user_id,
  (dl.date::timestamp + TIME '12:00') AT TIME ZONE 'UTC',
  dl.date,
  LEAST(GREATEST(dl.pain_intensity, 0), 10),
  CASE jsonb_typeof(dl.pain_locations)
    WHEN 'array' THEN ARRAY(
      SELECT btrim(v) FROM jsonb_array_elements_text(dl.pain_locations) AS e(v) WHERE btrim(v) <> '')
    WHEN 'string' THEN ARRAY(
      SELECT btrim(dl.pain_locations #>> '{}') WHERE btrim(dl.pain_locations #>> '{}') <> '')
    ELSE '{}'::TEXT[]
  END,
  CASE jsonb_typeof(dl.pain_sensations)
    WHEN 'array' THEN ARRAY(
      SELECT btrim(v) FROM jsonb_array_elements_text(dl.pain_sensations) AS e(v) WHERE btrim(v) <> '')
    WHEN 'string' THEN ARRAY(
      SELECT btrim(dl.pain_sensations #>> '{}') WHERE btrim(dl.pain_sensations #>> '{}') <> '')
    ELSE '{}'::TEXT[]
  END,
  CASE jsonb_typeof(dl.pain_activities)
    WHEN 'array' THEN ARRAY(
      SELECT btrim(v) FROM jsonb_array_elements_text(dl.pain_activities) AS e(v) WHERE btrim(v) <> '')
    WHEN 'string' THEN ARRAY(
      SELECT btrim(dl.pain_activities #>> '{}') WHERE btrim(dl.pain_activities #>> '{}') <> '')
    ELSE '{}'::TEXT[]
  END,
  NULLIF(btrim(dl.pain_notes), ''),
  'daily_log'
FROM public.daily_logs dl
WHERE dl.pain_intensity IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.pain_entries pe
    WHERE pe.user_id = dl.user_id AND pe.local_date = dl.date
  )
ON CONFLICT (user_id, local_date) WHERE source = 'daily_log' DO NOTHING;

COMMENT ON TABLE public.pain_entries IS
  'Pain and body-check entries, many per day. daily_logs.pain_* holds each day''s summary, recomputed by the app after every change.';
COMMENT ON COLUMN public.pain_entries.local_date IS
  'occurred_at as a date in the person''s time zone; the daily_logs.date this entry summarizes into.';
COMMENT ON COLUMN public.pain_entries.source IS
  '''app'' = logged in the app; ''daily_log'' = copied once from daily_logs by migration 222 (time set to 12:00 UTC).';

COMMIT;
