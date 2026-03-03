-- 086_equipment_catalog.sql
-- Shared equipment catalog (admin-seeded, readable by all authenticated users)
-- + ownership_type + catalog_id on personal equipment table

BEGIN;

-- ── 1. Equipment Catalog (system table, no user_id) ───────────────────
CREATE TABLE equipment_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  brand       TEXT,
  model       TEXT,
  category    TEXT,        -- display-only: 'Cardio', 'Free Weights', 'Cables', etc.
  description TEXT,
  image_url   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_catalog_category ON equipment_catalog (category);
CREATE INDEX idx_equipment_catalog_active   ON equipment_catalog (is_active);

-- All authenticated users can SELECT; writes go through service role only
ALTER TABLE equipment_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipment_catalog_select ON equipment_catalog
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── 2. Seed catalog with common exercise equipment ─────────────────────
INSERT INTO equipment_catalog (name, brand, model, category, description) VALUES
  -- Cardio
  ('Treadmill',           NULL,    NULL, 'Cardio',       'Motorized treadmill for walking or running'),
  ('Stationary Bike',     NULL,    NULL, 'Cardio',       'Upright or recumbent stationary cycle'),
  ('Rowing Machine',      NULL,    NULL, 'Cardio',       'Indoor rowing ergometer'),
  ('Elliptical',          NULL,    NULL, 'Cardio',       'Low-impact elliptical cross-trainer'),
  ('Stair Climber',       NULL,    NULL, 'Cardio',       'Step machine / stair stepper'),
  ('Echo Bike',           'Rogue', 'Echo Bike V3', 'Cardio', 'Fan bike for high-intensity intervals'),
  ('Assault Bike',        'AssaultFitness', NULL, 'Cardio', 'Air resistance fan bike'),
  ('SkiErg',              'Concept2', NULL, 'Cardio',    'Vertical ski pull ergometer'),
  ('Jump Rope',           NULL,    NULL, 'Cardio',       'Speed or weighted jump rope'),
  ('Concept2 Rower',      'Concept2', 'Model D', 'Cardio', 'Classic air-resistance rowing machine'),
  -- Free Weights
  ('Barbell',             NULL,    NULL, 'Free Weights', 'Standard Olympic barbell (45 lb / 20 kg)'),
  ('Dumbbells',           NULL,    NULL, 'Free Weights', 'Fixed or adjustable dumbbells'),
  ('Kettlebell',          NULL,    NULL, 'Free Weights', 'Cast iron or competition kettlebell'),
  ('EZ Curl Bar',         NULL,    NULL, 'Free Weights', 'Cambered bar for curls and tricep extensions'),
  ('Hex / Trap Bar',      NULL,    NULL, 'Free Weights', 'Hexagonal bar for deadlifts and carries'),
  ('Weight Plates',       NULL,    NULL, 'Free Weights', 'Olympic or standard weight plates'),
  ('Safety Squat Bar',    NULL,    NULL, 'Free Weights', 'Cambered bar with shoulder yoke for squats'),
  -- Cable Machines
  ('Cable Crossover',     NULL,    NULL, 'Cables',       'Dual adjustable pulley cable tower'),
  ('Lat Pulldown',        NULL,    NULL, 'Cables',       'High-pulley lat pulldown / cable row station'),
  ('Seated Cable Row',    NULL,    NULL, 'Cables',       'Low-pulley seated row machine'),
  ('Cable Tricep Station',NULL,    NULL, 'Cables',       'Single cable stack for tricep pushdowns'),
  -- Machines
  ('Leg Press',           NULL,    NULL, 'Machines',     '45-degree plate-loaded or selectorized leg press'),
  ('Leg Curl',            NULL,    NULL, 'Machines',     'Seated or prone hamstring curl machine'),
  ('Leg Extension',       NULL,    NULL, 'Machines',     'Seated quadriceps extension machine'),
  ('Chest Press Machine', NULL,    NULL, 'Machines',     'Selectorized or plate-loaded chest press'),
  ('Shoulder Press Machine',NULL,  NULL, 'Machines',     'Overhead pressing machine'),
  ('Smith Machine',       NULL,    NULL, 'Machines',     'Guided barbell on vertical rails'),
  ('Hack Squat',          NULL,    NULL, 'Machines',     'Plate-loaded hack squat / v-squat machine'),
  -- Racks
  ('Power Rack',          NULL,    NULL, 'Racks',        'Full cage with safety spotter arms'),
  ('Squat Rack',          NULL,    NULL, 'Racks',        'Half rack or squat stands'),
  ('Pull-Up Bar',         NULL,    NULL, 'Racks',        'Doorframe, wall-mounted, or free-standing'),
  -- Benches
  ('Flat Bench',          NULL,    NULL, 'Benches',      'Flat utility bench for pressing and rows'),
  ('Adjustable Bench',    NULL,    NULL, 'Benches',      'FID bench (flat/incline/decline)'),
  ('Preacher Curl Bench', NULL,    NULL, 'Benches',      'Angled bench for isolation curls'),
  -- Bodyweight / Functional
  ('TRX / Suspension Trainer', 'TRX', NULL, 'Functional', 'Suspension trainer for bodyweight exercises'),
  ('Resistance Bands',    NULL,    NULL, 'Functional',   'Loop or long bands in various resistance levels'),
  ('Plyo Box',            NULL,    NULL, 'Functional',   'Wooden or foam box for jumps and step-ups'),
  ('Medicine Ball',       NULL,    NULL, 'Functional',   'Weighted ball for throws, slams, and core work'),
  ('Battle Ropes',        NULL,    NULL, 'Functional',   'Heavy ropes for conditioning and upper body work'),
  ('Parallettes',         NULL,    NULL, 'Functional',   'Low parallel bars for dips, L-sits, and push-ups'),
  -- Recovery
  ('Foam Roller',         NULL,    NULL, 'Recovery',     'Self-myofascial release foam roller'),
  ('Massage Gun',         NULL,    NULL, 'Recovery',     'Percussive therapy device'),
  ('Yoga Mat',            NULL,    NULL, 'Recovery',     'Non-slip mat for stretching and yoga');

-- ── 3. Extend equipment table ──────────────────────────────────────────
ALTER TABLE equipment
  ADD COLUMN catalog_id     UUID REFERENCES equipment_catalog(id) ON DELETE SET NULL,
  ADD COLUMN ownership_type TEXT NOT NULL DEFAULT 'own'
    CHECK (ownership_type IN ('own', 'access'));

CREATE INDEX idx_equipment_catalog_id      ON equipment (catalog_id);
CREATE INDEX idx_equipment_ownership_type  ON equipment (user_id, ownership_type);

COMMIT;
