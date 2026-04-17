-- 183_course_completions.sql
-- Academy completion-certificate storage. One row per (user, course) when
-- every lesson in the course has `lesson_progress.completed_at IS NOT NULL`.
--
-- The row is inserted by the application (app/api/academy/courses/[id]/
-- complete) after the last-lesson completion — not by a DB trigger — so we
-- can send the congratulations email in the same request and return the
-- verification token to the client for an immediate confetti moment.
--
-- Plan 35.
--
-- Shared-DB caveat: profiles and courses are shared across apps per
-- CLAUDE.md. This table is CentOS-specific (references courses by id) and
-- additive — no other app in the ecosystem reads course_completions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.course_completions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id           UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  completed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Short, URL-safe, unguessable. Hex-encoded 16 bytes = 32 chars.
  -- Public verification URL is /academy/verify/<token>.
  verification_token  TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS course_completions_user_idx
  ON public.course_completions(user_id);
CREATE INDEX IF NOT EXISTS course_completions_course_idx
  ON public.course_completions(course_id);

ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;

-- Users read their own completions. Verification URL is handled by the
-- service-role client reading by token directly — no RLS dependency.
DROP POLICY IF EXISTS "Users read own completions" ON public.course_completions;
CREATE POLICY "Users read own completions" ON public.course_completions
  FOR SELECT USING (user_id = auth.uid());

-- Teachers read completions of their own courses (for analytics). Admins
-- read everything via service role.
DROP POLICY IF EXISTS "Teachers read completions for own courses" ON public.course_completions;
CREATE POLICY "Teachers read completions for own courses" ON public.course_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.courses
      WHERE id = course_completions.course_id
      AND teacher_id = auth.uid()
    )
  );

COMMIT;
