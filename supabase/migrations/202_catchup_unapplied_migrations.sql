-- 202_catchup_unapplied_migrations.sql
-- Catch-up for objects that earlier migrations define but that were never applied to the live database.
--
-- WHY. Migrations here are run by hand in the Supabase SQL editor, and the database does not record which
-- numbered files ran. A read-only audit on 2026-10-03 compared every migration with the live schema and found
-- that 063, 153, the witus_identities migration and contractor-os 165 had not been applied. Features that
-- depend on them have been failing: transfers, recurring payments, paycheck reconcile, the WitUS sign-in link
-- table, and Work.WitUS dashboard widget preferences.
--
-- WHY NOT JUST RE-RUN THE ORIGINALS. 063 also re-declares financial_transactions_source_check with the
-- 9-value list it had at the time. Run today, that fails on every bank_sync row and aborts the migration.
-- 153's CREATE POLICY is unguarded. This file carries ONLY the missing objects, with their original
-- definitions, and every statement is safe to run again.
--
-- Additive only. Shared with contractor-os (Work.WitUS): nothing here drops, renames or narrows anything.
-- Deliberately NOT included (no code depends on them; see plans/bugs/03):
--   174_cashapp_app_column (unused column whose default would mislabel rows),
--   110's missing RLS policies (service-role only today; two of the originals recurse into each other).

BEGIN;

-- ── From 063_transfers_interest_recurring.sql: parts (b) and (c) only ────────────────────────────────────
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS transfer_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_ft_transfer_group
  ON public.financial_transactions (transfer_group_id)
  WHERE transfer_group_id IS NOT NULL;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'recurring_payments' AND policyname = 'recurring_payments_user'
  ) THEN
    CREATE POLICY recurring_payments_user ON public.recurring_payments
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

-- ── From 153_paycheck_line_items.sql ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paycheck_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period_id UUID NOT NULL REFERENCES public.schedule_pay_periods(id) ON DELETE CASCADE,
  line_type     TEXT NOT NULL CHECK (line_type IN ('earning','tax','deduction','benefit')),
  description   TEXT NOT NULL,
  rate          NUMERIC(10,2),
  hours         NUMERIC(6,2),
  amount        NUMERIC(10,2) NOT NULL,
  ytd_amount    NUMERIC(12,2),
  is_pretax     BOOLEAN DEFAULT FALSE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paycheck_line_items_period
  ON public.paycheck_line_items(pay_period_id);

ALTER TABLE public.paycheck_line_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'paycheck_line_items'
      AND policyname = 'Users can CRUD their paycheck line items'
  ) THEN
    CREATE POLICY "Users can CRUD their paycheck line items" ON public.paycheck_line_items
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.schedule_pay_periods pp
          JOIN public.schedule_templates st ON st.id = pp.template_id
          WHERE pp.id = paycheck_line_items.pay_period_id
          AND st.user_id = auth.uid()
        )
      );
  END IF;
END $$;

ALTER TABLE public.schedule_template_finance
  ADD COLUMN IF NOT EXISTS line_item_templates JSONB DEFAULT '[]';

COMMENT ON COLUMN public.schedule_template_finance.line_item_templates
  IS 'Saved paycheck line item descriptions for reuse: [{line_type, description, rate, hours, is_pretax}]';

-- ── From 20260630120000_witus_identities.sql ─────────────────────────────────────────────────────────────
-- RLS on with no policies: only the service-role server reads or writes this table.
CREATE TABLE IF NOT EXISTS public.witus_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  witus_sub TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.witus_identities ENABLE ROW LEVEL SECURITY;

-- ── From contractor-os 165_dashboard_widgets.sql (shared `profiles` table; adding a column is allowed) ────
-- Format: [{ "id": "jobs-summary", "visible": true, "order": 0 }, ...]. Empty array = default widgets.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_widgets JSONB NOT NULL DEFAULT '[]';

COMMIT;

-- Verify (expect five rows, all true):
-- select 'transfer_group_id', exists(select 1 from information_schema.columns where table_name='financial_transactions' and column_name='transfer_group_id')
-- union all select 'recurring_payments', to_regclass('public.recurring_payments') is not null
-- union all select 'paycheck_line_items', to_regclass('public.paycheck_line_items') is not null
-- union all select 'witus_identities', to_regclass('public.witus_identities') is not null
-- union all select 'profiles.dashboard_widgets', exists(select 1 from information_schema.columns where table_name='profiles' and column_name='dashboard_widgets');
