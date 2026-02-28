-- 071_audio_chapters.sql
-- Add chapter markers and transcript content to lessons for enhanced audio player.
-- audio_chapters: [{ id, title, startTime (seconds), endTime (seconds) }]
-- transcript_content: [{ startTime (seconds), endTime (seconds), text }]

BEGIN;

ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS audio_chapters JSONB;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS transcript_content JSONB;

COMMIT;
