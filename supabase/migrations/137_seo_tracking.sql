-- Migration 137: SEO & social media tracking tables
-- og_image_requests: each row = one time a social crawler rendered a profile's OG image (proxy for social shares)
-- social_referrals: each row = one visit that arrived from a social platform

CREATE TABLE IF NOT EXISTS public.og_image_requests (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_og_image_requests_username   ON public.og_image_requests (profile_username);
CREATE INDEX IF NOT EXISTS idx_og_image_requests_created_at ON public.og_image_requests (created_at);

COMMENT ON TABLE  public.og_image_requests                 IS 'Logs each render of a profile OG image — used as a proxy for social shares/link previews.';
COMMENT ON COLUMN public.og_image_requests.profile_username IS 'Username of the profile whose OG image was rendered.';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.social_referrals (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source     TEXT NOT NULL,   -- 'twitter', 'linkedin', 'facebook', 'instagram', 'other'
  path       TEXT NOT NULL,   -- e.g. '/profiles/johndoe', '/blog/username/slug'
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_social_referrals_source     ON public.social_referrals (source);
CREATE INDEX IF NOT EXISTS idx_social_referrals_created_at ON public.social_referrals (created_at);

COMMENT ON TABLE  public.social_referrals        IS 'Logs visits that arrived via a social media referrer.';
COMMENT ON COLUMN public.social_referrals.source IS 'Social platform: twitter, linkedin, facebook, instagram, or other.';
COMMENT ON COLUMN public.social_referrals.path   IS 'The public page path the visitor landed on.';
