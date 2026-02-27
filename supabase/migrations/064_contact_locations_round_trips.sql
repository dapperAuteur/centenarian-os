-- 064_contact_locations_round_trips.sql
-- Adds multi-location support to contacts and round-trip flag to trips.

BEGIN;

-- ── 1. Contact Locations ──────────────────────────────────────────────
CREATE TABLE contact_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  address     TEXT,
  lat         NUMERIC(10,7),
  lng         NUMERIC(10,7),
  is_default  BOOLEAN NOT NULL DEFAULT false,
  notes       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_locations_contact ON contact_locations (contact_id);

ALTER TABLE contact_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_locations_owner ON contact_locations
  FOR ALL USING (
    contact_id IN (SELECT id FROM user_contacts WHERE user_id = auth.uid())
  );

-- ── 2. Round-trip flag on trips ───────────────────────────────────────
ALTER TABLE trips
  ADD COLUMN is_round_trip BOOLEAN NOT NULL DEFAULT false;

COMMIT;
