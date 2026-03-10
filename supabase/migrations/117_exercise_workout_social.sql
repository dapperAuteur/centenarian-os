-- 117_exercise_workout_social.sql
-- Social layer for exercises and workout templates:
-- visibility (private/public), likes, completions (done tracking),
-- copy counts, share tracking, and user social preferences.

BEGIN;

-- ==========================================================================
-- 1. Visibility + social columns on exercises
-- ==========================================================================

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public')),
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copy_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS done_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_exercises_visibility ON public.exercises(visibility)
  WHERE visibility = 'public';

-- ==========================================================================
-- 2. Visibility + social columns on workout_templates
-- ==========================================================================

ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public')),
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copy_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS done_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_workout_templates_visibility ON public.workout_templates(visibility)
  WHERE visibility = 'public';

-- ==========================================================================
-- 3. Exercise likes
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.exercise_likes (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id UUID        NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_likes_exercise ON public.exercise_likes(exercise_id);

ALTER TABLE public.exercise_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own exercise likes"
  ON public.exercise_likes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read exercise likes"
  ON public.exercise_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Trigger: maintain exercises.like_count
CREATE OR REPLACE FUNCTION public.update_exercise_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.exercises SET like_count = like_count + 1 WHERE id = NEW.exercise_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.exercises SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.exercise_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS exercise_likes_count_trigger ON public.exercise_likes;
CREATE TRIGGER exercise_likes_count_trigger
  AFTER INSERT OR DELETE ON public.exercise_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_exercise_like_count();

-- ==========================================================================
-- 4. Workout likes
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.workout_likes (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID        NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_likes_template ON public.workout_likes(template_id);

ALTER TABLE public.workout_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own workout likes"
  ON public.workout_likes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read workout likes"
  ON public.workout_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Trigger: maintain workout_templates.like_count
CREATE OR REPLACE FUNCTION public.update_workout_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.workout_templates SET like_count = like_count + 1 WHERE id = NEW.template_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.workout_templates SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.template_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS workout_likes_count_trigger ON public.workout_likes;
CREATE TRIGGER workout_likes_count_trigger
  AFTER INSERT OR DELETE ON public.workout_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_workout_like_count();

-- ==========================================================================
-- 5. Exercise completions (done tracking)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.exercise_completions (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id  UUID        NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_completions_user ON public.exercise_completions(user_id, exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_completions_exercise ON public.exercise_completions(exercise_id);

ALTER TABLE public.exercise_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own exercise completions"
  ON public.exercise_completions FOR ALL USING (auth.uid() = user_id);

-- Trigger: maintain exercises.done_count
CREATE OR REPLACE FUNCTION public.update_exercise_done_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.exercises SET done_count = done_count + 1 WHERE id = NEW.exercise_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.exercises SET done_count = GREATEST(0, done_count - 1) WHERE id = OLD.exercise_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS exercise_completions_count_trigger ON public.exercise_completions;
CREATE TRIGGER exercise_completions_count_trigger
  AFTER INSERT OR DELETE ON public.exercise_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_exercise_done_count();

-- ==========================================================================
-- 6. Workout completions (done tracking)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.workout_completions (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id  UUID        NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_completions_user ON public.workout_completions(user_id, template_id);
CREATE INDEX IF NOT EXISTS idx_workout_completions_template ON public.workout_completions(template_id);

ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own workout completions"
  ON public.workout_completions FOR ALL USING (auth.uid() = user_id);

-- Trigger: maintain workout_templates.done_count
CREATE OR REPLACE FUNCTION public.update_workout_done_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.workout_templates SET done_count = done_count + 1 WHERE id = NEW.template_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.workout_templates SET done_count = GREATEST(0, done_count - 1) WHERE id = OLD.template_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS workout_completions_count_trigger ON public.workout_completions;
CREATE TRIGGER workout_completions_count_trigger
  AFTER INSERT OR DELETE ON public.workout_completions
  FOR EACH ROW EXECUTE FUNCTION public.update_workout_done_count();

-- ==========================================================================
-- 7. Content shares (no PII — uses public_alias)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.content_shares (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_alias   TEXT        NOT NULL,
  content_type TEXT        NOT NULL CHECK (content_type IN ('exercise', 'workout')),
  content_id   UUID        NOT NULL,
  platform     TEXT,
  shared_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_shares_content ON public.content_shares(content_type, content_id);

ALTER TABLE public.content_shares ENABLE ROW LEVEL SECURITY;

-- Shares are insert-only for authenticated users, readable by service role (admin)
CREATE POLICY "Authenticated users can insert shares"
  ON public.content_shares FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read share counts"
  ON public.content_shares FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ==========================================================================
-- 8. User social preferences on profiles
-- ==========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS likes_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_done_counts BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_alias TEXT UNIQUE;

-- ==========================================================================
-- 9. Updated RLS for exercises — allow public read (including anon)
-- ==========================================================================

-- Drop the existing owner-only policy to replace with broader access
DROP POLICY IF EXISTS exercises_owner ON public.exercises;

-- Owner: full CRUD on own exercises
CREATE POLICY "exercises_owner_all"
  ON public.exercises FOR ALL
  USING (user_id = auth.uid());

-- Public exercises: readable by anyone (including unauthenticated)
CREATE POLICY "exercises_public_read"
  ON public.exercises FOR SELECT
  USING (visibility = 'public' AND is_active = true);

-- ==========================================================================
-- 10. Updated RLS for workout_templates — allow public read (including anon)
-- ==========================================================================

DROP POLICY IF EXISTS workout_templates_owner ON public.workout_templates;

-- Owner: full CRUD on own templates
CREATE POLICY "workout_templates_owner_all"
  ON public.workout_templates FOR ALL
  USING (user_id = auth.uid());

-- Public templates: readable by anyone (including unauthenticated)
CREATE POLICY "workout_templates_public_read"
  ON public.workout_templates FOR SELECT
  USING (visibility = 'public');

COMMIT;
