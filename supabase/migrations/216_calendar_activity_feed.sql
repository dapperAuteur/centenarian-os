-- 216_calendar_activity_feed.sql
-- The calendar activity feed to RideWitUS (RideWitUS PRD §5.8 and §6.5a).
--
-- PURPOSE
--   calendar_sync_items      keeps when and where each synced event happens, so CentenarianOS can
--                            send RideWitUS the events it needs to suggest trips. Until now the
--                            location only landed inside the planner task's description and the
--                            end time was not kept.
--     starts_at              the event's start as an instant. All-day events: midnight of the
--                            start date in time_zone.
--     ends_at                the event's end as an instant. All-day events: midnight of Google's
--                            (exclusive) end date in time_zone.
--     all_day                true when Google sent start.date instead of start.dateTime.
--     time_zone              IANA name the times are shown in: the event's own, else its calendar's.
--     location               the Location field as typed in Google, free text.
--   calendar_sync_calendars  two per-calendar switches.
--     share_with_ridewitus   send this calendar's events (with a location) to RideWitUS. Off by
--                            default (RideWitUS PRD §13 Q7).
--     hide_titles_for_ridewitus  send "Event" instead of the title. Off by default: titles name the
--                            trip (RideWitUS PRD §13 Q7).
--
-- WHO CAN READ WHAT: unchanged. Both tables keep their owner-SELECT policy from migration 204; every
-- write goes through the service role.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): this file adds
-- nullable columns and two boolean columns with defaults. It drops, renames and narrows nothing.
--
-- SAFE TO RE-RUN: every ADD COLUMN uses IF NOT EXISTS; CREATE INDEX uses IF NOT EXISTS; COMMENT is
-- repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. The app works before it is
-- applied: the sync skips the new columns, the share switches are reported as not available yet,
-- and nothing is sent to RideWitUS. After applying, run
--   node --env-file=.env.local --experimental-strip-types scripts/backfill-calendar-event-fields.mjs --dry
-- then without --dry, to fill the new columns for events synced before this migration.

BEGIN;

ALTER TABLE public.calendar_sync_items ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE public.calendar_sync_items ADD COLUMN IF NOT EXISTS ends_at   TIMESTAMPTZ;
ALTER TABLE public.calendar_sync_items ADD COLUMN IF NOT EXISTS all_day   BOOLEAN;
ALTER TABLE public.calendar_sync_items ADD COLUMN IF NOT EXISTS time_zone TEXT;
ALTER TABLE public.calendar_sync_items ADD COLUMN IF NOT EXISTS location  TEXT;

-- The feed reads one user's events by start time inside a window.
CREATE INDEX IF NOT EXISTS idx_calendar_sync_items_user_starts
  ON public.calendar_sync_items (user_id, calendar_id, starts_at)
  WHERE starts_at IS NOT NULL;

ALTER TABLE public.calendar_sync_calendars
  ADD COLUMN IF NOT EXISTS share_with_ridewitus BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.calendar_sync_calendars
  ADD COLUMN IF NOT EXISTS hide_titles_for_ridewitus BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.calendar_sync_items.starts_at IS
  'Event start as an instant (migration 216). All-day: midnight of the start date in time_zone.';
COMMENT ON COLUMN public.calendar_sync_items.ends_at IS
  'Event end as an instant (migration 216). All-day: midnight of Google''s exclusive end date in time_zone.';
COMMENT ON COLUMN public.calendar_sync_items.all_day IS
  'True when Google sent start.date (an all-day event) (migration 216).';
COMMENT ON COLUMN public.calendar_sync_items.time_zone IS
  'IANA time zone of the event, else of its calendar (migration 216).';
COMMENT ON COLUMN public.calendar_sync_items.location IS
  'Google Calendar Location field as typed, free text (migration 216). Sent to RideWitUS only for shared calendars.';
COMMENT ON COLUMN public.calendar_sync_calendars.share_with_ridewitus IS
  'Send this calendar''s events that have a location to RideWitUS (migration 216). Off by default.';
COMMENT ON COLUMN public.calendar_sync_calendars.hide_titles_for_ridewitus IS
  'Send "Event" instead of event titles to RideWitUS (migration 216). Off by default.';

COMMIT;
