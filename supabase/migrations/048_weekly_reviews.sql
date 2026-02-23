-- 048_weekly_reviews.sql
-- Stores AI-generated weekly reviews for each user.

BEGIN;

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  DATE        NOT NULL,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

-- RLS
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select" ON public.weekly_reviews
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "reviews_insert" ON public.weekly_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_update" ON public.weekly_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "reviews_delete" ON public.weekly_reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_weekly_reviews_updated_at
  BEFORE UPDATE ON public.weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
