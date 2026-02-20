-- 037_feature_batch.sql
-- Adds: subscription cancellation tracking, recipe source URL, and user feedback table.

BEGIN;

-- ─── Profiles: cancellation tracking ─────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_feedback TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_comment  TEXT;

-- ─── Recipes: source citation URL ────────────────────────────────────────────
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- ─── User feedback ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  category   TEXT        NOT NULL CHECK (category IN ('bug', 'feature', 'general')),
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit feedback
CREATE POLICY "Users can insert own feedback"
  ON public.user_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all (used by admin page)
CREATE POLICY "Service role can read all feedback"
  ON public.user_feedback
  FOR SELECT
  TO service_role
  USING (true);

COMMIT;
