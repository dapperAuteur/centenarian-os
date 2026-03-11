-- Migration: 125_media_tracker.sql
-- Media consumption tracker for "All the Spoilers" brand

BEGIN;

-- Media categories (user-defined, auto-seeded on first GET)
CREATE TABLE IF NOT EXISTS public.media_categories (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,
  color      TEXT NOT NULL DEFAULT '#8b5cf6',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.media_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_categories_owner" ON public.media_categories FOR ALL
  USING (user_id = auth.uid());

-- Main media items table
CREATE TABLE IF NOT EXISTS public.media_items (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  creator          TEXT,
  media_type       TEXT NOT NULL CHECK (media_type IN (
    'book', 'tv_show', 'movie', 'video', 'song', 'album', 'podcast', 'art', 'article', 'other'
  )),
  status           TEXT NOT NULL DEFAULT 'want_to_consume' CHECK (status IN (
    'want_to_consume', 'in_progress', 'completed', 'dropped'
  )),
  rating           SMALLINT CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  start_date       DATE,
  end_date         DATE,
  genre            TEXT[] DEFAULT '{}',
  tags             TEXT[] DEFAULT '{}',
  cover_image_url  TEXT,
  external_url     TEXT,
  category_id      UUID REFERENCES public.media_categories(id) ON DELETE SET NULL,

  -- Progress tracking
  current_progress TEXT,
  total_length     TEXT,

  -- TV/series-specific
  season_number    SMALLINT,
  episode_number   SMALLINT,
  total_seasons    SMALLINT,
  total_episodes   SMALLINT,

  -- Brand connection
  brand_id         UUID REFERENCES public.user_brands(id) ON DELETE SET NULL,

  -- Visibility
  visibility       TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),

  -- Metadata
  year_released    SMALLINT,
  source_platform  TEXT,
  notes            TEXT,
  is_favorite      BOOLEAN NOT NULL DEFAULT false,
  use_count        INT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_items_user_type ON public.media_items(user_id, media_type);
CREATE INDEX idx_media_items_user_status ON public.media_items(user_id, status);
CREATE INDEX idx_media_items_brand ON public.media_items(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_media_items_visibility ON public.media_items(visibility) WHERE visibility = 'public';

ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_items_owner" ON public.media_items FOR ALL
  USING (user_id = auth.uid());
CREATE POLICY "media_items_public_read" ON public.media_items FOR SELECT
  USING (visibility = 'public' AND is_active = true);

-- Media notes (multiple per item, for podcast prep etc.)
CREATE TABLE IF NOT EXISTS public.media_notes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_item_id   UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  title           TEXT,
  content         TEXT NOT NULL DEFAULT '',
  content_format  TEXT NOT NULL DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'tiptap')),
  note_type       TEXT NOT NULL DEFAULT 'general' CHECK (note_type IN (
    'general', 'quote', 'review', 'podcast_prep', 'discussion_point', 'spoiler'
  )),
  is_public       BOOLEAN NOT NULL DEFAULT false,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_notes_item ON public.media_notes(media_item_id);

ALTER TABLE public.media_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_notes_owner" ON public.media_notes FOR ALL
  USING (user_id = auth.uid());

-- Podcast episodes
CREATE TABLE IF NOT EXISTS public.podcast_episodes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id         UUID REFERENCES public.user_brands(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  episode_number   INT,
  season_number    INT,
  air_date         DATE,
  description      TEXT,
  show_notes       TEXT,
  show_notes_format TEXT NOT NULL DEFAULT 'markdown' CHECK (show_notes_format IN ('markdown', 'tiptap')),
  audio_url        TEXT,
  external_url     TEXT,
  duration_min     INT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'recorded', 'published')),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_podcast_episodes_user ON public.podcast_episodes(user_id);
CREATE INDEX idx_podcast_episodes_brand ON public.podcast_episodes(brand_id) WHERE brand_id IS NOT NULL;

ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "podcast_episodes_owner" ON public.podcast_episodes FOR ALL
  USING (user_id = auth.uid());

-- Media <-> Podcast episode junction
CREATE TABLE IF NOT EXISTS public.media_episode_links (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_item_id    UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  episode_id       UUID NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  discussion_notes TEXT,
  timestamp_start  TEXT,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (media_item_id, episode_id)
);

CREATE INDEX idx_media_episode_links_episode ON public.media_episode_links(episode_id);
CREATE INDEX idx_media_episode_links_media ON public.media_episode_links(media_item_id);

ALTER TABLE public.media_episode_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_episode_links_owner" ON public.media_episode_links FOR ALL
  USING (user_id = auth.uid());

-- Extend activity_links CHECK constraints for new entity types
ALTER TABLE public.activity_links DROP CONSTRAINT IF EXISTS activity_links_source_type_check;
ALTER TABLE public.activity_links ADD CONSTRAINT activity_links_source_type_check
  CHECK (source_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment',
    'focus_session','exercise','daily_log','job',
    'media_item','podcast_episode'
  ));

ALTER TABLE public.activity_links DROP CONSTRAINT IF EXISTS activity_links_target_type_check;
ALTER TABLE public.activity_links ADD CONSTRAINT activity_links_target_type_check
  CHECK (target_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment',
    'focus_session','exercise','daily_log','job',
    'media_item','podcast_episode'
  ));

-- Extend entity_life_categories CHECK constraint
ALTER TABLE public.entity_life_categories DROP CONSTRAINT IF EXISTS entity_life_categories_entity_type_check;
ALTER TABLE public.entity_life_categories ADD CONSTRAINT entity_life_categories_entity_type_check
  CHECK (entity_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment',
    'focus_session','exercise','daily_log','job',
    'media_item','podcast_episode'
  ));

COMMIT;
