-- 080_health_metrics_source.sql
-- Add source tracking to user_health_metrics for multi-device comparison

BEGIN;

-- 1. Add source column (existing rows become 'manual')
ALTER TABLE public.user_health_metrics
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- 2. Drop old unique constraint, add new one including source
ALTER TABLE public.user_health_metrics
  DROP CONSTRAINT IF EXISTS user_health_metrics_user_id_logged_date_key;

ALTER TABLE public.user_health_metrics
  ADD CONSTRAINT user_health_metrics_user_id_date_source_key
  UNIQUE (user_id, logged_date, source);

-- 3. Valid source values
ALTER TABLE public.user_health_metrics
  ADD CONSTRAINT health_metrics_source_check
  CHECK (source IN ('manual', 'garmin', 'apple_health', 'oura', 'whoop', 'google_health', 'inbody', 'hume_health', 'csv'));

-- 4. Index for trends queries (date range scans)
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_date_range
  ON public.user_health_metrics (user_id, logged_date DESC);

-- 5. Index for source-filtered queries
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_source
  ON public.user_health_metrics (user_id, source);

COMMIT;
