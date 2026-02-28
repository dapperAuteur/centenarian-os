-- 075_podcast_links.sql
-- Replace single podcast_url TEXT with podcast_links JSONB array.
-- Supports multiple platforms per lesson: [{ url, label }]

BEGIN;

ALTER TABLE public.lessons DROP COLUMN IF EXISTS podcast_url;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS podcast_links JSONB;

COMMIT;
