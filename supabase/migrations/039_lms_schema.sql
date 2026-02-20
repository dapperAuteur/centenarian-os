-- 039_lms_schema.sql
-- Centenarian Academy LMS: full schema for courses, lessons, enrollments,
-- assignments, messaging, live sessions, and CYOA adventure paths.

BEGIN;

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. Platform Settings (admin-configurable key-value store) ───────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed defaults
INSERT INTO public.platform_settings (key, value) VALUES
  ('teacher_fee_percent',       '15'),
  ('teacher_monthly_price_id',  ''),
  ('teacher_annual_price_id',   '')
ON CONFLICT (key) DO NOTHING;

-- Only service role can read/write (admin API routes use service role key)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.platform_settings USING (false);

-- ─── 2. Role column on profiles ──────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'teacher', 'admin'));

-- ─── 3. Teacher Profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  user_id                    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio                        TEXT,
  specialties                TEXT[],
  stripe_connect_account_id  TEXT,
  stripe_connect_onboarded   BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_subscription_id     TEXT,   -- teacher platform subscription
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own profile"
  ON public.teacher_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read teacher profiles"
  ON public.teacher_profiles
  FOR SELECT TO authenticated
  USING (true);

-- ─── 4. Courses ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  description      TEXT,
  cover_image_url  TEXT,
  category         TEXT,
  tags             TEXT[]      DEFAULT '{}',
  price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_type       TEXT        NOT NULL DEFAULT 'free'
                               CHECK (price_type IN ('free', 'one_time', 'subscription')),
  stripe_product_id TEXT,
  stripe_price_id  TEXT,
  is_published     BOOLEAN     NOT NULL DEFAULT FALSE,
  navigation_mode  TEXT        NOT NULL DEFAULT 'linear'
                               CHECK (navigation_mode IN ('linear', 'cyoa')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own courses"
  ON public.courses
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Anyone can read published courses"
  ON public.courses
  FOR SELECT
  USING (is_published = true);

-- ─── 5. Course Modules (chapters / sections) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_modules (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID    NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  "order"    INT     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own course modules"
  ON public.course_modules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND teacher_id = auth.uid()));

CREATE POLICY "Anyone can read modules of published courses"
  ON public.course_modules
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND is_published = true));

-- ─── 6. Lessons ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lessons (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID    NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id        UUID    REFERENCES public.course_modules(id) ON DELETE SET NULL,
  title            TEXT    NOT NULL,
  lesson_type      TEXT    NOT NULL DEFAULT 'video'
                           CHECK (lesson_type IN ('video', 'text', 'audio', 'slides')),
  content_url      TEXT,
  text_content     TEXT,
  duration_seconds INT,
  "order"          INT     NOT NULL DEFAULT 0,
  is_free_preview  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own lessons"
  ON public.lessons
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND teacher_id = auth.uid()));

-- Free previews are publicly readable; enrolled students get all lessons
CREATE POLICY "Free preview lessons are public"
  ON public.lessons
  FOR SELECT
  USING (is_free_preview = true AND EXISTS (
    SELECT 1 FROM public.courses WHERE id = course_id AND is_published = true
  ));
-- NOTE: "Enrolled students read all lessons" policy is added AFTER the enrollments table below.

-- ─── 7. Lesson Embeddings (CYOA semantic similarity) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_embeddings (
  lesson_id  UUID    PRIMARY KEY REFERENCES public.lessons(id) ON DELETE CASCADE,
  embedding  vector(768),   -- Gemini text-embedding-004 outputs 768 dims
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lesson_embeddings ENABLE ROW LEVEL SECURITY;
-- Service role only; written by server actions
CREATE POLICY "Service role only" ON public.lesson_embeddings USING (false);

-- Index for similarity search
CREATE INDEX IF NOT EXISTS lesson_embeddings_vector_idx
  ON public.lesson_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- ─── 8. Lesson Paths (CYOA edges) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_paths (
  source_lesson_id  UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  target_lesson_id  UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  path_type         TEXT NOT NULL CHECK (path_type IN ('linear', 'semantic', 'random')),
  "order"           INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (source_lesson_id, target_lesson_id)
);

ALTER TABLE public.lesson_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.lesson_paths USING (false);

-- ─── 9. Enrollments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrollments (
  id                        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id                 UUID    NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  stripe_checkout_session_id TEXT,
  status                    TEXT    NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'cancelled')),
  enrolled_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own enrollments"
  ON public.enrollments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Teachers read enrollments in own courses"
  ON public.enrollments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND teacher_id = auth.uid()));

