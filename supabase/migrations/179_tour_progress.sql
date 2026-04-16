-- 179_tour_progress.sql
-- Add tour_progress JSONB column to lesson_progress for tracking which
-- hotspots a learner has visited in a virtual_tour lesson. Stores:
--   { visited_hotspot_ids: string[] }
-- The lesson is marked complete when visited_hotspot_ids.length equals
-- the total number of hotspots in the tour.

BEGIN;

ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS tour_progress JSONB;

COMMIT;
