-- 223_one_category_tree.sql
-- One category tree (plans/63 section E, option 1, chosen by BAM 2026-10-07).
--
-- PURPOSE
--   Life categories become the top level and budget categories sit under them, so there is one
--   set of categories instead of two. A budget category points at its life area (its parent);
--   a transaction's life area then follows from its budget category.
--
--   budget_categories.life_category_id   the budget category's life area. NULL = not placed yet
--                                         (the "Needs a life area" bucket on the Organize screen).
--                                         ON DELETE SET NULL: deleting a life area leaves its budget
--                                         categories unplaced, never deleted.
--
--   entity_life_categories.auto_source   who added a tag. NULL = a person (or Work.WitUS, or any
--                                         tag saved before this migration). 'budget_category' = the
--                                         app added it because the transaction's budget category
--                                         sits under that life area. The app only ever removes tags
--                                         marked 'budget_category' (when the transaction's category
--                                         changes); a tag a person added is never removed for them.
--
-- NO BACKFILL ON PURPOSE
--   This migration does not guess which life area a budget category belongs to. The Organize
--   categories screen (/dashboard/categories/organize) lists unplaced budget categories with
--   suggestions by name that the person confirms.
--
-- OWNERSHIP
--   A budget category may only point at a life area of the same user. The API checks it
--   (lib/auth/ownership.ts), and the trigger below refuses any other write as well, including
--   service-role writes. It only runs when life_category_id is set or changed, so writes that
--   never touch the column (all of Work.WitUS's) are unaffected.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database and reads and writes
-- both tables): two nullable columns, one CHECK on the new column, one partial index, one
-- validation trigger. Nothing is dropped, renamed or rewritten, and no existing row changes.
-- Work.WitUS inserts that leave the new columns out get NULL, which means "not placed" and
-- "added by a person".
--
-- SAFE TO RE-RUN: ADD COLUMN / CREATE INDEX ... IF NOT EXISTS, CREATE OR REPLACE FUNCTION, and the
-- constraint and trigger sit in DO blocks that check first.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied the app
-- shows the two lists as before (every budget category under "No life area"), and the parts that
-- need it say "Run migration 223 first".

BEGIN;

-- 1. A budget category's life area ---------------------------------------------------------------

ALTER TABLE public.budget_categories
  ADD COLUMN IF NOT EXISTS life_category_id UUID NULL
    REFERENCES public.life_categories(id) ON DELETE SET NULL;

-- Serves "the budget categories under this life area" and the ON DELETE SET NULL lookup.
CREATE INDEX IF NOT EXISTS idx_budget_categories_life_category
  ON public.budget_categories (life_category_id)
  WHERE life_category_id IS NOT NULL;

-- Same-user rule, checked in the database too. SECURITY INVOKER (the default): under a signed-in
-- session RLS already hides other users' life areas, and for the service role the user_id
-- comparison does the work.
CREATE OR REPLACE FUNCTION public.budget_categories_life_area_owner_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.life_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.life_categories lc
    WHERE lc.id = NEW.life_category_id AND lc.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'life_category_id must be one of the same user''s life categories'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'budget_categories_life_area_owner'
      AND tgrelid = 'public.budget_categories'::regclass
  ) THEN
    CREATE TRIGGER budget_categories_life_area_owner
      BEFORE INSERT OR UPDATE OF life_category_id, user_id ON public.budget_categories
      FOR EACH ROW EXECUTE FUNCTION public.budget_categories_life_area_owner_check();
  END IF;
END $$;

COMMENT ON COLUMN public.budget_categories.life_category_id IS
  'The life area this budget category sits under (one category tree, plans/63 E). NULL = not placed yet. Same user only (trigger budget_categories_life_area_owner).';

-- 2. Who added a life-area tag -------------------------------------------------------------------

ALTER TABLE public.entity_life_categories
  ADD COLUMN IF NOT EXISTS auto_source TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'entity_life_categories_auto_source_check'
      AND conrelid = 'public.entity_life_categories'::regclass
  ) THEN
    ALTER TABLE public.entity_life_categories
      ADD CONSTRAINT entity_life_categories_auto_source_check
        CHECK (auto_source IS NULL OR auto_source IN ('budget_category'));
  END IF;
END $$;

COMMENT ON COLUMN public.entity_life_categories.auto_source IS
  'NULL = added by a person (never removed automatically). ''budget_category'' = added by the app from the transaction''s budget category; removed again when that category changes.';

COMMIT;
