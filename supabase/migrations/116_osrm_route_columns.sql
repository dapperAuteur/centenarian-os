-- Migration 116: Add OSRM route columns to trips table
-- Supports storing route geometry and tracking distance calculation source

ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_geometry TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS distance_source TEXT DEFAULT 'manual';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trips_distance_source_check') THEN
    ALTER TABLE trips ADD CONSTRAINT trips_distance_source_check
      CHECK (distance_source IN ('manual', 'osrm', 'haversine'));
  END IF;
END $$;
