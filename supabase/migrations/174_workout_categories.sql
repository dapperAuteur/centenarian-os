-- 174_workout_categories.sql
-- Add workout_categories table (mirrors exercise_categories pattern).
-- workout_templates.category_id FK replaces the free-text category column.

BEGIN;

-- ── 1. Workout categories table ──
CREATE TABLE IF NOT EXISTS public.workout_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,
  color      TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_global  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_workout_categories_user ON workout_categories (user_id);
ALTER TABLE workout_categories ENABLE ROW LEVEL SECURITY;

-- Users see their own + global categories
CREATE POLICY workout_categories_select ON workout_categories
  FOR SELECT USING (user_id = auth.uid() OR is_global = true);
CREATE POLICY workout_categories_insert ON workout_categories
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY workout_categories_update ON workout_categories
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY workout_categories_delete ON workout_categories
  FOR DELETE USING (user_id = auth.uid());

-- ── 2. Seed global default categories ──
INSERT INTO public.workout_categories (user_id, name, sort_order, is_global) VALUES
  (NULL, 'Strength',    0, true),
  (NULL, 'Cardio',      1, true),
  (NULL, 'HIIT',        2, true),
  (NULL, 'Yoga',        3, true),
  (NULL, 'Flexibility',  4, true),
  (NULL, 'Cycling',     5, true),
  (NULL, 'Running',     6, true),
  (NULL, 'Swimming',    7, true),
  (NULL, 'AM Priming',  8, true),
  (NULL, 'PM Recovery', 9, true),
  (NULL, 'Hotel',       10, true),
  (NULL, 'Gym',         11, true),
  (NULL, 'Friction Protocol', 12, true),
  (NULL, 'Other',       13, true)
ON CONFLICT DO NOTHING;

-- ── 3. Add category_id FK to workout_templates ──
ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.workout_categories(id) ON DELETE SET NULL;

-- ── 4. Backfill category_id from existing text category values ──
UPDATE public.workout_templates wt
SET category_id = wc.id
FROM public.workout_categories wc
WHERE wc.is_global = true
  AND wt.category IS NOT NULL
  AND wt.category_id IS NULL
  AND (
    -- Exact match
    LOWER(wt.category) = LOWER(wc.name)
    -- Map old Nomad codes to new names
    OR (wt.category = 'AM' AND wc.name = 'AM Priming')
    OR (wt.category = 'PM' AND wc.name = 'PM Recovery')
    OR (wt.category = 'WORKOUT_HOTEL' AND wc.name = 'Hotel')
    OR (wt.category = 'WORKOUT_GYM' AND wc.name = 'Gym')
    OR (wt.category = 'friction' AND wc.name = 'Friction Protocol')
    OR (wt.category = 'general' AND wc.name = 'Other')
  );

COMMIT;