-- Now that enrollments exists, add the deferred lesson policy
CREATE POLICY "Enrolled students read all lessons"
  ON public.lessons
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = lessons.course_id
      AND user_id = auth.uid()
      AND status = 'active'
  ));

-- ─── 10. Lesson Progress ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  watch_seconds INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lesson_id)
);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own progress"
  ON public.lesson_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 11. Assignments ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignments (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID    NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id   UUID    REFERENCES public.lessons(id) ON DELETE SET NULL,
  title       TEXT    NOT NULL,
  description TEXT,
  due_date    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own assignments"
  ON public.assignments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND teacher_id = auth.uid()));

CREATE POLICY "Enrolled students read assignments"
  ON public.assignments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = assignments.course_id
      AND user_id = auth.uid()
      AND status = 'active'
  ));

-- ─── 12. Assignment Submissions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id    UUID    NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content          TEXT,
  media_url        TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  grade            TEXT,
  teacher_feedback TEXT,
  UNIQUE (assignment_id, student_id)
);

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own submissions"
  ON public.assignment_submissions
  FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers read + grade submissions in own courses"
  ON public.assignment_submissions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.courses c ON c.id = a.course_id
    WHERE a.id = assignment_id AND c.teacher_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.courses c ON c.id = a.course_id
    WHERE a.id = assignment_id AND c.teacher_id = auth.uid()
  ));

-- ─── 13. Submission Messages (threaded chat on assignments) ──────────────────
CREATE TABLE IF NOT EXISTS public.submission_messages (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID    NOT NULL REFERENCES public.assignment_submissions(id) ON DELETE CASCADE,
  sender_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_teacher    BOOLEAN NOT NULL DEFAULT FALSE,
  body          TEXT    NOT NULL,
  media_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.submission_messages ENABLE ROW LEVEL SECURITY;

-- Student (who owns the submission) or teacher (who owns the course) can read/write
CREATE POLICY "Student or teacher can message on submission"
  ON public.submission_messages
  FOR ALL TO authenticated
  USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM public.assignment_submissions s
      WHERE s.id = submission_id AND s.student_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.assignment_submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      JOIN public.courses c ON c.id = a.course_id
      WHERE s.id = submission_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (auth.uid() = sender_id);

-- ─── 14. Course Messages (student ↔ teacher DMs) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_messages (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID    NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  sender_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body         TEXT    NOT NULL,
  media_url    TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.course_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sender or recipient can read course messages"
  ON public.course_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Authenticated users can send course messages"
  ON public.course_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipient can mark as read"
  ON public.course_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id);

-- ─── 15. Promo Codes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id        UUID    REFERENCES public.courses(id) ON DELETE CASCADE,
  stripe_coupon_id TEXT    NOT NULL,
  code             TEXT    NOT NULL UNIQUE,
  discount_percent INT     NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  max_uses         INT,
  uses_count       INT     NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own promo codes"
  ON public.promo_codes
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Anyone can read promo codes (for validation)"
  ON public.promo_codes
  FOR SELECT
  USING (true);

-- ─── 16. Live Sessions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  host_type    TEXT    NOT NULL CHECK (host_type IN ('centos_team', 'teacher')),
  teacher_id   UUID    REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id    UUID    REFERENCES public.courses(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  description  TEXT,
  scheduled_at TIMESTAMPTZ,
  embed_code   TEXT,
  is_live      BOOLEAN NOT NULL DEFAULT FALSE,
  is_public    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public live sessions are readable"
  ON public.live_sessions
  FOR SELECT
  USING (is_public = true);

CREATE POLICY "Enrolled students see course live sessions"
  ON public.live_sessions
  FOR SELECT TO authenticated
  USING (
    is_public = false AND course_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE course_id = live_sessions.course_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY "Teachers manage own live sessions"
  ON public.live_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- ─── 17. CYOA Semantic Similarity RPC ───────────────────────────────────────
-- Used by the crossroads endpoint to find lessons similar to the current one.
CREATE OR REPLACE FUNCTION public.match_lessons(
  query_embedding     vector(768),
  course_id_filter    UUID,
  exclude_lesson_id   UUID,
  match_count         INT DEFAULT 2
)
RETURNS TABLE (id UUID, title TEXT, similarity FLOAT)
LANGUAGE SQL STABLE
AS $$
  SELECT
    l.id,
    l.title,
    1 - (le.embedding <=> query_embedding) AS similarity
  FROM public.lesson_embeddings le
  JOIN public.lessons l ON l.id = le.lesson_id
  WHERE l.course_id = course_id_filter
    AND l.id <> exclude_lesson_id
  ORDER BY le.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMIT;
