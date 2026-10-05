-- 201_deprecate_teller.sql
-- Marks the Teller bank-linking schema as deprecated. Comments only: no data and no structure
-- changes.
--
-- WHAT HAPPENED
-- Teller bank linking was removed from CentenarianOS in 2026-10 (routes, lib/teller.ts, the
-- Connect Bank / Sync UI). Bank transactions now come in through CSV import. CentenarianOS no
-- longer reads or writes the objects below, apart from clearUserData in lib/demo/seed.ts (the
-- demo reset), which still deletes that user's teller_enrollments rows.
--
-- WHY THE OBJECTS STAY
-- SHARED DB (contractor-os uses the same database): ADDITIVE ONLY. Tables and columns are never
-- dropped or renamed, so these are kept and labelled instead:
--   public.teller_enrollments                              (migration 097)
--   public.financial_accounts.teller_enrollment_id         (migration 097)
--   public.financial_accounts.teller_account_id            (migration 097)
--   public.financial_transactions.teller_transaction_id    (migration 098)
-- The 'bank_sync' value of financial_transactions.source also stays: historic rows keep it, and
-- the app shows it as "Bank import".
--
-- CREDENTIALS
-- scripts/teller-revoke-all.mjs revokes each enrollment at Teller and then overwrites
-- teller_enrollments.access_token with the literal string 'revoked' (the column is NOT NULL),
-- sets status to 'disconnected', and nulls the two financial_accounts link columns. This
-- migration does not do that and does not depend on it having run.
--
-- SAFE TO RE-RUN: COMMENT ON replaces any existing comment.

COMMENT ON TABLE public.teller_enrollments IS
  'Deprecated 2026-10: Teller bank linking was removed from CentenarianOS. Retained under the shared-database additive rule (never drop or rename). CentenarianOS no longer reads or writes it, except the demo reset. access_token values are overwritten with the literal ''revoked'' by scripts/teller-revoke-all.mjs.';

COMMENT ON COLUMN public.financial_accounts.teller_enrollment_id IS
  'Deprecated 2026-10: Teller removed. Retained under the shared-database additive rule. Nulled by scripts/teller-revoke-all.mjs when the enrollment token is overwritten with ''revoked''. Unused by CentenarianOS.';

COMMENT ON COLUMN public.financial_accounts.teller_account_id IS
  'Deprecated 2026-10: Teller removed. Retained under the shared-database additive rule. Nulled by scripts/teller-revoke-all.mjs when the enrollment token is overwritten with ''revoked''. Unused by CentenarianOS.';

COMMENT ON COLUMN public.financial_transactions.teller_transaction_id IS
  'Deprecated 2026-10: Teller removed. Retained under the shared-database additive rule. Holds the Teller transaction id on historic rows (source ''bank_sync'', or a manual/scan row a sync matched); enrollment tokens are overwritten with ''revoked''. Unused by CentenarianOS.';
