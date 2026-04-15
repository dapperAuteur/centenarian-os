-- 177_lesson_360_poster.sql
-- Add a nullable video_360_poster_url column for 2D thumbnail previews of
-- 360° lessons. The poster URL is derived client-side from the Cloudinary
-- upload URL via the so_0 (first-frame) transformation for videos, or a plain
-- resize for images. Used by:
--   1. Lesson360VideoPlayer as an <img> placeholder while PSV loads
--   2. No-WebGL fallback (static image instead of empty black box)
--   3. Course catalog thumbnails for 360° lessons
--   4. OpenGraph preview cards when the lesson is shared
-- Additive, nullable — existing 360° rows are untouched; a backfill script
-- can populate them later if desired.

BEGIN;

ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_360_poster_url TEXT;

COMMIT;
