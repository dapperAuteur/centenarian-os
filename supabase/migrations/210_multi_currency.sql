-- 210_multi_currency.sql
-- Multi-currency finance: accounts in any currency (cash for travel first), a home currency per
-- user, transactions converted to the home currency at save, user-added currencies, and a cache of
-- exchange rates (fetched and manual).
--
-- OBJECTS
--   financial_accounts.currency       TEXT NOT NULL DEFAULT 'USD', ISO 4217 code. New named CHECK
--                                     financial_accounts_currency_format_check (^[A-Z]{3}$).
--                                     Existing rows become 'USD', which is what they always meant.
--   financial_transactions.currency   TEXT NULL. NULL = the account's currency (every existing row).
--   financial_transactions.fx_rate    NUMERIC(18,8) NULL. 1 unit of the row's currency in the user's
--                                     home currency, on the transaction date, at save time.
--   financial_transactions.amount_home NUMERIC(12,2) NULL. amount * fx_rate, rounded to cents; what
--                                     totals use. NULL = the row is already in the home currency
--                                     (every existing row), or no rate was available yet.
--   profiles.home_currency            TEXT NULL (shared table: nullable, no default; code reads NULL
--                                     as 'USD'). Not a protected column in migration 206's trigger,
--                                     so users can set their own. Named CHECK
--                                     profiles_home_currency_format_check (NULL or ^[A-Z]{3}$).
--   user_currencies                   Currencies a user added (any ISO-style code, including ones no
--                                     free rate source covers). Owner-only RLS.
--   exchange_rates                    Rate cache. Fetched rows (source frankfurter / open_er_api)
--                                     have user_id NULL and base 'USD', are shared by all users and
--                                     are written only by the service role. Manual rows
--                                     (source 'manual') belong to one user and win over fetched
--                                     rates for that user. 1 base = rate quote.
--
-- WHO WRITES WHAT
--   Fetched rates: lib/finance/fx/rates.ts with the service role (daily cron /api/cron/fx-rates and
--   the "Update rates now" button). Manual rates: the owner, through /api/finance/fx/rates.
--   Neither rate API is ever called from the browser.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): new nullable
-- columns, one NOT NULL column with a constant default, two new tables, new named CHECKs. Nothing
-- existing is dropped, renamed or narrowed; no existing CHECK is touched.
--
-- SAFE TO RE-RUN: IF NOT EXISTS everywhere, constraints and policies guarded by DO blocks.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied the app
-- treats every amount as the home currency (USD) and the currency screens answer
-- "Run migration 210 first". AFTER APPLYING, if that message persists: NOTIFY pgrst, 'reload schema';

BEGIN;

-- 1. Columns ------------------------------------------------------------------------------------

ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(18,8),
  ADD COLUMN IF NOT EXISTS amount_home NUMERIC(12,2);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_currency TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_accounts_currency_format_check') THEN
    ALTER TABLE public.financial_accounts
      ADD CONSTRAINT financial_accounts_currency_format_check CHECK (currency ~ '^[A-Z]{3}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_transactions_currency_format_check') THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_currency_format_check
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_transactions_fx_rate_positive_check') THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_fx_rate_positive_check CHECK (fx_rate IS NULL OR fx_rate > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_home_currency_format_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_home_currency_format_check
      CHECK (home_currency IS NULL OR home_currency ~ '^[A-Z]{3}$');
  END IF;
END $$;

-- 2. user_currencies ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_currencies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL
                CONSTRAINT user_currencies_user_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
  code        TEXT NOT NULL CONSTRAINT user_currencies_code_format_check CHECK (code ~ '^[A-Z]{3}$'),
  name        TEXT,
  symbol      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_currencies_user_code_key UNIQUE (user_id, code)
);

ALTER TABLE public.user_currencies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_currencies' AND policyname = 'user_currencies_owner'
  ) THEN
    CREATE POLICY user_currencies_owner ON public.user_currencies
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. exchange_rates -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID
                CONSTRAINT exchange_rates_user_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
  base        TEXT NOT NULL CONSTRAINT exchange_rates_base_format_check CHECK (base ~ '^[A-Z]{3}$'),
  quote       TEXT NOT NULL CONSTRAINT exchange_rates_quote_format_check CHECK (quote ~ '^[A-Z]{3}$'),
  rate        NUMERIC(18,8) NOT NULL CONSTRAINT exchange_rates_rate_positive_check CHECK (rate > 0),
  rate_date   DATE NOT NULL,
  source      TEXT NOT NULL
                CONSTRAINT exchange_rates_source_check CHECK (source IN ('frankfurter', 'open_er_api', 'manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Manual rows always have an owner; fetched rows never do.
  CONSTRAINT exchange_rates_owner_matches_source_check
    CHECK ((source = 'manual') = (user_id IS NOT NULL))
);

-- One rate per (owner or shared, pair, day, source).
CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_owner_pair_day_source_key
  ON public.exchange_rates (
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), base, quote, rate_date, source
  );

-- Lookups: "this pair on or before this date".
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_date
  ON public.exchange_rates (base, quote, rate_date DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_user
  ON public.exchange_rates (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Fetched (shared) rates: readable by any signed-in user. Manual rates: owner only.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exchange_rates' AND policyname = 'exchange_rates_read'
  ) THEN
    CREATE POLICY exchange_rates_read ON public.exchange_rates
      FOR SELECT
      TO authenticated
      USING (user_id IS NULL OR auth.uid() = user_id);
  END IF;

  -- Writes by a user: only their own manual rows. Fetched rows are written by the service role,
  -- which bypasses RLS.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exchange_rates' AND policyname = 'exchange_rates_owner_insert'
  ) THEN
    CREATE POLICY exchange_rates_owner_insert ON public.exchange_rates
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id AND source = 'manual');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exchange_rates' AND policyname = 'exchange_rates_owner_update'
  ) THEN
    CREATE POLICY exchange_rates_owner_update ON public.exchange_rates
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id AND source = 'manual')
      WITH CHECK (auth.uid() = user_id AND source = 'manual');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exchange_rates' AND policyname = 'exchange_rates_owner_delete'
  ) THEN
    CREATE POLICY exchange_rates_owner_delete ON public.exchange_rates
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id AND source = 'manual');
  END IF;
END $$;

COMMENT ON COLUMN public.financial_accounts.currency IS
  'ISO 4217 code of the account (CentenarianOS, migration 210). Balances are kept in this currency.';
COMMENT ON COLUMN public.financial_transactions.currency IS
  'ISO 4217 code of amount; NULL = the account''s currency (migration 210).';
COMMENT ON COLUMN public.financial_transactions.fx_rate IS
  '1 unit of the row''s currency in the user''s home currency on the transaction date, at save (migration 210).';
COMMENT ON COLUMN public.financial_transactions.amount_home IS
  'amount converted to the user''s home currency, rounded to cents; used for totals. NULL = already home currency (migration 210).';
COMMENT ON COLUMN public.profiles.home_currency IS
  'ISO 4217 code totals are reported in (CentenarianOS finance, migration 210). NULL = USD.';
COMMENT ON TABLE public.user_currencies IS
  'Currencies a user added to CentenarianOS finance, including ones no free rate source covers (migration 210).';
COMMENT ON TABLE public.exchange_rates IS
  'Exchange-rate cache (migration 210). 1 base = rate quote. Fetched rows: user_id NULL, base USD, shared, service-role writes. Manual rows: owner only; they win over fetched rates.';

COMMIT;
