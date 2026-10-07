-- 220_bulk_edit_operations.sql
-- Undo for bulk edits of transactions (plans/63, section B: find similar and bulk edit).
--
-- PURPOSE
--   bulk_edit_operations       one row per bulk edit a person applied from the Transactions page
--                              (category, vendor name, type, brand, life category, tags, transfer
--                              unlink): a one-line summary, what was asked for (changes), how many
--                              rows it touched, and whether it has been undone.
--   bulk_edit_operation_rows   one row per transaction the edit actually changed: the values of the
--                              changed fields before (old_values) and after (new_values). Only fields
--                              whose value changed are stored. A life category's presence is stored as
--                              "life:<life_category_id>": true / false. group_key holds the transfer
--                              the edit unlinked the row from, so an undo links both sides back or neither.
--
--   Undo puts a row back only when every field still holds new_values (stored values are compared;
--   updated_at is never used, because financial_transactions has a trigger that moves it on every
--   update). Rows changed since are left alone and marked 'skipped'. The app keeps the 10 most recent
--   operations per person and deletes older ones (their rows go with them).
--
-- LINKS
--   Deleting the person deletes everything here. entity_id is not a foreign key: a transaction deleted
--   after the edit simply can't be put back, and its row stays as a record until the operation goes.
--
-- WHO CAN READ WHAT
--   Row Level Security is on. Owners can read and write their own rows (auth.uid() = user_id).
--   The policies are app-agnostic: they do not assume which app wrote the row.
--
-- ADDITIVE ONLY. SHARED DB (contractor-os / Work.WitUS uses the same database): this file creates two
-- new tables with their indexes and policies, and touches nothing that exists.
--
-- SAFE TO RE-RUN: CREATE ... IF NOT EXISTS, the policies sit in DO blocks that check first, and
-- ENABLE ROW LEVEL SECURITY / COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Until it is applied, bulk edits
-- still work but cannot be undone, and the Find similar panel says "Run migration 220 first".

BEGIN;

CREATE TABLE IF NOT EXISTS public.bulk_edit_operations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- What was edited. Only 'transaction' today.
  entity_type  TEXT NOT NULL DEFAULT 'transaction',
  -- "Category → Dining; Vendor → Chipotle", shown next to Undo.
  summary      TEXT,
  -- What the person asked for (category_id, vendor, type, tags_add, ...), not per-row values.
  changes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Rows recorded in bulk_edit_operation_rows, across every batch of the edit.
  row_count    INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'applied',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  undone_at    TIMESTAMPTZ,
  CONSTRAINT bulk_edit_operations_status_check CHECK (status IN ('applied', 'undone'))
);

CREATE INDEX IF NOT EXISTS idx_bulk_edit_operations_user
  ON public.bulk_edit_operations (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bulk_edit_operation_rows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id  UUID NOT NULL REFERENCES public.bulk_edit_operations(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The financial_transactions row (not a foreign key; see LINKS above).
  entity_id     UUID NOT NULL,
  -- The transfer_group_id the edit cleared, when it unlinked this row.
  group_key     TEXT,
  old_values    JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_values    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- applied: can still be undone; restored: undone; skipped: changed since, left alone.
  state         TEXT NOT NULL DEFAULT 'applied',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bulk_edit_operation_rows_state_check CHECK (state IN ('applied', 'restored', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_bulk_edit_operation_rows_operation
  ON public.bulk_edit_operation_rows (operation_id, state, id);
CREATE INDEX IF NOT EXISTS idx_bulk_edit_operation_rows_group
  ON public.bulk_edit_operation_rows (operation_id, group_key)
  WHERE group_key IS NOT NULL;

ALTER TABLE public.bulk_edit_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_edit_operation_rows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bulk_edit_operations'
      AND policyname = 'Users manage their own bulk edit operations'
  ) THEN
    CREATE POLICY "Users manage their own bulk edit operations" ON public.bulk_edit_operations
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bulk_edit_operation_rows'
      AND policyname = 'Users manage their own bulk edit operation rows'
  ) THEN
    CREATE POLICY "Users manage their own bulk edit operation rows" ON public.bulk_edit_operation_rows
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.bulk_edit_operations IS
  'Bulk edits of transactions that can be undone (the 10 most recent per person are kept).';
COMMENT ON TABLE public.bulk_edit_operation_rows IS
  'Per-transaction values a bulk edit changed: old_values before, new_values after. Undo compares new_values, never updated_at.';
COMMENT ON COLUMN public.bulk_edit_operation_rows.group_key IS
  'The transfer_group_id the edit cleared; undo links every row with this key back, or none of them.';

COMMIT;
