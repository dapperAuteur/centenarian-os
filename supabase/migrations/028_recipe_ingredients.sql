-- 028_recipe_ingredients.sql
-- Standalone recipe ingredients with denormalized nutrition data.
-- Independent from the personal fuel module ingredients library so that
-- public recipes are fully self-contained and readable by all visitors.

BEGIN;

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID          NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name          TEXT          NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  quantity      NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  unit          TEXT          NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 50),
  -- Denormalized nutrition for this specific quantity (not per 100g)
  -- Populated via USDA, Open Food Facts, or barcode scan at authoring time
  calories      NUMERIC(10,2),
  protein_g     NUMERIC(10,2),
  carbs_g       NUMERIC(10,2),
  fat_g         NUMERIC(10,2),
  fiber_g       NUMERIC(10,2),
  -- External source references (for attribution and re-lookup)
  usda_fdc_id   TEXT,
  off_barcode   TEXT,
  brand         TEXT,
  sort_order    INT           NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON public.recipe_ingredients(recipe_id, sort_order);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Recipe owner has full access to their recipe's ingredients
CREATE POLICY "Recipe owners can manage ingredients"
  ON public.recipe_ingredients FOR ALL
  USING (
    recipe_id IN (SELECT id FROM public.recipes WHERE user_id = auth.uid())
  );

-- Public can read ingredients of publicly accessible recipes
CREATE POLICY "Public can read ingredients of accessible recipes"
  ON public.recipe_ingredients FOR SELECT
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
