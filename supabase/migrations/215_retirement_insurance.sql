-- 215_retirement_insurance.sql
-- Retirement accounts, life insurance policies and the retirement planner's settings (plans/61 §4).
--
-- PURPOSE
--   investment_accounts           one row per retirement or investment account (401(k), IRA, HSA,
--                                 brokerage, pension, annuity, whole-life cash value...). Kept apart
--                                 from financial_accounts on purpose (BAM, 2026-10-05): the shared
--                                 account_type CHECK on financial_accounts is not touched.
--                                 Holds what the planner needs: the contribution (a fixed amount per
--                                 pay period, or a percent of pay), the employer match rule (e.g.
--                                 100% of what you put in, up to 4% of pay, optionally capped per
--                                 year) and an optional expected yearly return for this account.
--   investment_balance_snapshots  the balance on a date, entered by hand (statement import may fill
--                                 it later). One per account per date; the latest one is the
--                                 account's current balance.
--   insurance_policies            life insurance: term or permanent, coverage, premium and how often
--                                 it is due, start and term-end dates, cash value for permanent
--                                 policies, beneficiaries as free text, and the budget category and/or
--                                 vendor the premium shows up as in transactions (used to match
--                                 premium payments). premium_tasks = also add the next premium due
--                                 date as a planner task under Inbox > Inbox > Bills.
--   retirement_plan_settings      one row per user: age (or birth year), retirement age, life
--                                 expectancy, desired yearly spending (an amount, or a multiple of
--                                 current spending), a Social Security estimate typed in by hand and
--                                 its start age, inflation, the three return presets and the 4%-style
--                                 withdrawal rate. NULL columns mean "use the app's default"; the
--                                 defaults are assumptions shown and editable on the page.
--
--   Nothing here computes or stores projections; lib/finance/retirement/logic.ts does that, and every
--   figure on the page is labeled an estimate, not financial advice.
--
-- WHO CAN READ WHAT
--   Row Level Security is on. Owners can read and write their own rows (auth.uid() = user_id).
--   The policies are app-agnostic: they do not assume which app wrote the row.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): this file creates
-- four new tables with their indexes, triggers and policies, and touches nothing that exists.
--
-- SAFE TO RE-RUN: CREATE ... IF NOT EXISTS; triggers and policies sit in DO blocks that check first;
-- ENABLE ROW LEVEL SECURITY and COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied the
-- Retirement and Insurance pages say "Run migration 215 first" and their APIs answer 503.

BEGIN;

-- ── investment_accounts ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.investment_accounts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind                        TEXT NOT NULL DEFAULT 'other',
  name                        TEXT NOT NULL,
  institution                 TEXT,
  last_four                   TEXT,
  currency                    TEXT NOT NULL DEFAULT 'USD',
  -- 'none' | 'amount' (contribution_amount each period) | 'percent' (contribution_percent of pay).
  contribution_type           TEXT NOT NULL DEFAULT 'none',
  contribution_amount         NUMERIC(12,2),
  contribution_percent        NUMERIC(6,3),
  contribution_frequency      TEXT NOT NULL DEFAULT 'monthly',
  -- Yearly pay the percent contribution and the match limit are figured on.
  annual_pay                  NUMERIC(14,2),
  -- Employer match: match_rate_percent of what you put in, on contributions up to
  -- match_limit_percent of pay, at most match_annual_cap per year. All NULL = no match.
  match_rate_percent          NUMERIC(6,3),
  match_limit_percent         NUMERIC(6,3),
  match_annual_cap            NUMERIC(12,2),
  -- Percent per year, nominal (before inflation). NULL = use the planner's selected preset.
  expected_annual_return      NUMERIC(6,3),
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT investment_accounts_kind_check CHECK (kind IN (
    '401k', '403b', '457b', 'traditional_ira', 'roth_ira', 'sep_ira', 'simple_ira', 'hsa',
    'brokerage', 'pension', 'annuity', 'whole_life_cash_value', 'other'
  )),
  CONSTRAINT investment_accounts_currency_format_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT investment_accounts_contribution_type_check
    CHECK (contribution_type IN ('none', 'amount', 'percent')),
  CONSTRAINT investment_accounts_contribution_frequency_check CHECK (contribution_frequency IN (
    'weekly', 'biweekly', 'semimonthly', 'monthly', 'quarterly', 'annually'
  )),
  CONSTRAINT investment_accounts_amounts_nonnegative CHECK (
    (contribution_amount IS NULL OR contribution_amount >= 0)
    AND (contribution_percent IS NULL OR (contribution_percent >= 0 AND contribution_percent <= 100))
    AND (annual_pay IS NULL OR annual_pay >= 0)
    AND (match_rate_percent IS NULL OR (match_rate_percent >= 0 AND match_rate_percent <= 1000))
    AND (match_limit_percent IS NULL OR (match_limit_percent >= 0 AND match_limit_percent <= 100))
    AND (match_annual_cap IS NULL OR match_annual_cap >= 0)
  ),
  CONSTRAINT investment_accounts_return_range
    CHECK (expected_annual_return IS NULL OR (expected_annual_return >= -50 AND expected_annual_return <= 50))
);

