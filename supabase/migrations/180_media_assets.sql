-- 180_media_assets.sql
-- Per-teacher media library. Every Cloudinary upload that a teacher
-- makes through CentenarianOS registers a row here so the teacher can
-- later find it by name, replace it, delete it, or reuse it across
-- multiple lessons.
--
-- Plan 27a (this migration) ships the schema + indexes. Plan 27b will
-- add the fuzzy-search UI; the trigram index is here now so 27b doesn't
-- need a second migration.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cloudinary_public_id TEXT NOT NULL,
  cloudinary_resource_type TEXT NOT NULL CHECK (cloudinary_resource_type IN ('image', 'video', 'raw')),
  secure_url TEXT NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('video', 'image', 'audio', 'panorama_video', 'panorama_image', 'document', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  file_size_bytes BIGINT,
  duration_seconds NUMERIC,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, cloudinary_public_id)
);

CREATE INDEX IF NOT EXISTS media_assets_owner_idx ON public.media_assets(owner_id);
CREATE INDEX IF NOT EXISTS media_assets_tags_idx ON public.media_assets USING GIN (tags);
CREATE INDEX IF NOT EXISTS media_assets_name_trgm ON public.media_assets USING GIN (name gin_trgm_ops);

-- RLS: teachers see and edit only their own library. Service role (used
-- by the register-on-upload API route) bypasses RLS.
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage own media_assets" ON public.media_assets;
CREATE POLICY "Teachers manage own media_assets" ON public.media_assets
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

COMMIT;
