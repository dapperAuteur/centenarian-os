-- 043_facebook_share.sql
-- Adds 'share_facebook' to blog_events and recipe_events event_type CHECK constraints.
-- Must DROP the existing named constraint first, then ADD a new one that includes
-- the additional value. Postgres names inline CHECK constraints automatically:
--   blog_events_event_type_check
--   recipe_events_event_type_check

BEGIN;

-- blog_events ----------------------------------------------------------------
ALTER TABLE public.blog_events
  DROP CONSTRAINT IF EXISTS blog_events_event_type_check;

ALTER TABLE public.blog_events
  ADD CONSTRAINT blog_events_event_type_check CHECK (event_type IN (
    'view', 'read_25', 'read_50', 'read_75', 'read_100',
    'share_copy', 'share_email', 'share_linkedin', 'share_facebook',
    'blocked_visit'
  ));

-- recipe_events --------------------------------------------------------------
ALTER TABLE public.recipe_events
  DROP CONSTRAINT IF EXISTS recipe_events_event_type_check;

ALTER TABLE public.recipe_events
  ADD CONSTRAINT recipe_events_event_type_check CHECK (event_type IN (
    'view',
    'share_copy', 'share_email', 'share_linkedin', 'share_facebook',
    'blocked_visit'
  ));

COMMIT;
