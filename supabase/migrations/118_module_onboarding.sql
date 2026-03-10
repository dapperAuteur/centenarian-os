-- 118_module_onboarding.sql
-- Module walkthrough onboarding: tour tracking, tour events analytics

-- Track which modules a user has "explored" (completed or skipped the tour)
CREATE TABLE IF NOT EXISTS public.module_tours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_slug TEXT NOT NULL,
  app TEXT NOT NULL DEFAULT 'main' CHECK (app IN ('main', 'contractor', 'lister')),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'in_progress', 'completed', 'skipped')),
  current_step INT DEFAULT 0,
  total_steps INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, app, module_slug)
);

ALTER TABLE module_tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tours"
  ON module_tours FOR ALL USING (auth.uid() = user_id);

-- Track if user has seen the initial "pick your first module" prompt
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_module_slug TEXT;

-- Tour analytics (admin-facing, uses public_alias for privacy)
CREATE TABLE IF NOT EXISTS public.tour_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  public_alias TEXT,
  app TEXT NOT NULL DEFAULT 'main',
  module_slug TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'tour_started', 'tour_completed', 'tour_skipped', 'tour_exited',
    'step_completed', 'step_skipped',
    'demo_login', 'demo_feature_view',
    'feature_page_view', 'cta_signup_click', 'cta_demo_click',
    'tour_restarted'
  )),
  step_index INT,
  step_title TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tour_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own tour events"
  ON tour_events FOR INSERT WITH CHECK (
    user_id IS NULL OR auth.uid() = user_id
  );

CREATE POLICY "Admin reads all tour events"
  ON tour_events FOR SELECT USING (
    auth.jwt() ->> 'email' = current_setting('app.admin_email', true)
  );

CREATE INDEX idx_tour_events_module ON tour_events(app, module_slug);
CREATE INDEX idx_tour_events_type ON tour_events(event_type);
CREATE INDEX idx_tour_events_created ON tour_events(created_at DESC);
CREATE INDEX idx_module_tours_user ON module_tours(user_id);
