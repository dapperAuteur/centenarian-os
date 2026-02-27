-- 061_gem_ai_mode.sql
-- Extend gem_personas for data-aware AI mode; add action audit log

BEGIN;

-- 1. Add data_sources, category, is_starter, can_take_actions to gem_personas
ALTER TABLE public.gem_personas
  ADD COLUMN IF NOT EXISTS data_sources TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'
    CHECK (category IN ('coaching', 'language', 'business', 'creative', 'meta', 'general')),
  ADD COLUMN IF NOT EXISTS is_starter BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_take_actions BOOLEAN DEFAULT false;

-- 2. Action audit log — tracks every action a gem takes
CREATE TABLE IF NOT EXISTS public.gem_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.language_coach_sessions(id) ON DELETE SET NULL,
  gem_persona_id UUID REFERENCES public.gem_personas(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}',
  result_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (result_status IN ('pending', 'success', 'error')),
  result_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON public.gem_action_log (user_id, created_at DESC);

ALTER TABLE public.gem_action_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY gem_action_log_owner ON public.gem_action_log
  FOR ALL USING (user_id = auth.uid());

COMMIT;
