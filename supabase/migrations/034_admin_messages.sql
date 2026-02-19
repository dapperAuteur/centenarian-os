-- 034_admin_messages.sql
-- Admin-to-user messaging system with read tracking

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          TEXT        NOT NULL,
  body             TEXT        NOT NULL,
  -- 'all' | 'free' | 'monthly' | 'lifetime' | 'user'
  recipient_scope  TEXT        NOT NULL
    CHECK (recipient_scope IN ('all', 'free', 'monthly', 'lifetime', 'user')),
  -- Populated only when recipient_scope = 'user'
  recipient_user_id UUID       REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.message_reads (
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID        NOT NULL REFERENCES public.admin_messages(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, message_id)
);

-- Index for fast user inbox queries
CREATE INDEX IF NOT EXISTS idx_admin_messages_scope
  ON public.admin_messages(recipient_scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_messages_recipient_user
  ON public.admin_messages(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user
  ON public.message_reads(user_id);

-- RLS
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads  ENABLE ROW LEVEL SECURITY;

-- Users can read messages addressed to them (scope matches their status, or directly targeted)
CREATE POLICY "Users can read their messages"
  ON public.admin_messages FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      recipient_scope = 'all'
      OR recipient_scope = (
        SELECT subscription_status FROM public.profiles WHERE id = auth.uid()
      )
      OR (recipient_scope = 'user' AND recipient_user_id = auth.uid())
    )
  );

-- Users can manage their own read receipts
CREATE POLICY "Users manage their own reads"
  ON public.message_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
