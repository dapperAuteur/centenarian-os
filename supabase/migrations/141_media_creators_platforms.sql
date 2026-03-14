-- 141_media_creators_platforms.sql
-- Saved creators and platforms for media autocomplete (reduces typos, speeds up entry)

BEGIN;

-- Media creators: artists, authors, directors, producers, networks
CREATE TABLE IF NOT EXISTS public.media_creators (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  use_count  INT         NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_media_creators_user ON public.media_creators(user_id);

ALTER TABLE public.media_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_creators_owner"
  ON public.media_creators
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Media platforms: Netflix, Kindle, Spotify, Audible, etc.
CREATE TABLE IF NOT EXISTS public.media_platforms (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  use_count  INT         NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_media_platforms_user ON public.media_platforms(user_id);

ALTER TABLE public.media_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_platforms_owner"
  ON public.media_platforms
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
