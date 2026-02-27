-- 066_activity_links.sql
-- Cross-module activity linking + task location/contact FKs.

BEGIN;

-- ── 1. Activity Links (cross-module junction table) ───────────────────
CREATE TABLE activity_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'task', 'trip', 'route', 'transaction', 'recipe',
    'fuel_log', 'maintenance', 'invoice', 'workout'
  )),
  source_id   UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN (
    'task', 'trip', 'route', 'transaction', 'recipe',
    'fuel_log', 'maintenance', 'invoice', 'workout'
  )),
  target_id   UUID NOT NULL,
  relationship TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_type, source_id, target_type, target_id)
);

CREATE INDEX idx_activity_links_source ON activity_links (user_id, source_type, source_id);
CREATE INDEX idx_activity_links_target ON activity_links (user_id, target_type, target_id);

ALTER TABLE activity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_links_owner ON activity_links
  FOR ALL USING (user_id = auth.uid());

-- ── 2. Task contact/location FKs ─────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN contact_id  UUID REFERENCES user_contacts(id) ON DELETE SET NULL,
  ADD COLUMN location_id UUID REFERENCES contact_locations(id) ON DELETE SET NULL;

COMMIT;
