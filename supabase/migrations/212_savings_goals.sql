-- 212_savings_goals.sql
-- Savings goals as virtual envelopes (plans/60, Phase D).
--
-- PURPOSE
--   savings_goals        one row per goal (a trip, a house down payment, an emergency fund...). Each
--                        goal draws from ONE real account (funding_account_id), usually a savings
--                        account. Several goals can share one account: the account's balance is
--                        split across them, like envelopes. No money moves between real accounts.
--   savings_allocations  money put into (+) or taken out of (-) a goal's envelope. A goal's saved
--                        amount = starting_amount + SUM(amount). transaction_id, when set, is the
--                        deposit (usually the incoming side of a transfer) the money came from.
--
--   "Unallocated" for an account = its balance minus what its goals hold. The app refuses an
--   allocation that would take more than is unallocated, and shows an account whose balance has
--   dropped below what its goals hold as over-allocated. Nothing here computes or stores balances.
--
-- LINKS
--   linked_trip_id / linked_equipment_id are optional pointers to a planned trip or an equipment
--   item the goal is for. Deleting the trip or the item clears the link and keeps the goal.
--   Deleting the funding account clears funding_account_id and keeps the goal and its history.
--   Deleting a goal deletes its allocations, which returns that money to "unallocated".
--
-- WHO CAN READ WHAT
--   Row Level Security is on. Owners can read and write their own rows (auth.uid() = user_id).
--   The policies are app-agnostic: they do not assume which app wrote the row.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): this file creates
-- two new tables with their indexes, trigger and policies, and touches nothing that exists.
--
-- SAFE TO RE-RUN: CREATE ... IF NOT EXISTS, the trigger and policies sit in DO blocks that check
-- first, and ENABLE ROW LEVEL SECURITY / COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied the
-- Savings page says "Run migration 212 first" and the savings API answers 503.

BEGIN;

CREATE TABLE IF NOT EXISTS public.savings_goals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  kind                 TEXT NOT NULL DEFAULT 'other',
  target_amount        NUMERIC(12,2) NOT NULL,
  target_date          DATE,
  funding_account_id   UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  starting_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- 1 = first claim on the monthly surplus.
  priority             INT NOT NULL DEFAULT 1,
  status               TEXT NOT NULL DEFAULT 'active',
  linked_trip_id       UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  linked_equipment_id  UUID REFERENCES public.equipment(id) ON DELETE SET NULL,
  -- Add a completed note task under Inbox when the goal reaches 25/50/75/100%.
  milestone_tasks      BOOLEAN NOT NULL DEFAULT false,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT savings_goals_kind_check
    CHECK (kind IN ('equipment', 'house', 'trip', 'emergency', 'vehicle', 'education', 'other')),
  CONSTRAINT savings_goals_status_check
    CHECK (status IN ('active', 'paused', 'done', 'archived')),
  CONSTRAINT savings_goals_target_positive CHECK (target_amount > 0),
  CONSTRAINT savings_goals_starting_nonnegative CHECK (starting_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user
  ON public.savings_goals (user_id, status);
CREATE INDEX IF NOT EXISTS idx_savings_goals_funding_account
  ON public.savings_goals (funding_account_id)
  WHERE funding_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.savings_allocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id         UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Positive = put into the goal, negative = taken out (released, moved, or spent).
  amount          NUMERIC(12,2) NOT NULL,
  allocated_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  -- The deposit into the funding account this money came from (usually a transfer's incoming side).
  transaction_id  UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT savings_allocations_amount_nonzero CHECK (amount <> 0)
);

CREATE INDEX IF NOT EXISTS idx_savings_allocations_goal
  ON public.savings_allocations (goal_id, allocated_on);
CREATE INDEX IF NOT EXISTS idx_savings_allocations_user
  ON public.savings_allocations (user_id);
CREATE INDEX IF NOT EXISTS idx_savings_allocations_transaction
  ON public.savings_allocations (transaction_id)
  WHERE transaction_id IS NOT NULL;

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_allocations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'savings_goals'
      AND policyname = 'Users manage their own savings goals'
  ) THEN
    CREATE POLICY "Users manage their own savings goals" ON public.savings_goals
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'savings_allocations'
      AND policyname = 'Users manage their own savings allocations'
  ) THEN
    CREATE POLICY "Users manage their own savings allocations" ON public.savings_allocations
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at: update_updated_at_column() exists since the early migrations (051 uses it).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_savings_goals_updated_at'
      AND tgrelid = 'public.savings_goals'::regclass
  ) THEN
    CREATE TRIGGER update_savings_goals_updated_at
      BEFORE UPDATE ON public.savings_goals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE public.savings_goals IS
  'Savings goal as a virtual envelope inside one real account (plans/60 Phase D). Saved = starting_amount + SUM(savings_allocations.amount).';
COMMENT ON COLUMN public.savings_goals.funding_account_id IS
  'The real account (usually savings) whose balance this goal''s envelope is part of.';
COMMENT ON COLUMN public.savings_goals.priority IS
  'Lower number = first claim on the monthly surplus when checking whether goals fit.';
COMMENT ON TABLE public.savings_allocations IS
  'Money put into (+) or taken out of (-) a savings goal''s envelope. Never moves money between real accounts.';
COMMENT ON COLUMN public.savings_allocations.transaction_id IS
  'The deposit into the funding account this allocation came from, when split from a deposit.';

COMMIT;
