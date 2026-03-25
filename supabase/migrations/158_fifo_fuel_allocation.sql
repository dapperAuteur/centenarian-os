-- Migration 158: FIFO fuel cost allocation for trips
-- Tracks which fuel purchases are consumed by which trips using first-in-first-out logic.

-- 1. New column on fuel_logs to track remaining gallons available for FIFO
ALTER TABLE fuel_logs ADD COLUMN IF NOT EXISTS gallons_remaining NUMERIC(8,3);

-- 2. New columns on trips for FIFO cost tracking
ALTER TABLE trips ADD COLUMN IF NOT EXISTS fifo_cost NUMERIC(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cost_source TEXT NOT NULL DEFAULT 'manual';

-- Add CHECK constraint for cost_source (use DO block for IF NOT EXISTS pattern)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trips_cost_source_check'
  ) THEN
    ALTER TABLE trips ADD CONSTRAINT trips_cost_source_check
      CHECK (cost_source IN ('manual', 'fifo', 'override'));
  END IF;
END $$;

-- 3. New column on travel_settings for FIFO cutoff date
ALTER TABLE travel_settings ADD COLUMN IF NOT EXISTS fifo_enabled_at TIMESTAMPTZ;

-- 4. fuel_allocations junction table — audit trail linking fuel purchases to trips
CREATE TABLE IF NOT EXISTS fuel_allocations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  trip_id        UUID NOT NULL REFERENCES trips ON DELETE CASCADE,
  fuel_log_id    UUID NOT NULL REFERENCES fuel_logs ON DELETE CASCADE,
  gallons_used   NUMERIC(8,3) NOT NULL,
  cost_allocated NUMERIC(10,2) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fuel_allocations_trip ON fuel_allocations(trip_id);
CREATE INDEX IF NOT EXISTS idx_fuel_allocations_fuel_log ON fuel_allocations(fuel_log_id);
CREATE INDEX IF NOT EXISTS idx_fuel_allocations_user ON fuel_allocations(user_id);

-- 5. RLS for fuel_allocations
ALTER TABLE fuel_allocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'fuel_allocations_user_policy' AND tablename = 'fuel_allocations'
  ) THEN
    CREATE POLICY fuel_allocations_user_policy ON fuel_allocations
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
