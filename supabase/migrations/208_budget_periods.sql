-- 208_budget_periods.sql
-- Per-month budgets for budget categories (plans/60, Phase A: budgets from history).
--
-- PURPOSE
--   budget_periods  one row per user, category and month: the budget for THAT month, and whether
--                   last month's leftover (or overspend) carries into it. Changing a budget writes
--                   a row for the month it applies to, so earlier months keep the budget they had
--                   and "spent vs budget" can be shown for any month, not just the current one.
--
--   budget_categories.monthly_budget STAYS the default: a month with no budget_periods row uses
--   it. Nothing here copies, moves or changes that column. Code written for this table falls back
--   to monthly_budget when the table doesn't exist yet.
--
-- ROLLOVER
--   rollover = true on a month's row turns carry-over on from that month until a later row turns
--   it off (the app reads the most recent row at or before a month). The app computes the carried
--   amount; nothing is stored for it.
--
-- WHO CAN READ WHAT
--   Row Level Security is on. Owners can read and write their own rows (auth.uid() = user_id).
--   The policy is app-agnostic: it does not assume which app wrote the row.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): this file creates
-- one new table, its index, trigger and policy, and touches nothing that exists.
--
-- SAFE TO RE-RUN: CREATE ... IF NOT EXISTS, the trigger and policy sit in DO blocks that check
-- first, and ENABLE ROW LEVEL SECURITY / COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied the
-- Budgets page shows each category's monthly_budget and refuses budget changes with a message.

BEGIN;

CREATE TABLE IF NOT EXISTS public.budget_periods (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES public.budget_categories(id) ON DELETE CASCADE,
  -- Always the first day of the month (enforced below).
  month        DATE NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  rollover     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT budget_periods_user_category_month_key UNIQUE (user_id, category_id, month),
  CONSTRAINT budget_periods_month_first_day CHECK (EXTRACT(DAY FROM month) = 1)
);

-- The unique constraint already indexes (user_id, category_id, month); this one serves
-- "every category for one month".
CREATE INDEX IF NOT EXISTS idx_budget_periods_user_month
  ON public.budget_periods (user_id, month);

ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'budget_periods'
      AND policyname = 'Users manage their own budget periods'
  ) THEN
    CREATE POLICY "Users manage their own budget periods" ON public.budget_periods
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at: update_updated_at_column() exists since the early migrations (051 uses it).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_budget_periods_updated_at'
      AND tgrelid = 'public.budget_periods'::regclass
  ) THEN
    CREATE TRIGGER update_budget_periods_updated_at
      BEFORE UPDATE ON public.budget_periods
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE public.budget_periods IS
  'Budget for one category in one month (plans/60). Months without a row use budget_categories.monthly_budget.';
COMMENT ON COLUMN public.budget_periods.rollover IS
  'Carry the previous month''s leftover (or overspend) into this month; stays on for later months until a later row turns it off.';

COMMIT;
