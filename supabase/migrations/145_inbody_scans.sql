-- 145_inbody_scans.sql
-- Full InBody scan storage: all 43 device columns with typed fields.
-- Core fields (weight, body_fat_pct, skeletal_muscle_mass, bmi) are synced to
-- user_health_metrics (source='inbody') on import so existing dashboards work.

BEGIN;

CREATE TABLE IF NOT EXISTS public.inbody_scans (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at      TIMESTAMPTZ NOT NULL,    -- full timestamp from InBody (YYYYMMDDHHmmss)
  logged_date      DATE        NOT NULL,    -- derived from measured_at on insert
  device_model     TEXT,                    -- e.g. 'H20N', 'H20'

  -- ── Core summary (mirrored in user_health_metrics) ──────────────────────────
  weight_lbs               NUMERIC(6,2),
  skeletal_muscle_mass_lbs NUMERIC(6,2),
  soft_lean_mass_lbs       NUMERIC(6,2),
  body_fat_mass_lbs        NUMERIC(6,2),
  bmi                      NUMERIC(5,2),
  body_fat_pct             NUMERIC(5,2),
  bmr_kj                   NUMERIC(8,2),
  inbody_score             INT,

  -- ── Segmental lean mass ──────────────────────────────────────────────────────
  lean_right_arm_lbs  NUMERIC(5,2),
  lean_left_arm_lbs   NUMERIC(5,2),
  lean_trunk_lbs      NUMERIC(6,2),
  lean_right_leg_lbs  NUMERIC(6,2),
  lean_left_leg_lbs   NUMERIC(6,2),

  -- ── Segmental fat mass ───────────────────────────────────────────────────────
  fat_right_arm_lbs   NUMERIC(5,2),
  fat_left_arm_lbs    NUMERIC(5,2),
  fat_trunk_lbs       NUMERIC(6,2),
  fat_right_leg_lbs   NUMERIC(5,2),
  fat_left_leg_lbs    NUMERIC(5,2),

  -- ── ECW ratios (segmental hydration balance) ─────────────────────────────────
  ecw_right_arm   NUMERIC(5,3),
  ecw_left_arm    NUMERIC(5,3),
  ecw_trunk       NUMERIC(5,3),
  ecw_right_leg   NUMERIC(5,3),
  ecw_left_leg    NUMERIC(5,3),

  -- ── Body measurements ────────────────────────────────────────────────────────
  waist_hip_ratio        NUMERIC(5,3),
  waist_circumference_in NUMERIC(5,2),
  visceral_fat_area_cm2  NUMERIC(7,2),
  visceral_fat_level     INT,

  -- ── Body water compartments ──────────────────────────────────────────────────
  total_body_water_l    NUMERIC(6,2),
  intracellular_water_l NUMERIC(6,2),
  extracellular_water_l NUMERIC(6,2),
  ecw_ratio             NUMERIC(5,3),

  -- ── Balance & muscle quality ─────────────────────────────────────────────────
  upper_lower_ratio    NUMERIC(5,2),
  upper_segment_score  NUMERIC(5,2),
  lower_segment_score  NUMERIC(5,2),
  leg_muscle_level     INT,
  leg_lean_mass_lbs    NUMERIC(6,2),

  -- ── Body composition breakdown ───────────────────────────────────────────────
  protein_lbs              NUMERIC(6,2),
  mineral_lbs              NUMERIC(5,2),
  bone_mineral_content_lbs NUMERIC(5,2),
  body_cell_mass_lbs       NUMERIC(6,2),
  skeletal_muscle_index    NUMERIC(5,2),  -- SMI (kg/m²)
  phase_angle_deg          NUMERIC(4,2),  -- whole body phase angle (°)

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Multiple scans per day are stored; measured_at is the unique key
  UNIQUE (user_id, measured_at)
);

ALTER TABLE public.inbody_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own inbody scans"
  ON public.inbody_scans FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Date-range queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_inbody_scans_user_date
  ON public.inbody_scans (user_id, logged_date DESC);

-- Source-based queries from correlations engine
CREATE INDEX IF NOT EXISTS idx_inbody_scans_user_measured
  ON public.inbody_scans (user_id, measured_at DESC);

COMMIT;
