-- supabase/migrations/191_course_generic_seasons.sql
-- Generic, course-agnostic "series + season" grouping. Previously the only
-- season concept was `bvc_season` (1/2/3), which is Better Vice Club-specific
-- and also drives the commodity-map embed on lesson pages. This adds a generic
-- series grouping so ANY multi-season course (e.g. Speedway) can group its
-- per-season course rows together and offer a season switcher.
--
-- Model: one course row per season (matches how BVC already works). Courses
-- sharing `series_slug` form a series; `season_number` orders them. `bvc_season`
-- is left untouched and continues to gate the BVC commodity map only.
--
-- Additive, nullable — existing courses are unaffected (series_slug NULL = a
-- standalone course, no grouping).

BEGIN;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS series_slug TEXT,
  ADD COLUMN IF NOT EXISTS series_title TEXT,
  ADD COLUMN IF NOT EXISTS season_number SMALLINT
    CHECK (season_number IS NULL OR season_number > 0);

COMMENT ON COLUMN public.courses.series_slug IS
  'Groups multiple course rows into one series (e.g. "speedway"). NULL for standalone courses. Courses with the same series_slug are shown together with a season switcher.';
COMMENT ON COLUMN public.courses.series_title IS
  'Human-readable series name shown above the season switcher (e.g. "Speedway: The Greatest Spectacle in Learning"). Falls back to the course title when unset.';
COMMENT ON COLUMN public.courses.season_number IS
  'Season ordering within a series (1, 2, 3, …). NULL when the course is not part of a series.';

-- Look up a series quickly when rendering the season switcher / catalog group.
CREATE INDEX IF NOT EXISTS idx_courses_series_slug
  ON public.courses (series_slug)
  WHERE series_slug IS NOT NULL;

COMMIT;
