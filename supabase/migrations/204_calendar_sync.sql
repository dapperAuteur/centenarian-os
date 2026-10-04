-- 204_calendar_sync.sql
-- Tables for the one-way Google Calendar -> CentenarianOS sync (plans/59, Part 4).
--
-- PURPOSE
--   calendar_connections     one row per user per provider: the OAuth tokens (encrypted by the app
--                            with lib/crypto/tokens.ts before they are written) and the connection
--                            state.
--   calendar_sync_calendars  the calendars on that account and which of them the user switched on.
--   calendar_sync_items      one row per calendar event the sync has seen: the Google event id and
--                            what CentenarianOS created from it. Phase 4.1 (connect) creates the
--                            table and leaves it empty; phase 4.2 (the sync engine) fills it.
--                            tasks.source_id is a UUID, so it cannot hold a Google event id; it
--                            will point at calendar_sync_items.id instead.
--
-- WHO CAN READ WHAT
--   calendar_connections holds tokens, so Row Level Security is on and there are NO policies: the
--   browser roles (anon, authenticated) can neither read nor write it, and their table privileges
--   are revoked as well. Only the service role reaches it, from API routes that have already
--   checked the user's session. (wearable_connections lets the browser read its own tokens; this
--   table deliberately does not repeat that.)
--   The other two tables hold no secrets. Their owner may SELECT their own rows; every write goes
--   through the service role.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): this file creates
-- three new tables and touches nothing that exists. It drops, renames and narrows nothing.
--
-- SAFE TO RE-RUN: every CREATE uses IF NOT EXISTS, every CREATE POLICY sits in a DO block that
-- checks pg_policies first, and ENABLE ROW LEVEL SECURITY / REVOKE / COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: migrations here are run by hand in the Supabase SQL editor. Until
-- this one is applied, the /api/calendar/google/* routes answer with a JSON error that says so.

BEGIN;

-- ── calendar_connections: tokens + connection state (service role only) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL DEFAULT 'google',

  -- The Google account that granted access. provider_sub is Google's stable account id (the
  -- OpenID Connect "sub" claim); the email can change, so it is for display only.
  account_email     TEXT,
  provider_sub      TEXT,

  -- AES-256-GCM ciphertext from encryptSecret() in lib/crypto/tokens.ts. Never plain text.
  access_token_enc  TEXT,
  refresh_token_enc TEXT,
  token_expires_at  TIMESTAMPTZ,
  scopes            TEXT,

  -- active        tokens work
  -- needs_reauth  Google rejected the refresh token (invalid_grant); the user must reconnect
  -- disconnected  reserved: the app deletes the row on disconnect rather than keeping it
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'needs_reauth', 'disconnected')),

  -- User defaults for records created from events: default_account_id, default_trip_mode,
  -- default_tag.
  settings          JSONB NOT NULL DEFAULT '{}'::jsonb,

  last_synced_at    TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, provider)
);

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Deliberately NO policies on calendar_connections (see WHO CAN READ WHAT above). Belt and
-- braces: also remove the table privileges Supabase grants the browser roles by default, so a
-- policy added by mistake later still exposes nothing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.calendar_connections FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.calendar_connections FROM authenticated;
  END IF;
END $$;

COMMENT ON TABLE public.calendar_connections IS
  'Google Calendar OAuth connection per user (migration 204). Holds app-encrypted tokens (lib/crypto/tokens.ts). RLS is enabled with no policies on purpose: service role only. Do not add a browser-readable policy.';

-- ── calendar_sync_calendars: the calendars on the account and which are switched on ──────────────
CREATE TABLE IF NOT EXISTS public.calendar_sync_calendars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Google's calendar id (often an email address), plus what the list call returned for display.
  calendar_id     TEXT NOT NULL,
  summary         TEXT,
  time_zone       TEXT,
  color           TEXT,

  -- Off until the user switches the calendar on. Switching it on clears sync_token so the next
  -- sync starts from scratch.
  enabled         BOOLEAN NOT NULL DEFAULT false,
  sync_token      TEXT,

  -- The planner milestone this calendar's tasks are filed under (set by the sync engine).
  milestone_id    UUID REFERENCES public.milestones(id) ON DELETE SET NULL,

  last_synced_at  TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (connection_id, calendar_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_calendars_user
  ON public.calendar_sync_calendars (user_id);

ALTER TABLE public.calendar_sync_calendars ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_sync_calendars'
      AND policyname = 'calendar_sync_calendars_owner_select'
  ) THEN
    CREATE POLICY "calendar_sync_calendars_owner_select" ON public.calendar_sync_calendars
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE public.calendar_sync_calendars IS
  'Calendars on a connected Google account and whether each is synced (migration 204). Owner may SELECT; writes go through the service role.';

-- ── calendar_sync_items: one row per event seen by the sync (filled from phase 4.2) ──────────────
CREATE TABLE IF NOT EXISTS public.calendar_sync_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- SET NULL, not CASCADE: disconnecting must not erase the record of which task or
  -- transaction came from which event.
  connection_id   UUID REFERENCES public.calendar_connections(id) ON DELETE SET NULL,

  -- Google ids. These are strings, never UUIDs.
  calendar_id     TEXT NOT NULL,
  event_id        TEXT NOT NULL,

  -- What Google said about the event the last time it was synced.
  etag            TEXT,
  event_updated   TIMESTAMPTZ,
  event_status    TEXT,
  title_snapshot  TEXT,

  -- What the title parser made of it.
  -- ok         parsed cleanly
  -- flagged    a token was present but its data was missing or unreadable; needs a look
  -- task_only  no token: the event became a plain planner task
  parsed          JSONB,
  parse_status    TEXT NOT NULL DEFAULT 'ok'
                  CHECK (parse_status IN ('ok', 'flagged', 'task_only')),
  parse_error     TEXT,

  -- What CentenarianOS created from the event. record_type/record_id name the row a token
  -- created (a transaction, trip, meal, workout); there is no foreign key because the target
  -- table varies.
  task_id         UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  record_type     TEXT,
  record_id       UUID,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, calendar_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_items_task
  ON public.calendar_sync_items (task_id)
  WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_sync_items_connection
  ON public.calendar_sync_items (connection_id)
  WHERE connection_id IS NOT NULL;

ALTER TABLE public.calendar_sync_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'calendar_sync_items'
      AND policyname = 'calendar_sync_items_owner_select'
  ) THEN
    CREATE POLICY "calendar_sync_items_owner_select" ON public.calendar_sync_items
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE public.calendar_sync_items IS
  'Map from a Google Calendar event to what CentenarianOS created from it (migration 204). tasks.source_id points at this table''s id. Owner may SELECT; writes go through the service role.';

COMMIT;
