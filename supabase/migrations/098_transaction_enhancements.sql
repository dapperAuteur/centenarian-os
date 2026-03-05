-- 098_transaction_enhancements.sql
-- Adds dispute/return tracking and bank_sync source to financial_transactions.

BEGIN;

-- ── 1. Teller dedup column ──────────────────────────────────────
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS teller_transaction_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_teller_txn
  ON public.financial_transactions (teller_transaction_id)
  WHERE teller_transaction_id IS NOT NULL;

-- ── 2. Dispute tracking columns ─────────────────────────────────
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS dispute_status TEXT
    CHECK (dispute_status IS NULL OR dispute_status IN ('flagged','submitted','resolved','denied')),
  ADD COLUMN IF NOT EXISTS dispute_date DATE,
  ADD COLUMN IF NOT EXISTS dispute_notes TEXT;

-- ── 3. Return tracking columns ──────────────────────────────────
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS return_deadline DATE,
  ADD COLUMN IF NOT EXISTS return_policy_days INT,
  ADD COLUMN IF NOT EXISTS return_status TEXT
    CHECK (return_status IS NULL OR return_status IN ('eligible','expired','returned'));

-- ── 4. Expand source CHECK to include bank_sync ─────────────────
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_check;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_source_check
    CHECK (source IN ('manual','csv_import','stripe','fuel_log','vehicle_maintenance','trip','transfer','interest','recurring','scan','bank_sync'));

COMMIT;
