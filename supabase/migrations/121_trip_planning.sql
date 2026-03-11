-- Migration: 121_trip_planning.sql
-- Add trip_status to support planning future trips

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_status TEXT NOT NULL DEFAULT 'completed'
    CHECK (trip_status IN ('planned', 'in_progress', 'completed', 'cancelled'));

-- Add optional end_date for multi-day planned trips (e.g., vacations)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add packing_notes for trip planning
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS packing_notes TEXT;

-- Index for efficiently querying planned trips by date range
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(user_id, trip_status)
  WHERE trip_status IN ('planned', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_trips_planned_date ON public.trips(user_id, date, end_date)
  WHERE trip_status = 'planned';

-- Add trip_status to multi-stop routes too
ALTER TABLE public.trip_routes
  ADD COLUMN IF NOT EXISTS trip_status TEXT NOT NULL DEFAULT 'completed'
    CHECK (trip_status IN ('planned', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE public.trip_routes
  ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE public.trip_routes
  ADD COLUMN IF NOT EXISTS packing_notes TEXT;

-- Backfill: mark all existing trips as completed (they were logged, not planned)
-- This is a no-op since default is 'completed', but explicit for clarity
UPDATE public.trips SET trip_status = 'completed' WHERE trip_status IS NULL;
UPDATE public.trip_routes SET trip_status = 'completed' WHERE trip_status IS NULL;
