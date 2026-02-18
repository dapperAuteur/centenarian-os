BEGIN;

-- Add 'blocked_visit' to the event_type check constraint
ALTER TABLE public.blog_events
  DROP CONSTRAINT IF EXISTS blog_events_event_type_check;

ALTER TABLE public.blog_events
  ADD CONSTRAINT blog_events_event_type_check CHECK (event_type IN (
    'view',
    'read_25', 'read_50', 'read_75', 'read_100',
    'share_copy', 'share_email', 'share_linkedin',
    'blocked_visit'
  ));

-- Security-definer function: returns the post UUID for a given (user_id, slug)
-- regardless of visibility. Used server-side to log analytics for restricted posts
-- that a visitor tried to access. Returns NULL if the post doesn't exist.
CREATE OR REPLACE FUNCTION public.get_post_id_by_slug(
  p_user_id UUID,
  p_slug    TEXT
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM blog_posts
  WHERE user_id = p_user_id AND slug = p_slug
  LIMIT 1;
$$;

COMMIT;
