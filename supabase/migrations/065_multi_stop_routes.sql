-- 065_multi_stop_routes.sql
-- Adds multi-stop route support: trip_routes parent table, trip_template_stops,
-- and links trips to routes via route_id + leg_order.

BEGIN;

-- ── 1. Trip Routes (multi-stop parent) ────────────────────────────────
CREATE TABLE trip_routes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT,
  date           DATE NOT NULL,
  total_distance NUMERIC(10,2),
  total_duration INT,
  total_cost     NUMERIC(10,2),
  total_co2_kg   NUMERIC(10,3),
  is_round_trip  BOOLEAN NOT NULL DEFAULT false,
  notes          TEXT,
  template_id    UUID REFERENCES trip_templates(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_routes_user_date ON trip_routes (user_id, date DESC);

ALTER TABLE trip_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_routes_owner ON trip_routes
  FOR ALL USING (user_id = auth.uid());

-- ── 2. Link trips to routes ──────────────────────────────────────────
ALTER TABLE trips
  ADD COLUMN route_id  UUID REFERENCES trip_routes(id) ON DELETE SET NULL,
  ADD COLUMN leg_order INT;

CREATE INDEX idx_trips_route ON trips (route_id) WHERE route_id IS NOT NULL;

-- ── 3. Multi-stop flag on trip templates ──────────────────────────────
ALTER TABLE trip_templates
  ADD COLUMN is_multi_stop BOOLEAN NOT NULL DEFAULT false;

-- ── 4. Trip template stops ────────────────────────────────────────────
CREATE TABLE trip_template_stops (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    UUID NOT NULL REFERENCES trip_templates(id) ON DELETE CASCADE,
  stop_order     INT NOT NULL DEFAULT 0,
  location_name  TEXT,
  contact_id     UUID REFERENCES user_contacts(id) ON DELETE SET NULL,
  location_id    UUID REFERENCES contact_locations(id) ON DELETE SET NULL,
  mode           TEXT,
  distance_miles NUMERIC(10,2),
  duration_min   INT,
  cost           NUMERIC(10,2),
  purpose        TEXT,
  notes          TEXT
);

CREATE INDEX idx_trip_template_stops_template ON trip_template_stops (template_id);

ALTER TABLE trip_template_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_template_stops_owner ON trip_template_stops
  FOR ALL USING (
    template_id IN (SELECT id FROM trip_templates WHERE user_id = auth.uid())
  );

COMMIT;
