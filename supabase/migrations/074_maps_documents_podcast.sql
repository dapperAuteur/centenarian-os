-- 074_maps_documents_podcast.sql
-- Add interactive maps, document gallery, and podcast linking to lessons.
-- map_content: JSONB — center, zoom, markers, lines, polygons for Leaflet rendering
-- documents: JSONB — array of { id, url, title, description, source_url }
-- podcast_url: TEXT — link to podcast episode on Spotify/Apple/etc.

BEGIN;

ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS map_content JSONB;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS documents JSONB;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS podcast_url TEXT;

COMMIT;
