-- 032_simplify_recipe_visibility.sql
-- Reduces recipe visibility to three states: draft, public, scheduled.
-- Migrates existing private → draft, authenticated_only → public before
-- tightening the CHECK constraint.

BEGIN;

-- 1. Migrate legacy rows
UPDATE public.recipes SET visibility = 'draft'  WHERE visibility = 'private';
UPDATE public.recipes SET visibility = 'public' WHERE visibility = 'authenticated_only';

-- 2. Replace the visibility CHECK constraint
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_visibility_check;
ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_visibility_check
  CHECK (visibility IN ('draft', 'public', 'scheduled'));

-- 3. Drop the "authenticated_only" RLS read policy (no longer applicable)
DROP POLICY IF EXISTS "Authenticated users can read non-private recipes" ON public.recipes;

-- 4. Recreate recipe_ingredients visibility policy without authenticated_only
DROP POLICY IF EXISTS "Public can read ingredients of accessible recipes" ON public.recipe_ingredients;
CREATE POLICY "Public can read ingredients of accessible recipes"
  ON public.recipe_ingredients FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM public.recipes
      WHERE
        visibility = 'public'
        OR (visibility = 'scheduled' AND scheduled_at <= NOW())
    )
  );

-- 5. Recreate recipe_media visibility policy without authenticated_only
DROP POLICY IF EXISTS "Public can read media of accessible recipes" ON public.recipe_media;
CREATE POLICY "Public can read media of accessible recipes"
  ON public.recipe_media FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM public.recipes
      WHERE
        visibility = 'public'
        OR (visibility = 'scheduled' AND scheduled_at <= NOW())
    )
  );

COMMIT;
