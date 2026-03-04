-- 093_smart_scan.sql
-- Universal Smart Scan: receipt/document image storage, receipt line items,
-- per-item price history, and user scan preferences.

BEGIN;

-- ── 1. User preference: auto-save scanned images ───────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scan_auto_save_images BOOLEAN DEFAULT false;

-- ── 2. Scan images table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scan_images (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type         TEXT NOT NULL CHECK (document_type IN (
                          'receipt','recipe','fuel_receipt','maintenance_invoice','medical','unknown')),
  entity_type           TEXT,
  entity_id             UUID,
  contact_id            UUID REFERENCES public.user_contacts(id) ON DELETE SET NULL,
  cloudinary_url        TEXT NOT NULL,
  cloudinary_public_id  TEXT NOT NULL,
  original_filename     TEXT,
  scan_data             JSONB,
  confidence            NUMERIC(4,3),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.scan_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scan images"
  ON public.scan_images FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_scan_images_user_date ON public.scan_images (user_id, created_at DESC);
CREATE INDEX idx_scan_images_entity    ON public.scan_images (entity_type, entity_id);
CREATE INDEX idx_scan_images_contact   ON public.scan_images (contact_id)
  WHERE contact_id IS NOT NULL;

-- ── 3. Receipt line items (granular item tracking) ──────────────
CREATE TABLE IF NOT EXISTS public.receipt_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_image_id   UUID REFERENCES public.scan_images(id) ON DELETE SET NULL,
  transaction_id  UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  item_name       TEXT NOT NULL,
  normalized_name TEXT GENERATED ALWAYS AS (lower(trim(item_name))) STORED,
  quantity        NUMERIC(10,3) DEFAULT 1,
  unit            TEXT,
  unit_price      NUMERIC(10,2),
  total_price     NUMERIC(10,2),
  category_hint   TEXT,
  matched_item_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.receipt_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own receipt line items"
  ON public.receipt_line_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_receipt_items_user_name ON public.receipt_line_items (user_id, normalized_name);
CREATE INDEX idx_receipt_items_scan      ON public.receipt_line_items (scan_image_id)
  WHERE scan_image_id IS NOT NULL;
CREATE INDEX idx_receipt_items_txn       ON public.receipt_line_items (transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ── 4. Item price history (track prices over time) ──────────────
CREATE TABLE IF NOT EXISTS public.item_prices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name         TEXT NOT NULL,
  normalized_name   TEXT GENERATED ALWAYS AS (lower(trim(item_name))) STORED,
  category          TEXT,
  price             NUMERIC(10,2) NOT NULL,
  unit              TEXT,
  unit_price        NUMERIC(10,4),
  vendor_contact_id UUID REFERENCES public.user_contacts(id) ON DELETE SET NULL,
  vendor_name       TEXT,
  recorded_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  source            TEXT DEFAULT 'scan' CHECK (source IN ('scan','manual')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.item_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own item prices"
  ON public.item_prices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_item_prices_user_name ON public.item_prices (user_id, normalized_name);
CREATE INDEX idx_item_prices_user_date ON public.item_prices (user_id, recorded_date DESC);

-- One price per item per vendor per day
CREATE UNIQUE INDEX idx_item_prices_unique
  ON public.item_prices (user_id, normalized_name, COALESCE(vendor_contact_id, '00000000-0000-0000-0000-000000000000'::uuid), recorded_date);

-- ── 5. Expand financial_transactions source CHECK ───────────────
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_check;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_source_check
    CHECK (source IN ('manual','csv_import','stripe','fuel_log','vehicle_maintenance','trip','transfer','interest','recurring','scan'));

-- ── 6. Expand source_module CHECK to include scan ───────────────
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_module_check;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_source_module_check
    CHECK (source_module IS NULL OR source_module IN ('fuel_log','vehicle_maintenance','trip','scan'));

COMMIT;
