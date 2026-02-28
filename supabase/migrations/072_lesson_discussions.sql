-- 072_lesson_discussions.sql
-- Threaded discussion system for lessons.
-- Supports top-level posts and replies (one level of nesting via parent_id).
-- Teacher posts flagged with is_teacher; pinning supported.

BEGIN;

CREATE TABLE IF NOT EXISTS public.lesson_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.lesson_discussions(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_teacher BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_discussions_lesson_parent
  ON public.lesson_discussions (lesson_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_lesson_discussions_user
  ON public.lesson_discussions (user_id);

-- RLS
ALTER TABLE public.lesson_discussions ENABLE ROW LEVEL SECURITY;

-- Read: anyone authenticated can read discussions
CREATE POLICY lesson_discussions_select ON public.lesson_discussions
  FOR SELECT TO authenticated USING (true);

-- Insert: authenticated users can create posts
CREATE POLICY lesson_discussions_insert ON public.lesson_discussions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Update: users can edit own posts
CREATE POLICY lesson_discussions_update ON public.lesson_discussions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Delete: users can delete own posts
CREATE POLICY lesson_discussions_delete ON public.lesson_discussions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMIT;
