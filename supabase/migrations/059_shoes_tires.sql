-- 059_shoes_tires.sql
-- 1. Add 'shoes' to vehicle types for tracking shoe mileage/replacement
-- 2. Add tire/component mileage tracking to vehicle_maintenance

-- ── Add shoes as vehicle type ───────────────────────────────────────────────
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_type_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_type_check
  CHECK (type IN ('car', 'bike', 'ebike', 'motorcycle', 'scooter', 'shoes'));

-- ── Tire / component mileage tracking ───────────────────────────────────────
-- Tracks replaceable components (tires, shoes, chains, brake pads) with mileage
CREATE TABLE component_wear (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  -- what is being tracked
  component_type TEXT NOT NULL CHECK (component_type IN (
    'front_tire', 'rear_tire', 'all_tires', 'chain', 'brake_pads', 'shoes', 'other'
  )),
  brand TEXT,
  model TEXT,
  -- mileage tracking
  installed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  installed_miles NUMERIC(10,1) NOT NULL DEFAULT 0,
  expected_life_miles NUMERIC(10,1),
  retired_date DATE,
  retired_miles NUMERIC(10,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON component_wear (user_id, vehicle_id);
CREATE INDEX ON component_wear (user_id, retired_date) WHERE retired_date IS NULL;

-- RLS
ALTER TABLE component_wear ENABLE ROW LEVEL SECURITY;
CREATE POLICY component_wear_owner ON component_wear
  FOR ALL USING (user_id = auth.uid());
