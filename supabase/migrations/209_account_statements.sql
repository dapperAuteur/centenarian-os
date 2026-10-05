-- 209_account_statements.sql
-- Statement facts saved when a card or bank statement PDF is imported (lib/finance/pdf-import).
--
-- PURPOSE
--   account_statements: one row per statement period per account: the statement's own summary
--   (previous balance, payments, credits, purchases, cash advances, fees, interest, new balance,
--   minimum payment, due date, credit limit), its APRs by balance type, its promotional
--   (deferred-interest) balances with their expiry dates, and whether the statement reconciled.
--   Written by POST /api/finance/import when the statement is a PDF; removed when that import is
--   undone. Read by the planned interest / debt payoff views (plans/61).
--
-- MONEY: dollars in NUMERIC(12,2), like financial_transactions.amount. The parser works in integer
--   cents and converts on save. aprs and promos hold the same, as JSON:
--     aprs:   [{ "balance_type": "Purchases - Regular", "apr": 28.74, "balance": 1234.56, "interest": 12.34 }]
--     promos: [{ "description": "...", "balance": 500.00, "expires_on": "2027-01-31",
--                "deferred_interest": 80.00, "original_amount": 600.00, "minimum_payment": 25.00,
--                "started_on": "2026-01-31" }]
--   Keys other than balance_type/apr and description/balance/expires_on may be absent.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): one new table,
-- nothing existing is dropped, renamed or narrowed.
--
-- SAFE TO RE-RUN: every statement is IF NOT EXISTS or guarded by a DO block.
--
-- AFTER APPLYING: if the app still answers "Run migration 209 first", PostgREST has not reloaded
-- its schema cache yet. Run:  NOTIFY pgrst, 'reload schema';

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_statements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL
                      CONSTRAINT account_statements_user_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL
                      CONSTRAINT account_statements_account_id_fkey REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  import_batch_id   UUID
                      CONSTRAINT account_statements_import_batch_id_fkey REFERENCES public.import_batches(id) ON DELETE SET NULL,
  issuer            TEXT NOT NULL,
  period_start      DATE,
  period_end        DATE NOT NULL,
  previous_balance  NUMERIC(12,2),
  payments          NUMERIC(12,2),
  credits           NUMERIC(12,2),
  purchases         NUMERIC(12,2),
  cash_advances     NUMERIC(12,2),
  fees              NUMERIC(12,2),
  interest_charged  NUMERIC(12,2),
  new_balance       NUMERIC(12,2),
  minimum_payment   NUMERIC(12,2),
  due_date          DATE,
  credit_limit      NUMERIC(12,2),
  aprs              JSONB NOT NULL DEFAULT '[]'::jsonb,
  promos            JSONB NOT NULL DEFAULT '[]'::jsonb,
  reconciled        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_statements_user_account_period_key UNIQUE (user_id, account_id, period_end)
);

CREATE INDEX IF NOT EXISTS idx_account_statements_account_period
  ON public.account_statements (account_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_account_statements_import_batch
  ON public.account_statements (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

ALTER TABLE public.account_statements ENABLE ROW LEVEL SECURITY;

-- Owner-only, and app-agnostic: the policy looks at the row's user_id and nothing else.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_statements' AND policyname = 'account_statements_owner'
  ) THEN
    CREATE POLICY account_statements_owner ON public.account_statements
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.account_statements IS
  'Statement facts from an imported card or bank statement PDF (CentenarianOS, migration 209): summary totals, APRs, promotional balances with expiry dates, and whether the statement reconciled. One row per (user, account, period end); undoing the import that wrote it deletes it.';

COMMIT;
