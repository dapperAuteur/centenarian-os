-- supabase/migrations/184_course_bvc_season.sql
-- Per-course Better Vice Club season marker. When set (1/2/3), the
-- lesson page embeds the /academy/explore MapTabs filtered to only
-- that season's commodities. NULL = not a BVC course, no embed.
--
-- Additive, nullable — existing non-BVC courses are unaffected.

BEGIN;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS bvc_season SMALLINT
  CHECK (bvc_season IS NULL OR bvc_season IN (1, 2, 3));

COMMENT ON COLUMN public.courses.bvc_season IS
  'Better Vice Club season (1, 2, or 3). When set, the lesson page embeds the /academy/explore MapTabs filtered to this season. NULL for non-BVC courses.';

COMMIT;
