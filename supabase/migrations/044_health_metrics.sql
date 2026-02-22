-- 044_health_metrics.sql
-- Health metrics system:
--   • user_health_metrics  — daily log (one row per user per day)
--   • metric_config        — admin-controlled global toggle + lock per metric
--   • user_metric_permissions — per-user unlock overrides (acknowledgment flow)
--   • enrollments update   — add attempt_number + metric_slots; replace UNIQUE

BEGIN;

-- ─── 1. Daily health metric logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_health_metrics (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date     DATE        NOT NULL,

  -- Core metrics (available from attempt 1, slot-gated in course context)
  resting_hr      INT,                   -- beats per minute
  steps           INT,
  sleep_hours     NUMERIC(4,2),          -- e.g. 7.50
  activity_min    INT,                   -- active minutes

  -- Optional enrichment metrics (unlockable; never body weight)
  sleep_score     INT,                   -- 0–100 from device
  hrv_ms          INT,                   -- heart rate variability, ms
  spo2_pct        NUMERIC(5,2),          -- blood oxygen %
  active_calories INT,
  stress_score    INT,                   -- 0–100
  recovery_score  INT,                   -- 0–100

  -- Body weight — locked by default, requires explicit acknowledgment
  weight_lbs      NUMERIC(6,2),

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, logged_date)
);

ALTER TABLE public.user_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own metrics"
  ON public.user_health_metrics
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 2. Global metric configuration (admin-controlled) ───────────────────────
CREATE TABLE IF NOT EXISTS public.metric_config (
  metric_key          TEXT    PRIMARY KEY,
  label               TEXT    NOT NULL,
  description         TEXT,
  is_globally_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
  -- 'acknowledgment' = user self-unlocks after reading disclaimer
  -- 'admin_only'     = only admin can grant access
  unlock_type         TEXT    NOT NULL DEFAULT 'acknowledgment'
                              CHECK (unlock_type IN ('acknowledgment', 'admin_only')),
  sort_order          INT     NOT NULL DEFAULT 0
);

ALTER TABLE public.metric_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read metric config (to know which are available)
CREATE POLICY "Authenticated users can read metric config"
  ON public.metric_config
  FOR SELECT TO authenticated
  USING (true);

-- Only service role (admin API routes) can write
CREATE POLICY "Service role only writes metric config"
  ON public.metric_config
  FOR ALL USING (false);

-- Seed metric configuration
INSERT INTO public.metric_config
  (metric_key, label, description, is_locked, unlock_type, sort_order)
VALUES
  ('resting_hr',      'Resting Heart Rate',     'Beats per minute at rest',                               FALSE, 'acknowledgment', 1),
  ('steps',           'Daily Steps',            'Steps logged by your device for the day',                FALSE, 'acknowledgment', 2),
  ('sleep_hours',     'Sleep Hours',            'Total hours of sleep recorded',                          FALSE, 'acknowledgment', 3),
  ('activity_min',    'Active Minutes',         'Minutes of elevated activity',                           FALSE, 'acknowledgment', 4),
  ('sleep_score',     'Sleep Score',            'Sleep quality score from your device (0–100)',           FALSE, 'acknowledgment', 5),
  ('hrv_ms',          'Heart Rate Variability', 'HRV in milliseconds — higher is generally better',      FALSE, 'acknowledgment', 6),
  ('spo2_pct',        'Blood Oxygen (SpO₂)',    'Blood oxygen saturation percentage',                    FALSE, 'acknowledgment', 7),
  ('active_calories', 'Active Calories',        'Calories burned through activity (not BMR)',             FALSE, 'acknowledgment', 8),
  ('stress_score',    'Stress Score',           'Stress index from your device (0–100)',                  FALSE, 'acknowledgment', 9),
  ('recovery_score',  'Recovery Score',         'Readiness or recovery score from your device (0–100)',   FALSE, 'acknowledgment', 10),
  ('weight_lbs',      'Body Weight',            'Your body weight in pounds. Locked by default — requires acknowledgment before tracking.', TRUE, 'acknowledgment', 11)
ON CONFLICT (metric_key) DO NOTHING;

-- ─── 3. Per-user metric permission overrides ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_metric_permissions (
  user_id                  UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_key               TEXT    NOT NULL REFERENCES public.metric_config(metric_key) ON DELETE CASCADE,
  is_enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  acknowledged_disclaimer  BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_by              UUID    REFERENCES auth.users(id),  -- NULL = self-acknowledged
  unlocked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, metric_key)
);

ALTER TABLE public.user_metric_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own permissions"
  ON public.user_metric_permissions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (admin) can read all to support per-user testing
CREATE POLICY "Service role reads all permissions"
  ON public.user_metric_permissions
  FOR SELECT USING (false);

-- ─── 4. Enrollments — add attempt_number + metric_slots ──────────────────────
-- Drop the existing simple unique so students can re-enroll for attempt 2+
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_user_id_course_id_key;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS attempt_number    INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metric_slots      INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS slots_override_by UUID REFERENCES auth.users(id);

-- New unique: one enrollment row per student + course + attempt
ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_user_course_attempt_key
  UNIQUE (user_id, course_id, attempt_number);

COMMIT;
