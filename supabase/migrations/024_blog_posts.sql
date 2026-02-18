-- 024_blog_posts.sql
-- Per-user blog posts with Tiptap JSON content and visibility controls

BEGIN;

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                 TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  slug                  TEXT        NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  excerpt               TEXT        CHECK (char_length(excerpt) <= 500),
  content               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  cover_image_url       TEXT,
  cover_image_public_id TEXT,
  -- visibility values:
  -- 'draft'              : only author can see, not listed anywhere
  -- 'private'            : only author when logged in (intentional, not just unsaved)
  -- 'authenticated_only' : any logged-in user can read
  -- 'public'             : anyone (including anonymous) can read
  -- 'scheduled'          : becomes publicly visible at scheduled_at
  visibility            TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (visibility IN ('draft','private','public','authenticated_only','scheduled')),
  scheduled_at          TIMESTAMPTZ,
  tags                  TEXT[]      NOT NULL DEFAULT '{}',
  reading_time_minutes  INT,
  view_count            INT         NOT NULL DEFAULT 0,
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_posts_slug_user_unique UNIQUE (user_id, slug),
  CONSTRAINT scheduled_requires_date CHECK (visibility != 'scheduled' OR scheduled_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_user_id ON public.blog_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_public  ON public.blog_posts(visibility, published_at DESC NULLS LAST)
  WHERE visibility IN ('public','scheduled');
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug    ON public.blog_posts(slug, user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags    ON public.blog_posts USING GIN(tags);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Authors: full access to their own posts (any visibility)
CREATE POLICY "Authors can CRUD their own posts"
  ON public.blog_posts FOR ALL USING (auth.uid() = user_id);

-- Authenticated users: read public, authenticated_only, and live scheduled posts by others
CREATE POLICY "Authenticated users can read non-private posts"
  ON public.blog_posts FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND auth.uid() != user_id AND
    (
      visibility IN ('public', 'authenticated_only')
      OR (visibility = 'scheduled' AND scheduled_at <= NOW())
    )
  );

-- Anonymous users: read public posts and live scheduled posts only
CREATE POLICY "Anonymous users can read public posts"
  ON public.blog_posts FOR SELECT
  USING (
    auth.uid() IS NULL AND
    (
      visibility = 'public'
      OR (visibility = 'scheduled' AND scheduled_at <= NOW())
    )
  );

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
