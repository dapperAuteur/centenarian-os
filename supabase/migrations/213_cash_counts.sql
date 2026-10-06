-- 213_cash_counts.sql
-- Cash on hand: "Count my cash" history (plans: cash-on-hand feature).
--
-- PURPOSE
--   cash_counts   one row per time a person counted the cash in a cash account
--                 (financial_accounts.account_type = 'cash'): what they counted,
--                 the balance the app had recorded at that moment, the difference,
--                 and the adjustment transaction that made the balance match.
--
--   The adjustment itself is an ordinary financial_transactions row on the cash
--   account: an expense "Unrecorded cash spending" when less cash was counted than
--   recorded, or an income "Cash found" when more, tagged 'cash-count'. A count
--   that matches the recorded balance has no adjustment (adjustment_transaction_id
--   NULL). Nothing here computes or stores balances.
--
--   denominations, when the person counted by bills and coins, maps each
--   denomination's value in cents (as text) to how many pieces: {"2000": 3, "25": 4}.
--
-- LINKS
--   Deleting the cash account deletes its counts. Deleting the adjustment
--   transaction (for example from the Transactions page) keeps the count and
--   clears adjustment_transaction_id. Deleting the category clears category_id.
--   Undo in the app deletes the latest count and its adjustment together.
--
-- WHO CAN READ WHAT
--   Row Level Security is on. Owners can read and write their own rows (auth.uid() = user_id).
--   The policy is app-agnostic: it does not assume which app wrote the row.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): this file creates
-- one new table with its indexes and policy, and touches nothing that exists.
--
-- SAFE TO RE-RUN: CREATE ... IF NOT EXISTS, the policy sits in a DO block that checks first, and
-- ENABLE ROW LEVEL SECURITY / COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied the
-- Count dialog says "Run migration 213 first" and saving a count answers 503 without writing.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cash_counts (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who counted: the account's owner.
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id                 UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  counted_amount             NUMERIC(12,2) NOT NULL,
  -- The balance the app had recorded just before the count (opening + income - expenses).
  recorded_balance           NUMERIC(12,2) NOT NULL,
  -- counted_amount - recorded_balance. Negative = unrecorded spending, positive = cash found.
  difference                 NUMERIC(12,2) NOT NULL,
  -- The account's currency at the time of the count (ISO code).
  currency                   TEXT,
  denominations              JSONB,
  adjustment_transaction_id  UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  category_id                UUID REFERENCES public.budget_categories(id) ON DELETE SET NULL,
  note                       TEXT,
  -- The person's local date of the count (the adjustment's transaction_date).
  counted_on                 DATE NOT NULL DEFAULT CURRENT_DATE,
  counted_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_counts_counted_nonnegative CHECK (counted_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cash_counts_account
  ON public.cash_counts (user_id, account_id, counted_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_counts_adjustment
  ON public.cash_counts (adjustment_transaction_id)
  WHERE adjustment_transaction_id IS NOT NULL;

ALTER TABLE public.cash_counts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cash_counts'
      AND policyname = 'Users manage their own cash counts'
  ) THEN
    CREATE POLICY "Users manage their own cash counts" ON public.cash_counts
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.cash_counts IS
  'Counts of the cash in a cash account: counted vs recorded balance, and the adjustment transaction (tag cash-count) that made them match.';
COMMENT ON COLUMN public.cash_counts.difference IS
  'counted_amount - recorded_balance. Negative = "Unrecorded cash spending" expense, positive = "Cash found" income.';
COMMENT ON COLUMN public.cash_counts.denominations IS
  'Optional count by bills and coins: denomination value in cents (text key) -> number of pieces.';
COMMENT ON COLUMN public.cash_counts.adjustment_transaction_id IS
  'The financial_transactions row that closed the gap; NULL when the count matched or the row was deleted.';

COMMIT;
