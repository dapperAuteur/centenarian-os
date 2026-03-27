-- 168_paycheck_reconciliation.sql
-- Paycheck reconciliation: group invoices into paychecks, track taxes, split deposits.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

BEGIN;

-- ─── 1. Paychecks ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paychecks (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id                 UUID REFERENCES public.contractor_jobs(id) ON DELETE SET NULL,
  paycheck_number        TEXT,
  pay_period_start       DATE NOT NULL,
  pay_period_end         DATE NOT NULL,
  pay_date               DATE NOT NULL,
  -- Amounts
  gross_amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  benefits_total         NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxes_total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  other_deductions       JSONB NOT NULL DEFAULT '[]',
  other_deductions_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount             NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Expected vs actual
  expected_gross         NUMERIC(10,2),
  variance_amount        NUMERIC(10,2),
  variance_notes         TEXT,
  -- Reconciliation
  status                 TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'reconciled', 'disputed')),
  is_reconciled          BOOLEAN NOT NULL DEFAULT false,
  reconciled_at          TIMESTAMPTZ,
  -- References
  brand_id               UUID,
  notes                  TEXT,
  metadata               JSONB NOT NULL DEFAULT '{}',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paychecks_user ON public.paychecks(user_id);
CREATE INDEX IF NOT EXISTS idx_paychecks_job ON public.paychecks(job_id);
CREATE INDEX IF NOT EXISTS idx_paychecks_date ON public.paychecks(user_id, pay_date DESC);

ALTER TABLE public.paychecks ENABLE ROW LEVEL SECURITY;
CREATE POLICY paychecks_owner ON public.paychecks
  FOR ALL USING (user_id = auth.uid());

-- ─── 2. Paycheck ↔ Invoice join table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paycheck_invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paycheck_id   UUID NOT NULL REFERENCES public.paychecks(id) ON DELETE CASCADE,
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  UNIQUE(paycheck_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_paycheck_invoices_paycheck ON public.paycheck_invoices(paycheck_id);
CREATE INDEX IF NOT EXISTS idx_paycheck_invoices_invoice ON public.paycheck_invoices(invoice_id);

ALTER TABLE public.paycheck_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY paycheck_invoices_owner ON public.paycheck_invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.paychecks WHERE id = paycheck_invoices.paycheck_id AND user_id = auth.uid())
  );

-- ─── 3. Tax withholding lines ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paycheck_taxes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paycheck_id     UUID NOT NULL REFERENCES public.paychecks(id) ON DELETE CASCADE,
  tax_type        TEXT NOT NULL CHECK (tax_type IN (
    'federal', 'state', 'local', 'fica_ss', 'fica_medicare',
    'state_disability', 'state_unemployment', 'local_other', 'other'
  )),
  label           TEXT NOT NULL,
  expected_amount NUMERIC(10,2),
  actual_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order      INT NOT NULL DEFAULT 0,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_paycheck_taxes_paycheck ON public.paycheck_taxes(paycheck_id);

ALTER TABLE public.paycheck_taxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY paycheck_taxes_owner ON public.paycheck_taxes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.paychecks WHERE id = paycheck_taxes.paycheck_id AND user_id = auth.uid())
  );

-- ─── 4. Deposit splits across accounts ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paycheck_deposits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paycheck_id     UUID NOT NULL REFERENCES public.paychecks(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL,
  percentage      NUMERIC(5,2),
  deposit_type    TEXT NOT NULL DEFAULT 'direct_deposit'
    CHECK (deposit_type IN ('direct_deposit', 'check', 'cash', 'other')),
  transaction_id  UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  label           TEXT,
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_paycheck_deposits_paycheck ON public.paycheck_deposits(paycheck_id);
CREATE INDEX IF NOT EXISTS idx_paycheck_deposits_account ON public.paycheck_deposits(account_id);

ALTER TABLE public.paycheck_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY paycheck_deposits_owner ON public.paycheck_deposits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.paychecks WHERE id = paycheck_deposits.paycheck_id AND user_id = auth.uid())
  );

-- ─── 5. FK addition: invoices.paycheck_id ───────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paycheck_id UUID REFERENCES public.paychecks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_paycheck ON public.invoices(paycheck_id);

COMMIT;
