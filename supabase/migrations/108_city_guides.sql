-- 108_city_guides.sql
-- City Knowledge Base: city guides and categorized entries (restaurants, hotels, etc.)

BEGIN;

-- ── 1. city_guides table ────────────────────────────────────────────────
CREATE TABLE city_guides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_name   TEXT NOT NULL,
  state       TEXT,
  region      TEXT,
  is_shared   BOOLEAN DEFAULT false,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, city_name, state)
);

ALTER TABLE city_guides ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY city_guides_owner ON city_guides
  FOR ALL USING (user_id = auth.uid());

-- Read shared guides
CREATE POLICY city_guides_shared_read ON city_guides
  FOR SELECT USING (is_shared = true);

-- ── 2. city_guide_entries table ─────────────────────────────────────────
CREATE TABLE city_guide_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_guide_id   UUID NOT NULL REFERENCES city_guides(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN (
    'restaurant', 'hotel', 'grocery', 'gym', 'pharmacy',
    'entertainment', 'transport', 'coffee', 'laundry', 'other'
  )),
  name            TEXT NOT NULL,
  address         TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  rating          SMALLINT CHECK (rating BETWEEN 1 AND 5),
  price_range     SMALLINT CHECK (price_range BETWEEN 1 AND 4),
  notes           TEXT,
  url             TEXT,
  near_venue_id   UUID REFERENCES contact_locations(id) ON DELETE SET NULL,
  is_shared       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE city_guide_entries ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY city_guide_entries_owner ON city_guide_entries
  FOR ALL USING (user_id = auth.uid());

-- Read shared entries (in shared guides)
CREATE POLICY city_guide_entries_shared_read ON city_guide_entries
  FOR SELECT USING (
    is_shared = true
    AND EXISTS (
      SELECT 1 FROM city_guides WHERE id = city_guide_id AND is_shared = true
    )
  );

-- ── 3. Indexes ──────────────────────────────────────────────────────────
CREATE INDEX idx_city_guides_user ON city_guides(user_id);
CREATE INDEX idx_city_guides_shared ON city_guides(is_shared) WHERE is_shared = true;
CREATE INDEX idx_city_guide_entries_guide ON city_guide_entries(city_guide_id);
CREATE INDEX idx_city_guide_entries_category ON city_guide_entries(category);
CREATE INDEX idx_city_guide_entries_near_venue ON city_guide_entries(near_venue_id) WHERE near_venue_id IS NOT NULL;

COMMIT;
