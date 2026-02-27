-- 063_transfers_interest_recurring.sql
-- Adds transfer_group_id to transactions, expands source CHECK,
-- and creates recurring_payments table.

BEGIN;

-- (a) Expand source CHECK to include transfer, interest, recurring
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_check;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_source_check
    CHECK (source IN ('manual','csv_import','stripe','fuel_log','vehicle_maintenance','trip','transfer','interest','recurring'));

-- (b) Add transfer_group_id to link paired transfer transactions
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS transfer_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_ft_transfer_group
  ON public.financial_transactions (transfer_group_id)
  WHERE transfer_group_id IS NOT NULL;

-- (c) Create recurring_payments table
CREATE TABLE IF NOT EXISTS public.recurring_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense','income')),
  category_id UUID REFERENCES public.budget_categories(id) ON DELETE SET NULL,
  day_of_month INT NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY recurring_payments_user ON public.recurring_payments
  FOR ALL USING (user_id = auth.uid());

COMMIT;
