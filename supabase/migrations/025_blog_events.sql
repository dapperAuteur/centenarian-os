-- 025_blog_events.sql
-- Analytics event log for blog posts: views, read depth, and share events

BEGIN;

CREATE TABLE IF NOT EXISTS public.blog_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID        NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL
                CHECK (event_type IN (
                  'view',
                  'read_25', 'read_50', 'read_75', 'read_100',
                  'share_copy', 'share_email', 'share_linkedin'
                )),
  session_id  TEXT,          -- random UUID generated client-side per browser tab session
  referrer    TEXT,          -- document.referrer passed from client
  country     TEXT,          -- from CF-IPCountry or x-vercel-ip-country request header
  user_id     UUID,          -- nullable: set if reader is logged in
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_events_post_type ON public.blog_events(post_id, event_type);
CREATE INDEX IF NOT EXISTS idx_blog_events_created   ON public.blog_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_events_post_time ON public.blog_events(post_id, created_at DESC);

ALTER TABLE public.blog_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (public API route, no auth required)
CREATE POLICY "Anyone can insert events"
  ON public.blog_events FOR INSERT WITH CHECK (true);

-- Only post authors can read analytics for their own posts
CREATE POLICY "Authors can read their post events"
  ON public.blog_events FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    post_id IN (SELECT id FROM public.blog_posts WHERE user_id = auth.uid())
  );

-- Security-definer function to insert events and bump view_count atomically.
-- Using SECURITY DEFINER avoids the recursive RLS check (blog_events INSERT policy
-- would otherwise need to verify post_id exists via a SELECT on blog_posts).
CREATE OR REPLACE FUNCTION public.log_blog_event(
  p_post_id     UUID,
  p_event_type  TEXT,
  p_session_id  TEXT DEFAULT NULL,
  p_referrer    TEXT DEFAULT NULL,
  p_country     TEXT DEFAULT NULL,
  p_user_id     UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO blog_events(post_id, event_type, session_id, referrer, country, user_id)
  VALUES (p_post_id, p_event_type, p_session_id, p_referrer, p_country, p_user_id);

  -- Atomically bump the denormalized view_count on the post for fast reads
  IF p_event_type = 'view' THEN
    UPDATE blog_posts SET view_count = view_count + 1 WHERE id = p_post_id;
  END IF;
END;
$$;

COMMIT;
