-- Migration: 126_social_interactions.sql
-- Add public visibility to equipment, likes and share tracking for media + equipment

BEGIN;

-- Add visibility to equipment (media_items already has it from migration 125)
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public'));

CREATE INDEX IF NOT EXISTS idx_equipment_visibility
  ON public.equipment(visibility) WHERE visibility = 'public';

-- Public read policy for equipment
CREATE POLICY "equipment_public_read" ON public.equipment FOR SELECT
  USING (visibility = 'public' AND is_active = true);

-- Public read policy for equipment_media (inherits from equipment visibility)
CREATE POLICY "equipment_media_public_read" ON public.equipment_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.equipment e
      WHERE e.id = equipment_id
        AND e.visibility = 'public'
        AND e.is_active = true
    )
  );

-- Likes table (polymorphic: media_item, equipment)
CREATE TABLE IF NOT EXISTS public.social_likes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('media_item', 'equipment')),
  entity_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX idx_social_likes_entity ON public.social_likes(entity_type, entity_id);
CREATE INDEX idx_social_likes_user ON public.social_likes(user_id);

ALTER TABLE public.social_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_likes_owner" ON public.social_likes FOR ALL
  USING (user_id = auth.uid());
-- Anyone can read likes (for counts on public items)
CREATE POLICY "social_likes_public_read" ON public.social_likes FOR SELECT
  USING (true);

-- Like counts (denormalized for performance)
ALTER TABLE public.media_items
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;

-- Share tracking table
CREATE TABLE IF NOT EXISTS public.social_shares (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('media_item', 'equipment')),
  entity_id   UUID NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'link' CHECK (platform IN ('link', 'twitter', 'facebook', 'email', 'other')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_social_shares_entity ON public.social_shares(entity_type, entity_id);

ALTER TABLE public.social_shares ENABLE ROW LEVEL SECURITY;
-- Shares are insert-only for logged-in users, readable by all
CREATE POLICY "social_shares_insert" ON public.social_shares FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "social_shares_public_read" ON public.social_shares FOR SELECT
  USING (true);

-- Share counts (denormalized)
ALTER TABLE public.media_items
  ADD COLUMN IF NOT EXISTS share_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS share_count INT NOT NULL DEFAULT 0;

-- Extend activity_links CHECK constraints to include blog_post
ALTER TABLE public.activity_links DROP CONSTRAINT IF EXISTS activity_links_source_type_check;
ALTER TABLE public.activity_links ADD CONSTRAINT activity_links_source_type_check
  CHECK (source_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment',
    'focus_session','exercise','daily_log','job',
    'media_item','podcast_episode','blog_post'
  ));

ALTER TABLE public.activity_links DROP CONSTRAINT IF EXISTS activity_links_target_type_check;
ALTER TABLE public.activity_links ADD CONSTRAINT activity_links_target_type_check
  CHECK (target_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment',
    'focus_session','exercise','daily_log','job',
    'media_item','podcast_episode','blog_post'
  ));

-- Extend entity_life_categories CHECK constraint for blog_post
ALTER TABLE public.entity_life_categories DROP CONSTRAINT IF EXISTS entity_life_categories_entity_type_check;
ALTER TABLE public.entity_life_categories ADD CONSTRAINT entity_life_categories_entity_type_check
  CHECK (entity_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment',
    'focus_session','exercise','daily_log','job',
    'media_item','podcast_episode','blog_post'
  ));

COMMIT;
