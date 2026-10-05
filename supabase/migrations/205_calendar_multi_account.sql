-- 205_calendar_multi_account.sql
-- Google Calendar sync: several Google accounts per user (for example personal and business),
-- plus two bookkeeping columns for the sync engine (plans/59, Part 4.2).
--
-- WHAT CHANGES
--   1. calendar_connections was UNIQUE (user_id, provider): one Google account per user.
--      It becomes unique per (user_id, provider, provider_sub). provider_sub is Google's stable
--      account id (the OpenID Connect "sub" claim), so each Google account a user connects gets
--      its own row, and reconnecting the same account updates that row.
--      The new unique index is created FIRST, then the old (user_id, provider) constraint is
--      dropped, so the table is never without a uniqueness rule.
--   2. calendar_connections.last_validated_at: when the settings page last asked Google whether
--      the saved authorization still works. GET /api/calendar/google re-checks a connection at
--      most once every 5 minutes, so a grant removed at myaccount.google.com/permissions shows
--      "Needs reconnecting" on the next page load without hammering Google.
--   3. calendar_connections.last_sync_summary: the counts from the last sync run (created,
--      updated, archived, flagged, unchanged, errors), shown on the settings page after a cron
--      run as well as after "Sync now".
--
-- WHY DROPPING A CONSTRAINT IS SAFE HERE (the shared-DB rule says additive only)
--   calendar_connections was created by migration 204 and is used ONLY by CentenarianOS
--   (lib/google/*, app/api/calendar/google/*). contractor-os / Work.WitUS never reads or writes
--   it. Dropping the narrower unique constraint only allows more rows; no column is dropped,
--   renamed or narrowed, and no existing row changes. Every row written so far has provider_sub
--   set (the 204 callback always stored it), so the new index builds on existing data.
--
-- SAFE TO RE-RUN: CREATE UNIQUE INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, and the constraint
-- is dropped by a DO block that looks it up in pg_constraint first (by its columns, not by a
-- guessed name), so a second run finds nothing to drop.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor after 204. Until it is
-- applied, connecting a second account fails on the old constraint and the routes answer with
-- code "migration_missing".

BEGIN;

-- 1a. The new rule: one row per Google account per user.
CREATE UNIQUE INDEX IF NOT EXISTS calendar_connections_user_provider_sub_key
  ON public.calendar_connections (user_id, provider, provider_sub);

-- 1b. Drop the old UNIQUE (user_id, provider), whatever Postgres named it.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.calendar_connections'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname::text)
        FROM unnest(c.conkey) AS k(attnum)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ) = ARRAY['provider', 'user_id']
  LOOP
    EXECUTE format('ALTER TABLE public.calendar_connections DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

-- Lookups by user (the old constraint's index used to serve these).
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user
  ON public.calendar_connections (user_id);

-- 2. Rate limit for the "is this authorization still valid?" check.
ALTER TABLE public.calendar_connections
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

-- 3. Counts from the last sync run.
ALTER TABLE public.calendar_connections
  ADD COLUMN IF NOT EXISTS last_sync_summary JSONB;

COMMENT ON TABLE public.calendar_connections IS
  'Google Calendar OAuth connections (migration 204; one row per Google account per user since 205). Holds app-encrypted tokens (lib/crypto/tokens.ts). RLS is enabled with no policies on purpose: service role only. Do not add a browser-readable policy.';

COMMIT;
