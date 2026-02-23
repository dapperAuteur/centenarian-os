-- 049_shortlinks.sql
-- Add short_link_id and short_link_url columns for Switchy.io integration

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS short_link_id  TEXT,
  ADD COLUMN IF NOT EXISTS short_link_url TEXT;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS short_link_id  TEXT,
  ADD COLUMN IF NOT EXISTS short_link_url TEXT;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS short_link_id  TEXT,
  ADD COLUMN IF NOT EXISTS short_link_url TEXT;
