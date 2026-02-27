-- Migration: 067_vehicle_trip_mode.sql
-- Allow users to assign a specific trip mode to each vehicle.
-- e.g., shoes can be 'run' or 'walk', ebike can be 'bike', etc.

ALTER TABLE public.vehicles
  ADD COLUMN trip_mode TEXT CHECK (trip_mode IN (
    'bike','car','bus','train','plane','walk','run',
    'ferry','rideshare','other'
  ));

-- Also add 'shoes' to the vehicle type CHECK constraint if not already present.
-- Drop and re-add the constraint to include 'shoes'.
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_type_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_type_check
  CHECK (type IN ('car','bike','ebike','motorcycle','scooter','shoes'));
