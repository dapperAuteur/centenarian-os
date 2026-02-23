-- 045_learning_paths.sql
-- Learning paths, achievements, and public progress profiles.
--
-- Tables:
--   learning_paths              — teacher-authored sequences of courses
--   learning_path_courses       — many-to-many junction (course can be in multiple paths)
--   learning_path_completions   — awarded when all required courses in a path are complete
--   user_achievements           — badge shelf: course completions, path completions, streaks, etc.

BEGIN;

-- ─── 1. Learning Paths ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  is_published    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published paths"
  ON public.learning_paths FOR SELECT
  USING (is_published = TRUE);

CREATE POLICY "Teachers manage own paths"
  ON public.learning_paths FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- ─── 2. Learning Path Courses (many-to-many) ─────────────────────────────────
-- A course can appear in multiple paths; a path has many courses in order.
CREATE TABLE IF NOT EXISTS public.learning_path_courses (
  path_id         UUID        NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  course_id       UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_index     INT         NOT NULL DEFAULT 0,
  is_required     BOOLEAN     NOT NULL DEFAULT TRUE,
  PRIMARY KEY (path_id, course_id)
);

ALTER TABLE public.learning_path_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read path courses for published paths"
  ON public.learning_path_courses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE id = path_id AND is_published = TRUE
    )
  );

CREATE POLICY "Teachers manage courses in own paths"
  ON public.learning_path_courses FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE id = path_id AND teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.learning_paths
      WHERE id = path_id AND teacher_id = auth.uid()
    )
  );

-- ─── 3. Learning Path Completions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_path_completions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id         UUID        NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, path_id)
);

ALTER TABLE public.learning_path_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own path completions"
  ON public.learning_path_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages path completions"
  ON public.learning_path_completions FOR ALL USING (false) WITH CHECK (false);

-- ─── 4. User Achievements (badge shelf) ──────────────────────────────────────
-- achievement_type values:
--   course_complete   — ref_id = course_id
--   path_complete     — ref_id = path_id
--   streak_7          — ref_id = null (7-day metric logging streak)
--   streak_30         — ref_id = null
--   streak_90         — ref_id = null
--   first_log         — ref_id = null
--   first_blog        — ref_id = null (first blog post published)
--   first_recipe      — ref_id = null

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type TEXT        NOT NULL,
  ref_id           UUID,       -- course_id, path_id, or null
  earned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_type, ref_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own achievements"
  ON public.user_achievements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Public profiles can read any user's achievements (for profile page)
CREATE POLICY "Anyone can read achievements"
  ON public.user_achievements FOR SELECT
  USING (true);

CREATE POLICY "Service role manages achievements"
  ON public.user_achievements FOR INSERT WITH CHECK (false);

COMMIT;