CREATE INDEX IF NOT EXISTS idx_investment_accounts_user
  ON public.investment_accounts (user_id, is_active);

-- ── investment_balance_snapshots ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.investment_balance_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID NOT NULL REFERENCES public.investment_accounts(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  as_of              DATE NOT NULL,
  balance            NUMERIC(14,2) NOT NULL,
  contributions_ytd  NUMERIC(14,2),
  note               TEXT,
  -- 'manual' today; a statement import can write 'statement' later.
  source             TEXT NOT NULL DEFAULT 'manual',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT investment_balance_snapshots_one_per_day UNIQUE (account_id, as_of),
  CONSTRAINT investment_balance_snapshots_source_check CHECK (source IN ('manual', 'statement'))
);

CREATE INDEX IF NOT EXISTS idx_investment_balance_snapshots_user
  ON public.investment_balance_snapshots (user_id, as_of);

-- ── insurance_policies ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.insurance_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind                  TEXT NOT NULL DEFAULT 'term_life',
  insurer               TEXT NOT NULL,
  policy_last_four      TEXT,
  currency              TEXT NOT NULL DEFAULT 'USD',
  coverage_amount       NUMERIC(14,2),
  premium_amount        NUMERIC(12,2),
  premium_frequency     TEXT NOT NULL DEFAULT 'monthly',
  start_date            DATE,
  term_end_date         DATE,
  -- Permanent policies (whole / universal life) only.
  cash_value            NUMERIC(14,2),
  cash_value_as_of      DATE,
  beneficiaries         TEXT,
  -- How premium payments show up in transactions: a budget category and/or a vendor name.
  premium_category_id   UUID REFERENCES public.budget_categories(id) ON DELETE SET NULL,
  premium_vendor        TEXT,
  premium_tasks         BOOLEAN NOT NULL DEFAULT false,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_policies_kind_check
    CHECK (kind IN ('term_life', 'whole_life', 'universal_life', 'other')),
  CONSTRAINT insurance_policies_premium_frequency_check
    CHECK (premium_frequency IN ('monthly', 'quarterly', 'semiannual', 'annual')),
  CONSTRAINT insurance_policies_currency_format_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT insurance_policies_amounts_nonnegative CHECK (
    (coverage_amount IS NULL OR coverage_amount >= 0)
    AND (premium_amount IS NULL OR premium_amount >= 0)
    AND (cash_value IS NULL OR cash_value >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_user
  ON public.insurance_policies (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_category
  ON public.insurance_policies (premium_category_id)
  WHERE premium_category_id IS NOT NULL;

-- ── retirement_plan_settings ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.retirement_plan_settings (
  user_id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Give one: birth_year (age follows the calendar) or current_age (as typed).
  birth_year                INT,
  current_age               INT,
  retirement_age            INT,
  life_expectancy           INT,
  -- 'amount' = desired_yearly_spending; 'multiple' = spending_multiple x current yearly spending.
  spending_mode             TEXT NOT NULL DEFAULT 'amount',
  desired_yearly_spending   NUMERIC(14,2),
  spending_multiple         NUMERIC(6,3),
  -- Typed in by hand from the person's own estimate, in today's dollars per month.
  social_security_monthly   NUMERIC(12,2),
  social_security_start_age INT,
  -- Percents per year.
  inflation_rate            NUMERIC(6,3),
  return_conservative       NUMERIC(6,3),
  return_middle             NUMERIC(6,3),
  return_optimistic         NUMERIC(6,3),
  selected_preset           TEXT NOT NULL DEFAULT 'middle',
  -- 'years' = yearly need x years in retirement; 'withdrawal_rate' = yearly need / withdrawal_rate.
  target_method             TEXT NOT NULL DEFAULT 'years',
  withdrawal_rate           NUMERIC(6,3),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT retirement_plan_settings_spending_mode_check CHECK (spending_mode IN ('amount', 'multiple')),
  CONSTRAINT retirement_plan_settings_preset_check
    CHECK (selected_preset IN ('conservative', 'middle', 'optimistic')),
  CONSTRAINT retirement_plan_settings_target_method_check
    CHECK (target_method IN ('years', 'withdrawal_rate')),
  CONSTRAINT retirement_plan_settings_ages_range CHECK (
    (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2100))
    AND (current_age IS NULL OR (current_age BETWEEN 0 AND 120))
    AND (retirement_age IS NULL OR (retirement_age BETWEEN 0 AND 120))
    AND (life_expectancy IS NULL OR (life_expectancy BETWEEN 0 AND 130))
    AND (social_security_start_age IS NULL OR (social_security_start_age BETWEEN 0 AND 120))
  )
);

-- ── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE public.investment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retirement_plan_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'investment_accounts'
      AND policyname = 'Users manage their own investment accounts'
  ) THEN
    CREATE POLICY "Users manage their own investment accounts" ON public.investment_accounts
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'investment_balance_snapshots'
      AND policyname = 'Users manage their own investment balance snapshots'
  ) THEN
    CREATE POLICY "Users manage their own investment balance snapshots" ON public.investment_balance_snapshots
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'insurance_policies'
      AND policyname = 'Users manage their own insurance policies'
  ) THEN
    CREATE POLICY "Users manage their own insurance policies" ON public.insurance_policies
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'retirement_plan_settings'
      AND policyname = 'Users manage their own retirement plan settings'
  ) THEN
    CREATE POLICY "Users manage their own retirement plan settings" ON public.retirement_plan_settings
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── updated_at triggers (update_updated_at_column() exists since migration 051) ──

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'investment_accounts', 'investment_balance_snapshots', 'insurance_policies', 'retirement_plan_settings'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'update_' || t || '_updated_at'
        AND tgrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
        'update_' || t || '_updated_at', t
      );
    END IF;
  END LOOP;
