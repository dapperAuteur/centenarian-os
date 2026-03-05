-- 097_teller_enrollments.sql
-- Teller.io bank connection tracking + institution policy columns on financial_accounts.

BEGIN;

-- ── 1. Teller enrollments table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teller_enrollments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_id     TEXT NOT NULL,
  access_token      TEXT NOT NULL,
  institution_name  TEXT,
  institution_id    TEXT,
  status            TEXT NOT NULL DEFAULT 'connected'
                      CHECK (status IN ('connected','disconnected','error')),
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teller_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own teller enrollments"
  ON public.teller_enrollments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_teller_enrollments_unique
  ON public.teller_enrollments (user_id, enrollment_id);

-- ── 2. Teller link columns on financial_accounts ────────────────
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS teller_enrollment_id UUID
    REFERENCES public.teller_enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teller_account_id TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oldest_transaction_date DATE;

CREATE INDEX IF NOT EXISTS idx_fa_teller_account
  ON public.financial_accounts (teller_account_id)
  WHERE teller_account_id IS NOT NULL;

-- ── 3. Institution policy columns on financial_accounts ─────────
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS dispute_window_days INT,
  ADD COLUMN IF NOT EXISTS default_return_days INT,
  ADD COLUMN IF NOT EXISTS promo_apr NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS promo_apr_expires DATE,
  ADD COLUMN IF NOT EXISTS promo_description TEXT,
  ADD COLUMN IF NOT EXISTS bt_apr NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS bt_fee_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS bt_expires DATE,
  ADD COLUMN IF NOT EXISTS bt_description TEXT,
  ADD COLUMN IF NOT EXISTS rewards_type TEXT,
  ADD COLUMN IF NOT EXISTS rewards_rate TEXT,
  ADD COLUMN IF NOT EXISTS annual_fee NUMERIC(10,2);

COMMIT;
