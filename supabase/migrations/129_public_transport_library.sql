-- Migration: 129_public_transport_library.sql
-- Add system-level public transport vehicles available to all users

-- Make user_id nullable (system vehicles have no owner)
ALTER TABLE public.vehicles
  ALTER COLUMN user_id DROP NOT NULL;

-- Add is_system flag
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- Expand type CHECK to include public transport types
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_type_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_type_check
  CHECK (type IN ('car','bike','ebike','motorcycle','scooter','shoes','plane','train','bus','ferry','rideshare','other'));

-- Index for quick system vehicle lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_system ON public.vehicles(is_system) WHERE is_system = true;

-- Allow all authenticated users to read system vehicles
CREATE POLICY "vehicles_system_read" ON public.vehicles FOR SELECT
  USING (is_system = true);

-- Seed system vehicles for public/commercial transport
INSERT INTO public.vehicles (id, user_id, type, nickname, make, model, trip_mode, is_system, active, ownership_type)
VALUES
  (gen_random_uuid(), NULL, 'plane', 'Commercial Flight', 'Airline', NULL, 'plane', true, true, 'rental'),
  (gen_random_uuid(), NULL, 'train', 'Passenger Train', 'Rail', NULL, 'train', true, true, 'rental'),
  (gen_random_uuid(), NULL, 'bus', 'City Bus', 'Transit', NULL, 'bus', true, true, 'rental'),
  (gen_random_uuid(), NULL, 'ferry', 'Ferry', 'Maritime', NULL, 'ferry', true, true, 'rental'),
  (gen_random_uuid(), NULL, 'rideshare', 'Rideshare (Uber/Lyft)', 'Rideshare', NULL, 'rideshare', true, true, 'rental'),
  (gen_random_uuid(), NULL, 'rideshare', 'Taxi / Cab', 'Taxi', NULL, 'rideshare', true, true, 'rental'),
  (gen_random_uuid(), NULL, 'train', 'Subway / Metro', 'Transit', NULL, 'train', true, true, 'rental'),
  (gen_random_uuid(), NULL, 'bus', 'Intercity Bus', 'Coach', NULL, 'bus', true, true, 'rental'),
  (gen_random_uuid(), NULL, 'train', 'Light Rail / Tram', 'Transit', NULL, 'train', true, true, 'rental')
ON CONFLICT DO NOTHING;
