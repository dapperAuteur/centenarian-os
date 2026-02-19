-- 030_recipe_likes_saves.sql
-- Authenticated user engagement: likes and saves for recipes.
-- Composite primary keys prevent duplicate interactions.
-- Denormalized counts are maintained on the recipes table via RPCs in migration 031.

BEGIN;

CREATE TABLE IF NOT EXISTS public.recipe_likes (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id   UUID        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_likes_recipe_id ON public.recipe_likes(recipe_id);

ALTER TABLE public.recipe_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own likes"
  ON public.recipe_likes FOR ALL USING (auth.uid() = user_id);

-- Allow reading like status for any authenticated user (to show like state)
CREATE POLICY "Authenticated users can read likes"
  ON public.recipe_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.recipe_saves (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id   UUID        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_saves_recipe_id ON public.recipe_saves(recipe_id);

ALTER TABLE public.recipe_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saves"
  ON public.recipe_saves FOR ALL USING (auth.uid() = user_id);

-- Allow reading save status for the current user only
CREATE POLICY "Authenticated users can read their own saves"
  ON public.recipe_saves FOR SELECT
  USING (auth.uid() = user_id);

COMMIT;
