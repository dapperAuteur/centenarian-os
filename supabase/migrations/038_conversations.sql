-- Migration 038: Two-way conversations, media attachments, admin notifications
-- Run in Supabase SQL editor or via `supabase db push`

-- ─── Feedback: media + admin-read tracking ────────────────────────────────────
ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS media_url         TEXT,
  ADD COLUMN IF NOT EXISTS is_read_by_admin  BOOLEAN DEFAULT false;

-- ─── Message reply threads (user ↔ admin) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_replies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       UUID NOT NULL REFERENCES public.admin_messages(id) ON DELETE CASCADE,
  sender_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_admin         BOOLEAN NOT NULL DEFAULT false,
  body             TEXT NOT NULL,
  media_url        TEXT,
  is_read_by_admin BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.message_replies ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own non-admin replies
CREATE POLICY "Users insert own message replies"
  ON public.message_replies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND is_admin = false);

-- Users can read replies where they are the sender
CREATE POLICY "Users read own message replies"
  ON public.message_replies FOR SELECT TO authenticated
  USING (sender_id = auth.uid());

-- ─── Feedback reply threads (user ↔ admin) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.user_feedback(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_admin    BOOLEAN NOT NULL DEFAULT false,
  body        TEXT NOT NULL,
  media_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback_replies ENABLE ROW LEVEL SECURITY;

-- Users can insert non-admin replies to their own feedback
CREATE POLICY "Users insert own feedback replies"
  ON public.feedback_replies FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND is_admin = false
    AND EXISTS (
      SELECT 1 FROM public.user_feedback uf
      WHERE uf.id = feedback_id AND uf.user_id = auth.uid()
    )
  );

-- Users can read replies on their own feedback
CREATE POLICY "Users read own feedback replies"
  ON public.feedback_replies FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_feedback uf
      WHERE uf.id = feedback_id AND uf.user_id = auth.uid()
    )
  );
