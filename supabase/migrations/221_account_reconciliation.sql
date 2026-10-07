-- 221_account_reconciliation.sql
-- Dated starting balances, cleared transactions and statement reconciliations (plans/63, section C).
--
-- PURPOSE
--   financial_accounts.opening_balance_date
--       The day the opening balance is "as of" (the balance at the END of that day). When set, an
--       account's balance is opening_balance plus the transactions dated AFTER this day; older
--       transactions stay in the history but no longer count toward the balance. NULL keeps the
--       old rule: opening_balance plus every transaction on the account. This lets an account
--       start part-way through its history when older statements are never imported.
--       CentenarianOS computes every balance in one place (lib/finance/balance/logic.ts). An app
--       on this shared database that ignores the column keeps computing over all transactions,
--       which is exactly what it did before.
--
--   financial_transactions.cleared_at
--       When the person ticked the transaction as "Cleared" (it appears on a bank or card
--       statement) while reconciling. NULL = not cleared. Nothing else reads or writes it.
--
--   account_reconciliations
--       One row per account per statement date: the statement's ending balance, the balance the
--       app worked out for that date, the difference, how the difference was handled and whether
--       the account is reconciled through that date. Money is in the account's own currency.
--         status      'reconciled' (the books match the statement through statement_date)
--                     or 'open' (a difference was left to sort out later, or it was unreconciled)
--         resolution  'matched' (no difference), 'adjustment' (a labelled adjustment transaction,
--                     tag reconcile-adjustment, closed the gap), 'starting_balance' (the opening
--                     balance was changed by the difference) or 'left_open'
--       For credit cards and loans every balance here is the amount OWED (positive = owed), the
--       way the statement prints it.
--
-- LINKS
--   Deleting the account deletes its reconciliations. Deleting the adjustment transaction keeps
--   the reconciliation and clears adjustment_transaction_id. Undoing the PDF import whose
--   statement was used clears statement_id.
--
-- WHO CAN READ WHAT
--   Row Level Security is on. Owners can read and write their own rows (auth.uid() = user_id).
--   The policy is app-agnostic: it does not assume which app wrote the row.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): two NULLable
-- columns on existing tables and one new table with its indexes and policy. Nothing is dropped,
-- renamed or narrowed, and no existing row changes.
--
-- SAFE TO RE-RUN: ADD COLUMN IF NOT EXISTS, CREATE ... IF NOT EXISTS, the policy sits in a DO block
-- that checks first, and ENABLE ROW LEVEL SECURITY / COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor, after 209 (account_statements).
-- Until it is applied the Reconcile page and the starting-balance date say "Run migration 221
-- first" and nothing is written; balances keep the old rule.
--
-- AFTER APPLYING: if the app still says "Run migration 221 first", PostgREST has not reloaded its
-- schema cache yet. Run:  NOTIFY pgrst, 'reload schema';

BEGIN;

ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS opening_balance_date DATE;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.account_reconciliations (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL
                               CONSTRAINT account_reconciliations_user_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id                 UUID NOT NULL
                               CONSTRAINT account_reconciliations_account_id_fkey REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  -- The imported statement (migration 209) the balance came from, when there was one.
  statement_id               UUID
                               CONSTRAINT account_reconciliations_statement_id_fkey REFERENCES public.account_statements(id) ON DELETE SET NULL,
  -- The statement's closing date: the balance is as of the end of this day.
  statement_date             DATE NOT NULL,
  statement_balance          NUMERIC(12,2) NOT NULL,
  -- What the app worked out for statement_date before any adjustment.
  computed_balance           NUMERIC(12,2) NOT NULL,
  -- statement_balance - computed_balance.
  difference                 NUMERIC(12,2) NOT NULL,
  -- The account's currency at the time (ISO code).
  currency                   TEXT,
  status                     TEXT NOT NULL DEFAULT 'open'
                               CONSTRAINT account_reconciliations_status_check CHECK (status IN ('reconciled', 'open')),
  resolution                 TEXT
                               CONSTRAINT account_reconciliations_resolution_check
                               CHECK (resolution IS NULL OR resolution IN ('matched', 'adjustment', 'starting_balance', 'left_open')),
  adjustment_transaction_id  UUID
                               CONSTRAINT account_reconciliations_adjustment_fkey REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  -- How many of the period's transactions were ticked Cleared.
  cleared_count              INTEGER NOT NULL DEFAULT 0,
  note                       TEXT,
  -- When it was last marked reconciled (NULL while open).
  reconciled_at              TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_reconciliations_user_account_date_key UNIQUE (user_id, account_id, statement_date)
);

CREATE INDEX IF NOT EXISTS idx_account_reconciliations_account_date
  ON public.account_reconciliations (user_id, account_id, statement_date DESC);
CREATE INDEX IF NOT EXISTS idx_account_reconciliations_adjustment
  ON public.account_reconciliations (adjustment_transaction_id)
  WHERE adjustment_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_account_reconciliations_statement
  ON public.account_reconciliations (statement_id)
  WHERE statement_id IS NOT NULL;

ALTER TABLE public.account_reconciliations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'account_reconciliations'
      AND policyname = 'account_reconciliations_owner'
  ) THEN
    CREATE POLICY account_reconciliations_owner ON public.account_reconciliations
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON COLUMN public.financial_accounts.opening_balance_date IS
  'The day opening_balance is as of (end of day). Balance = opening_balance + transactions dated after it. NULL = every transaction counts (CentenarianOS, migration 221).';
COMMENT ON COLUMN public.financial_transactions.cleared_at IS
  'When the transaction was ticked Cleared (seen on a statement) while reconciling. NULL = not cleared (CentenarianOS, migration 221).';
COMMENT ON TABLE public.account_reconciliations IS
  'Statement reconciliations (CentenarianOS, migration 221): statement ending balance vs the balance worked out for that date, the difference and how it was handled. Cards and loans: amounts owed.';
COMMENT ON COLUMN public.account_reconciliations.difference IS
  'statement_balance - computed_balance, in the account currency. For cards and loans both are amounts owed.';
COMMENT ON COLUMN public.account_reconciliations.adjustment_transaction_id IS
  'The adjustment transaction (tag reconcile-adjustment) that closed the gap; NULL when none was added or it was deleted.';

COMMIT;