END $$;

-- ── Comments ────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.investment_accounts IS
  'Retirement / investment account (401k, IRA, HSA, brokerage, pension...) for the retirement planner (CentenarianOS, plans/61 §4). Separate from financial_accounts on purpose.';
COMMENT ON COLUMN public.investment_accounts.match_rate_percent IS
  'Employer match: this percent of what the person contributes, on contributions up to match_limit_percent of annual_pay, at most match_annual_cap per year.';
COMMENT ON COLUMN public.investment_accounts.expected_annual_return IS
  'Nominal percent per year the person expects for this account. NULL = the planner''s selected preset. An assumption, not a forecast.';
COMMENT ON TABLE public.investment_balance_snapshots IS
  'Balance of an investment account on a date (one per account per date). Entered by hand; source = statement is reserved for a later statement import.';
COMMENT ON TABLE public.insurance_policies IS
  'Life insurance policy (term or permanent). premium_category_id / premium_vendor match premium payments in financial_transactions; premium_tasks adds the next due date under Inbox > Inbox > Bills (tasks.source_type = ''insurance_premium'', tasks.source_id = this id).';
COMMENT ON TABLE public.retirement_plan_settings IS
  'Retirement planner inputs per user. NULL columns mean the app default (an assumption shown and editable on the page).';

COMMIT;
