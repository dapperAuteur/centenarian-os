-- 069_equipment.sql
-- Equipment tracker: categories (user CRUD), items, valuations, activity_links extension.

BEGIN;

-- ── 1. Equipment Categories (user-managed) ────────────────────────────
CREATE TABLE equipment_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,            -- lucide icon name (optional)
  color      TEXT,            -- hex color for badge (optional)
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_equipment_categories_user ON equipment_categories (user_id);

ALTER TABLE equipment_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipment_categories_owner ON equipment_categories
  FOR ALL USING (user_id = auth.uid());

-- ── 2. Equipment Items ────────────────────────────────────────────────
CREATE TABLE equipment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category_id     UUID REFERENCES equipment_categories(id) ON DELETE SET NULL,
  brand           TEXT,
  model           TEXT,
  serial_number   TEXT,
  purchase_date   DATE,
  purchase_price  NUMERIC(10,2),
  current_value   NUMERIC(10,2),
  warranty_expires DATE,
  condition       TEXT CHECK (condition IN ('new', 'excellent', 'good', 'fair', 'poor')),
  image_url       TEXT,
  image_public_id TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  transaction_id  UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_user ON equipment (user_id);
CREATE INDEX idx_equipment_user_category ON equipment (user_id, category_id);
CREATE INDEX idx_equipment_user_active ON equipment (user_id, is_active);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipment_owner ON equipment
  FOR ALL USING (user_id = auth.uid());

CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. Equipment Valuations (value history) ───────────────────────────
CREATE TABLE equipment_valuations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valued_at    DATE NOT NULL,
  value        NUMERIC(10,2) NOT NULL,
  source       TEXT CHECK (source IN ('manual', 'ebay', 'other')) DEFAULT 'manual',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_valuations_equip ON equipment_valuations (equipment_id);
CREATE INDEX idx_equipment_valuations_user ON equipment_valuations (user_id);

ALTER TABLE equipment_valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY equipment_valuations_owner ON equipment_valuations
  FOR ALL USING (user_id = auth.uid());

-- ── 4. Extend activity_links to support 'equipment' entity type ───────
ALTER TABLE activity_links
  DROP CONSTRAINT activity_links_source_type_check;
ALTER TABLE activity_links
  ADD CONSTRAINT activity_links_source_type_check
    CHECK (source_type IN (
      'task', 'trip', 'route', 'transaction', 'recipe',
      'fuel_log', 'maintenance', 'invoice', 'workout', 'equipment'
    ));

ALTER TABLE activity_links
  DROP CONSTRAINT activity_links_target_type_check;
ALTER TABLE activity_links
  ADD CONSTRAINT activity_links_target_type_check
    CHECK (target_type IN (
      'task', 'trip', 'route', 'transaction', 'recipe',
      'fuel_log', 'maintenance', 'invoice', 'workout', 'equipment'
    ));

COMMIT;
