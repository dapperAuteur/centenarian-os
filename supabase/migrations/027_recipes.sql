-- 027_recipes.sql
-- Public recipes repository with visibility controls, nutrition tracking, and engagement

BEGIN;

CREATE TABLE IF NOT EXISTS public.recipes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                 TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  slug                  TEXT        NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description           TEXT        CHECK (char_length(description) <= 500),
  content               JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- Tiptap JSON (instructions)
  cover_image_url       TEXT,
  cover_image_public_id TEXT,
  -- visibility values (same semantics as blog_posts):
  -- 'draft'              : only author can see, not listed anywhere
  -- 'private'            : only author when logged in
  -- 'authenticated_only' : any logged-in user can read
  -- 'public'             : anyone (including anonymous) can read
  -- 'scheduled'          : becomes publicly visible at scheduled_at
  visibility            TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (visibility IN ('draft','private','public','authenticated_only','scheduled')),
  scheduled_at          TIMESTAMPTZ,
  tags                  TEXT[]      NOT NULL DEFAULT '{}',
  -- Aggregated nutrition totals (recalculated whenever recipe_ingredients change)
  total_calories        NUMERIC(10,2),
  total_protein_g       NUMERIC(10,2),
  total_carbs_g         NUMERIC(10,2),
  total_fat_g           NUMERIC(10,2),
  total_fiber_g         NUMERIC(10,2),
  ncv_score             TEXT        CHECK (ncv_score IN ('Green','Yellow','Red')),
  -- Recipe metadata
  servings              INT         CHECK (servings > 0),
  prep_time_minutes     INT         CHECK (prep_time_minutes >= 0),
  cook_time_minutes     INT         CHECK (cook_time_minutes >= 0),
  -- Engagement counters (denormalized for fast reads)
  view_count            INT         NOT NULL DEFAULT 0,
  like_count            INT         NOT NULL DEFAULT 0,
  save_count            INT         NOT NULL DEFAULT 0,
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recipes_slug_user_unique UNIQUE (user_id, slug),
  CONSTRAINT scheduled_requires_date CHECK (visibility != 'scheduled' OR scheduled_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_recipes_user_id  ON public.recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_public   ON public.recipes(visibility, published_at DESC NULLS LAST)
  WHERE visibility IN ('public','scheduled');
CREATE INDEX IF NOT EXISTS idx_recipes_slug     ON public.recipes(slug, user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_tags     ON public.recipes USING GIN(tags);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Authors: full access to their own recipes (any visibility)
CREATE POLICY "Authors can CRUD their own recipes"
  ON public.recipes FOR ALL USING (auth.uid() = user_id);

-- Authenticated users: read public, authenticated_only, and live scheduled recipes by others
CREATE POLICY "Authenticated users can read non-private recipes"
  ON public.recipes FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND auth.uid() != user_id AND
    (
      visibility IN ('public', 'authenticated_only')
      OR (visibility = 'scheduled' AND scheduled_at <= NOW())
    )
  );

-- Anonymous users: read public recipes and live scheduled recipes only
CREATE POLICY "Anonymous users can read public recipes"
  ON public.recipes FOR SELECT
  USING (
    auth.uid() IS NULL AND
    (
      visibility = 'public'
      OR (visibility = 'scheduled' AND scheduled_at <= NOW())
    )
  );

CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
