-- 077_life_categories.sql
-- App-wide life categories for cross-module tagging.

BEGIN;

-- ── 1. Life Categories (user-managed, auto-seeded on first access) ──
CREATE TABLE life_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT 'tag',
  color      TEXT NOT NULL DEFAULT '#6b7280',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_life_categories_user ON life_categories (user_id);

ALTER TABLE life_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY life_categories_owner ON life_categories
  FOR ALL USING (user_id = auth.uid());

-- ── 2. Entity-to-LifeCategory junction table ────────────────────────
CREATE TABLE entity_life_categories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  life_category_id UUID NOT NULL REFERENCES life_categories(id) ON DELETE CASCADE,
  entity_type      TEXT NOT NULL CHECK (entity_type IN (
    'task','trip','route','transaction','recipe',
    'fuel_log','maintenance','invoice','workout','equipment','focus_session'
  )),
  entity_id        UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, life_category_id, entity_type, entity_id)
);

CREATE INDEX idx_elc_entity ON entity_life_categories (user_id, entity_type, entity_id);
CREATE INDEX idx_elc_category ON entity_life_categories (life_category_id);

ALTER TABLE entity_life_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_life_categories_owner ON entity_life_categories
  FOR ALL USING (user_id = auth.uid());

COMMIT;
