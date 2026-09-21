-- 199_roadmap_system_kind.sql
-- Flag the roadmaps the app creates on its own, so pages and correlation code can tell them apart
-- from roadmaps a person built by hand.
--
-- WHAT IT IS FOR
-- CentOS now creates two kinds of roadmap without being asked:
--   'inbox'           - "Inbox > Inbox > Inbox". One-field task capture (POST /api/tasks) files a
--                       task here when no goal is picked. Built lazily by
--                       lib/planner/inbox.ts#resolveInboxMilestone.
--   'work_witus_sync' - "Work.WitUS Sync > Finances > {Invoice Due Dates, Expected Payments}".
--                       Holds tasks mirrored from Work.WitUS income events. Built lazily by
--                       lib/planner/sync-tasks.ts#ensureMilestone (formerly by the triggers from
--                       migrations 148/154, dropped in 198).
-- NULL means a roadmap the person made. The Roadmap page shows system roadmaps with an "Auto"
-- badge and hides their permanent-delete controls (archiving still works; the app rebuilds an
-- archived Inbox). No correlation math reads this column yet; how system roadmaps should count
-- there is an open decision.
--
-- WHY A COLUMN, NOT THE TITLE
-- Until now the only way to find these roadmaps was by title, and a person can rename a roadmap
-- or make their own called "Inbox". The app keeps a title fallback so it works before this
-- migration is applied (it detects the missing column, Postgres 42703 / PostgREST PGRST204, and
-- retries without it). Once applied, the column is authoritative.
--
-- SHARED DB (contractor-os uses the same database): ADDITIVE ONLY. One nullable column with no
-- default, so every existing insert in either app keeps working unchanged. contractor-os code does
-- not read or write `roadmaps` today, and a NULL here means "not a system roadmap", which is the
-- right answer for anything it might create. RLS is unchanged.
--
-- SAFE TO RE-RUN: ADD COLUMN IF NOT EXISTS (the CHECK is part of the column, so it is skipped
-- with it), and both backfills only touch rows where system_kind IS NULL.

ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS system_kind TEXT
    CHECK (system_kind IS NULL OR system_kind IN ('inbox', 'work_witus_sync'));

COMMENT ON COLUMN public.roadmaps.system_kind IS
  'NULL = made by the person. inbox = auto-created Inbox for one-field task capture. work_witus_sync = auto-created home for Work.WitUS income-event tasks. Set by the app, never by the person.';

-- Backfill 1: every existing "Work.WitUS Sync" roadmap. Created by the 148/154 triggers and by
-- lib/planner/sync-tasks.ts, always with exactly this title.
UPDATE public.roadmaps
   SET system_kind = 'work_witus_sync'
 WHERE system_kind IS NULL
   AND title = 'Work.WitUS Sync';

-- Backfill 2: Inbox roadmaps created by the app before this migration was applied (the code ships
-- first and falls back to the title). Guarded by the shape the app builds, an "Inbox" goal under
-- the "Inbox" roadmap, so a person's own roadmap that merely happens to be called "Inbox" is left
-- alone.
UPDATE public.roadmaps r
   SET system_kind = 'inbox'
 WHERE r.system_kind IS NULL
   AND r.title = 'Inbox'
   AND EXISTS (
     SELECT 1 FROM public.goals g
      WHERE g.roadmap_id = r.id
        AND g.title = 'Inbox'
   );
