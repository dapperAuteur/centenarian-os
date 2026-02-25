-- Migration: 053_travel_enhancements
-- Adds vehicle ownership type (owned/rental/borrowed), trip tax category,
-- and trip category (travel vs fitness) to support cleaner analytics.

-- 1. Vehicle ownership type
--    Tracks whether a vehicle is personally owned, a rental, or borrowed.
--    Rental/borrowed vehicles are excluded from the bike-savings carCostPerMile calculation.
ALTER TABLE vehicles
  ADD COLUMN ownership_type TEXT NOT NULL DEFAULT 'owned'
  CHECK (ownership_type IN ('owned', 'rental', 'borrowed'));

-- 2. Trip tax category
--    Allows users to tag trips for business mileage logs or medical/charitable deductions.
ALTER TABLE trips
  ADD COLUMN tax_category TEXT DEFAULT 'personal'
  CHECK (tax_category IN ('personal', 'business', 'medical', 'charitable'));

-- 3. Trip category — travel vs fitness
--    Determines whether a human-powered trip counts toward commute savings.
--    Car/bus/train/plane trips are always 'travel'; bike/walk/run entries let users choose.
ALTER TABLE trips
  ADD COLUMN trip_category TEXT NOT NULL DEFAULT 'travel'
  CHECK (trip_category IN ('travel', 'fitness'));

-- Back-fill: existing Garmin imports are fitness activities by default.
-- Users can manually flip any that are actually commutes.
UPDATE trips
SET trip_category = 'fitness'
WHERE source = 'garmin_import';

-- Indexes for common filter queries
CREATE INDEX IF NOT EXISTS trips_tax_category_idx ON trips (user_id, tax_category);
CREATE INDEX IF NOT EXISTS trips_trip_category_idx ON trips (user_id, trip_category);
