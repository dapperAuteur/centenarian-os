-- 086_page_views.sql
-- Anonymous page view tracking for traffic analytics.
-- No user_id stored — only user_type classification.

CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  user_type TEXT DEFAULT 'anonymous',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_page_views_path ON public.page_views (path);
CREATE INDEX idx_page_views_created ON public.page_views (created_at);
CREATE INDEX idx_page_views_user_type ON public.page_views (user_type);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
