-- 219_finance_review_import_drafts.sql
-- The finance Review page and saved statement imports (plans/63, section A).
--
-- PURPOSE
--   1. import_drafts: a statement import the person reviewed but has not finished. The review
--      step saves it as they go, so they can leave and "Resume import" later from the Import
--      page or the Review page. Importing it or discarding it deletes the row.
--      What is kept: the statement's rows as the SERVER's parser normalized them (date, cents,
--      direction, description, vendor, bank id...), the rows it could not read, the column
--      settings, the person's choices per row, and for a PDF the statement summary (period,
--      totals, APRs, promotional balances). The raw file (CSV text or PDF bytes) is NEVER stored.
--      Resuming plans the saved rows again against the transactions as they are then, so
--      duplicates and matches are always checked against current data.
--      A draft expires 30 days after it was last saved (expires_at). The app deletes a person's
--      expired drafts whenever it lists them; where pg_cron is installed, a nightly job (set up
--      at the end of this file) deletes everyone's.
--   2. finance_review_dismissals: "not a transfer" / "not a payment" / "not the same purchase"
--      answers from the Review page and the Possible transfers panel, so a suggestion the person
--      turned down is never offered again, on any device. Before this table those answers were
--      kept only in the browser (localStorage).
--      section: 'transfer_pair'       two rows suggested as the two sides of one transfer
--                                     (transaction_id = the expense side, other = the income side)
--               'one_sided_payment'   a card or loan payment with no other side (transaction_id)
--               'possible_match'      an imported row and an entry the person made that look like
--                                     the same purchase (transaction_id = the imported row,
--                                     other = the entry)
--      Deleting either transaction deletes the dismissal.
--
-- SIZE CAP
--   The importer takes at most 5,000 rows and 4,000,000 characters per file
--   (lib/finance/csv-import/commit.ts MAX_IMPORT_ROWS, service.ts MAX_CSV_CHARS). The app refuses
--   to save a draft past those limits; the CHECKs below are the database's backstop (5,000 rows,
--   8,000,000 bytes of JSON in total, which leaves room for the choices and the summary).
--
-- WHO CAN READ WHAT
--   Row Level Security is on for both tables. Owners read and write their own rows
--   (auth.uid() = user_id), and a row can only point at the owner's own account or transactions.
--   The policies are app-agnostic: they do not assume which app wrote the row.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): this file creates
-- two new tables with their indexes and policies, and touches nothing that exists.
--
-- SAFE TO RE-RUN: CREATE ... IF NOT EXISTS, constraints and policies are added in DO blocks that
-- check first, the pg_cron job is created only when pg_cron exists and the job doesn't, and
-- ENABLE ROW LEVEL SECURITY / COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied the Review
-- page and the Import page say "Run migration 219 first": statements still import, but a review
-- can't be saved for later and "Not a transfer" is remembered in the browser only.
--
-- AFTER APPLYING: if the app still says "Run migration 219 first", PostgREST has not reloaded its
-- schema cache yet. Run:  NOTIFY pgrst, 'reload schema';

BEGIN;

