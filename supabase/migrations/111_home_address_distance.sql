-- 111_home_address_distance.sql
-- Add home address + distance unit to travel_settings for auto mileage calculation.
-- Add lat/lng to contact_locations for Haversine distance.

BEGIN;

-- ── 1. Home address on travel_settings ─────────────────────────────────
ALTER TABLE travel_settings
  ADD COLUMN IF NOT EXISTS home_address TEXT,
  ADD COLUMN IF NOT EXISTS home_lat     NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS home_lng     NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS distance_unit TEXT NOT NULL DEFAULT 'mi'
    CHECK (distance_unit IN ('mi', 'km'));

-- ── 2. Lat/lng on contact_locations (for venue geocoding) ──────────────
-- lat/lng columns may already exist from migration 064; these are safe IF NOT EXISTS
ALTER TABLE contact_locations
  ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);

-- ── 3. Distance fields on contractor_jobs ──────────────────────────────
-- distance_from_home_miles already exists from 105; add km equivalent
ALTER TABLE contractor_jobs
  ADD COLUMN IF NOT EXISTS distance_from_home_km NUMERIC(8,2);

COMMIT;
