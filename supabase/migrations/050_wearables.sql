-- 050_wearables.sql
-- Wearable connections table + body composition columns

-- Wearable provider connections (OAuth tokens, sync state)
CREATE TABLE IF NOT EXISTS public.wearable_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,  -- 'oura', 'whoop', 'garmin', 'apple_health', 'google_health', 'inbody', 'hume_health'
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  provider_user_id TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle',  -- 'idle', 'syncing', 'error'
  sync_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their wearable connections"
  ON public.wearable_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_wearable_connections_user ON public.wearable_connections(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_wearable_connections_updated_at
  BEFORE UPDATE ON public.wearable_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Body composition columns on user_health_metrics
ALTER TABLE public.user_health_metrics
  ADD COLUMN IF NOT EXISTS body_fat_pct    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS muscle_mass_lbs NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS bmi             NUMERIC(5,2);

-- Add new body comp metrics to metric_config
INSERT INTO public.metric_config (metric_key, label, description, is_globally_enabled, is_locked, unlock_type, sort_order)
VALUES
  ('body_fat_pct', 'Body Fat %', 'Body fat percentage from a scale or DEXA scan', true, true, 'acknowledgment', 12),
  ('muscle_mass_lbs', 'Muscle Mass', 'Skeletal muscle mass in pounds', true, true, 'acknowledgment', 13),
  ('bmi', 'BMI', 'Body Mass Index (auto-calculated or manual)', true, true, 'acknowledgment', 14)
ON CONFLICT (metric_key) DO NOTHING;
