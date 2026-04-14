-- 175_lesson_360_video.sql
-- Add 360 video lesson type for immersive equirectangular video lessons in Academy.
-- Reuses existing lessons.content_url for the video URL and lessons.duration_seconds
-- for progress tracking — no new tables needed for Phase 1 (single-video only,
-- not multi-scene tours).

BEGIN;

-- 1. Extend lesson_type CHECK to include '360video'
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_lesson_type_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_lesson_type_check
  CHECK (lesson_type IN ('video', 'text', 'audio', 'slides', 'quiz', '360video'));

-- 2. Optional autoplay flag for 360 video lessons (muted autoplay only,
--    enforced client-side to satisfy browser policies).
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_360_autoplay BOOLEAN DEFAULT false;

COMMIT;
