-- 057_cross_module_finance.sql
-- 1. Adds source_module + source_module_id to financial_transactions so fuel logs,
--    vehicle maintenance records, and trips can auto-create linked transactions.
-- 2. Creates user_brands table for allocating expenses to specific businesses/brands.
-- 3. Adds brand_id FK to financial_transactions.

-- Expand the source CHECK to include travel module origins
ALTER TABLE financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_check;
ALTER TABLE financial_transactions
  ADD CONSTRAINT financial_transactions_source_check
    CHECK (source IN ('manual', 'csv_import', 'stripe', 'fuel_log', 'vehicle_maintenance', 'trip'));

-- Track originating module for auto-created transactions
ALTER TABLE financial_transactions
  ADD COLUMN source_module TEXT CHECK (source_module IN ('fuel_log', 'vehicle_maintenance', 'trip')),
  ADD COLUMN source_module_id UUID;

CREATE INDEX ON financial_transactions (source_module, source_module_id);

-- Brands / business entities
CREATE TABLE user_brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  dba_name    TEXT,
  ein         TEXT,
  address     TEXT,
  website     TEXT,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON user_brands (user_id);

ALTER TABLE user_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own brands"
  ON user_brands FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Brand allocation on transactions
ALTER TABLE financial_transactions
  ADD COLUMN brand_id UUID REFERENCES user_brands(id) ON DELETE SET NULL;

CREATE INDEX ON financial_transactions (brand_id);
