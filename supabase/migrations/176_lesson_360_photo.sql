-- 176_lesson_360_photo.sql
-- Add 360 photo lesson type for single equirectangular still-image immersive
-- lessons in Academy. Reuses lessons.content_url for the image URL. No new
-- columns or tables — the player renders immediately and the lesson is marked
-- complete on first view (no playback duration to wait through).

BEGIN;

ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_lesson_type_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_lesson_type_check
  CHECK (lesson_type IN ('video', 'text', 'audio', 'slides', 'quiz', '360video', 'photo_360'));

COMMIT;
