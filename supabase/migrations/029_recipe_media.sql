-- 029_recipe_media.sql
-- Additional images and videos for recipes beyond the cover image.
-- Stored as Cloudinary assets.

BEGIN;

CREATE TABLE IF NOT EXISTS public.recipe_media (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  url           TEXT        NOT NULL,
  public_id     TEXT        NOT NULL,  -- Cloudinary public_id for deletion
  resource_type TEXT        NOT NULL CHECK (resource_type IN ('image','video')),
  caption       TEXT        CHECK (char_length(caption) <= 200),
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_media_recipe_id ON public.recipe_media(recipe_id, sort_order);

ALTER TABLE public.recipe_media ENABLE ROW LEVEL SECURITY;

-- Recipe owner manages their media
CREATE POLICY "Recipe owners can manage media"
  ON public.recipe_media FOR ALL
  USING (
    recipe_id IN (SELECT id FROM public.recipes WHERE user_id = auth.uid())
  );

-- Public can read media of accessible recipes
CREATE POLICY "Public can read media of accessible recipes"
  ON public.recipe_media FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM public.recipes
      WHERE
        visibility = 'public'
        OR (visibility = 'scheduled' AND scheduled_at <= NOW())
        OR (visibility = 'authenticated_only' AND auth.uid() IS NOT NULL)
    )
  );

COMMIT;
