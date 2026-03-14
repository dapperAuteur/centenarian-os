-- 140_media_notes_audio.sql
-- Add audio recording support to media notes

ALTER TABLE public.media_notes
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_public_id TEXT;