-- ── 1. import_drafts ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_drafts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The account the statement is being imported into. Deleting the account deletes the draft.
  account_id    UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  -- 'csv' or 'pdf': which reader produced the rows.
  source        TEXT NOT NULL,
  file_name     TEXT,
  -- CSV: { mapping, sign, dateOrder, includePending, preset, remember }. PDF: { preset }.
  mapping       JSONB,
  -- NormalizedRow[] (lib/finance/csv-import/types.ts), as the server's parser produced them.
  rows          JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Rows the parser could not read, and rows the layout leaves out: [{ row, reason }].
  rejected      JSONB NOT NULL DEFAULT '[]'::jsonb,
  skipped       JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- The person's choices by spreadsheet row number (the review step's Decisions).
  decisions     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Choices for the whole review: { recordMissing, confirmUnreconciled }.
  options       JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { file, statuses }: what the review step shows about the file (headers, warnings, row count),
  -- and each row's status when saved, so resuming can say how many rows changed since.
  file_summary  JSONB,
  -- PDF only: the statement summary (issuer, period, totals, APRs, promotions). Never the file.
  statement     JSONB,
  row_count     INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 30 days after the last save. The app moves it forward on every save.
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_drafts_source_check') THEN
    ALTER TABLE public.import_drafts
      ADD CONSTRAINT import_drafts_source_check CHECK (source IN ('csv', 'pdf'));
  END IF;
  -- CASE, not AND: jsonb_array_length() raises on a non-array, and AND does not promise an order.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_drafts_rows_cap') THEN
    ALTER TABLE public.import_drafts
      ADD CONSTRAINT import_drafts_rows_cap CHECK (
        CASE WHEN jsonb_typeof(rows) = 'array' THEN jsonb_array_length(rows) <= 5000 ELSE false END
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_drafts_size_cap') THEN
    ALTER TABLE public.import_drafts
      ADD CONSTRAINT import_drafts_size_cap CHECK (
        octet_length(rows::text) + octet_length(rejected::text) + octet_length(skipped::text)
          + octet_length(decisions::text) + octet_length(COALESCE(statement::text, '')) <= 8000000
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_import_drafts_user_updated
  ON public.import_drafts (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_drafts_expires
  ON public.import_drafts (expires_at);

ALTER TABLE public.import_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_drafts'
      AND policyname = 'Users manage their own import drafts'
  ) THEN
    CREATE POLICY "Users manage their own import drafts" ON public.import_drafts
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.financial_accounts a
          WHERE a.id = import_drafts.account_id AND a.user_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMENT ON TABLE public.import_drafts IS
  'Statement imports reviewed but not finished: the server-normalized rows, the choices per row and (PDF) the statement summary. Never the raw file. Deleted on import or discard; expires 30 days after the last save.';
COMMENT ON COLUMN public.import_drafts.rows IS
  'NormalizedRow[] from the server''s CSV or PDF reader. Planned again against current data on resume.';
COMMENT ON COLUMN public.import_drafts.decisions IS
  'The review step''s choices by spreadsheet row number: action, type, category, card kind, transfer account.';
COMMENT ON COLUMN public.import_drafts.expires_at IS
  '30 days after the last save. Expired drafts are deleted when the owner''s drafts are listed, and nightly where pg_cron exists.';

-- ── 2. finance_review_dismissals ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finance_review_dismissals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section               TEXT NOT NULL,
  transaction_id        UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  other_transaction_id  UUID REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_review_dismissals_section_check') THEN
    ALTER TABLE public.finance_review_dismissals
      ADD CONSTRAINT finance_review_dismissals_section_check
      CHECK (section IN ('transfer_pair', 'one_sided_payment', 'possible_match'));
  END IF;
END $$;

-- One answer per suggestion. COALESCE so a one-row suggestion (no other transaction) is unique too.
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_review_dismissals_unique
  ON public.finance_review_dismissals (
    user_id, section, transaction_id,
    COALESCE(other_transaction_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
-- ON DELETE CASCADE from the other side looks rows up by it.
CREATE INDEX IF NOT EXISTS idx_finance_review_dismissals_other
  ON public.finance_review_dismissals (other_transaction_id)
  WHERE other_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_finance_review_dismissals_transaction
  ON public.finance_review_dismissals (transaction_id);

ALTER TABLE public.finance_review_dismissals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'finance_review_dismissals'
      AND policyname = 'Users manage their own review dismissals'
  ) THEN
    CREATE POLICY "Users manage their own review dismissals" ON public.finance_review_dismissals
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1 FROM public.financial_transactions t
          WHERE t.id = finance_review_dismissals.transaction_id AND t.user_id = auth.uid()
        )
        AND (
          finance_review_dismissals.other_transaction_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.financial_transactions o
            WHERE o.id = finance_review_dismissals.other_transaction_id AND o.user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

COMMENT ON TABLE public.finance_review_dismissals IS
  'Suggestions the person turned down on the finance Review page or the Possible transfers panel: transfer_pair, one_sided_payment, possible_match.';

COMMIT;

-- ── 3. Nightly clean-up of expired drafts, only where pg_cron is installed ──────────────────────
-- Outside the transaction: pg_cron's schedule() works on its own tables. Skipped quietly without
-- pg_cron (the app still deletes a person's expired drafts whenever it lists them). Dynamic SQL,
-- because a database without pg_cron has no cron schema for a static reference to resolve.
DO $$
DECLARE
  job_exists BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)'
      INTO job_exists
      USING 'centos-expire-import-drafts';
    IF NOT job_exists THEN
      EXECUTE $cmd$
        SELECT cron.schedule(
          'centos-expire-import-drafts',
          '20 3 * * *',
          'DELETE FROM public.import_drafts WHERE expires_at < now()'
        )
      $cmd$;
    END IF;
  END IF;
END $$;
