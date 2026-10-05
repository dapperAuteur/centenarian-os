-- 203_bank_csv_import.sql
-- Schema for the bank-statement CSV import (the replacement for Teller bank linking, removed in 201).
--
-- PURPOSE
--   1. import_batches: one row per statement import, so an import can be listed and undone.
--   2. financial_transactions.import_batch_id: which import inserted a row, or linked an existing
--      manual/scanned entry to a statement row.
--   3. financial_transactions.external_id: the statement row's identity ("bank:<the bank's id>" or
--      "hash:<date>|<cents>|<type>|<vendor key>|<n>", see lib/finance/csv-import/parse.ts). A partial
--      unique index on (user_id, account_id, external_id) makes importing the same statement twice
--      a no-op.
--   4. financial_transactions.transfer_kind: what kind of transfer a row is (a transfer between the
--      person's own accounts, a card payment, a loan payment). Created here; written by the transfer
--      tracking code, never by the import.
--   5. financial_accounts.csv_import_mapping: the column mapping, sign convention and date order
--      last used for that account's statements.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): nothing here drops,
-- renames or narrows anything. The new columns are nullable with no default, so existing rows and
-- every existing INSERT keep working unchanged.
--
-- NOT TOUCHED: financial_transactions_source_check. Imported rows keep source = 'csv_import', a
-- value that CHECK has allowed since migration 051.
--
-- SAFE TO RE-RUN: every statement is IF NOT EXISTS or guarded by a DO block.
--
-- AFTER APPLYING: if the app still answers "Run migration 203 first", PostgREST has not reloaded
-- its schema cache yet. Run:  NOTIFY pgrst, 'reload schema';

BEGIN;

-- ── 1. import_batches ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL
                    CONSTRAINT import_batches_user_id_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SET NULL, not CASCADE: deleting an account must not erase the record of what was imported.
  -- The constraint is named because the app's batch list embeds the account through it
  -- (financial_accounts!import_batches_account_id_fkey in lib/finance/csv-import/service.ts).
  account_id      UUID
                    CONSTRAINT import_batches_account_id_fkey REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  source          TEXT NOT NULL DEFAULT 'csv_import',
  file_name       TEXT,
  -- The bank layout the mapping started from (a BANK_PRESETS id, or 'generic').
  preset          TEXT,
  -- { mapping, sign, dateOrder, includePending } as used for this import.
  mapping         JSONB,
  row_count       INT NOT NULL DEFAULT 0,
  inserted_count  INT NOT NULL DEFAULT 0,
  linked_count    INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  invalid_count   INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'committed'
                    CONSTRAINT import_batches_status_check CHECK (status IN ('committed', 'undone')),
  undone_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user_created
  ON public.import_batches (user_id, created_at DESC);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Owner-only, and app-agnostic: the policy looks at the row's user_id and nothing else.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_batches' AND policyname = 'import_batches_owner'
  ) THEN
    CREATE POLICY import_batches_owner ON public.import_batches
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 2. financial_transactions: import tracking + transfer kind ──────────────────────────────────
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS import_batch_id UUID
    CONSTRAINT financial_transactions_import_batch_id_fkey REFERENCES public.import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS transfer_kind TEXT;

-- A NEW, separately named CHECK. It allows NULL, so every existing row passes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_transactions_transfer_kind_check'
      AND conrelid = 'public.financial_transactions'::regclass
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_transfer_kind_check
      CHECK (transfer_kind IS NULL OR transfer_kind IN ('transfer', 'card_payment', 'loan_payment'));
  END IF;
END $$;

-- One statement row per account. Partial: rows with no external id (everything that exists today)
-- and rows with no account are outside the index, so it cannot reject any existing data.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_account_external_id
  ON public.financial_transactions (user_id, account_id, external_id)
  WHERE external_id IS NOT NULL AND account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ft_import_batch
  ON public.financial_transactions (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

-- ── 3. financial_accounts: remembered statement mapping ─────────────────────────────────────────
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS csv_import_mapping JSONB;

-- ── 4. Comments ─────────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.import_batches IS
  'One row per bank-statement CSV import (CentenarianOS, migration 203). Counts are what the import did; status ''undone'' means its untouched rows were deleted and its linked rows unlinked.';

COMMENT ON COLUMN public.financial_transactions.import_batch_id IS
  'The import_batches row that inserted this transaction (source = ''csv_import'') or linked this manual/scanned entry to a statement row. NULL for everything else.';

COMMENT ON COLUMN public.financial_transactions.external_id IS
  'Identity of the statement row this transaction came from or was linked to: ''bank:<id>'' or ''hash:<date>|<cents>|<type>|<vendor key>|<n>''. Unique per (user_id, account_id) when set.';

COMMENT ON COLUMN public.financial_transactions.transfer_kind IS
  'transfer | card_payment | loan_payment, or NULL when the row is not a transfer. Written by transfer tracking, not by the CSV import.';

COMMENT ON COLUMN public.financial_accounts.csv_import_mapping IS
  'Saved statement-import settings for this account: { mapping, sign, dateOrder, includePending, preset }.';

COMMIT;
