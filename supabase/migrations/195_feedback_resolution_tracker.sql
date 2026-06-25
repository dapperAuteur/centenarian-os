-- supabase/migrations/195_feedback_resolution_tracker.sql
-- Resolution tracking for user feedback, integrated into the feedback
-- conversation. An admin marks a report resolved; the user is told inside the
-- thread and can confirm it's fixed or reopen it. Additive only (shared DB).

ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'open'
    CHECK (resolution_status IN ('open', 'resolved', 'confirmed', 'reopened')),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_feedback.resolution_status IS
  'open (default) -> resolved (admin) -> confirmed (user) | reopened (user). Drives the resolution banner + confirm/reopen flow.';

-- Resolution events live in the conversation as special replies. kind=message
-- is a normal reply; resolved/confirmed/reopened render as status events.
ALTER TABLE public.feedback_replies
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'message'
    CHECK (kind IN ('message', 'resolved', 'confirmed', 'reopened'));

COMMENT ON COLUMN public.feedback_replies.kind IS
  'message = normal reply; resolved/confirmed/reopened = a resolution status event in the thread.';
