-- 218_financial_account_nickname.sql
-- A short nickname per finance account, set on Finance → Accounts. Google Calendar event titles
-- name an account with it ("Dinner #expense $40 @visa"), next to the account's last four digits
-- ("@1234"). See lib/finance/account-nickname.ts and lib/capture/calendar-accounts.ts.
--
-- Additive and idempotent: one nullable column, one CHECK, one partial unique index. Existing rows
-- keep nickname NULL, so the index builds cleanly.
--   format  starts with a letter (so it never looks like last four digits), then letters, digits,
--           - or _, at most 20 characters. The API trims it and drops a leading "@" first.
--   unique  per user among ACTIVE accounts, case-insensitive. A closed account keeps its nickname
--           without blocking it; reactivating it is refused by the API while the name is taken.

ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS nickname TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_accounts_nickname_format'
      AND conrelid = 'public.financial_accounts'::regclass
  ) THEN
    ALTER TABLE public.financial_accounts
      ADD CONSTRAINT financial_accounts_nickname_format
      CHECK (nickname IS NULL OR nickname ~ '^[A-Za-z][A-Za-z0-9_-]{0,19}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS financial_accounts_user_nickname_active_key
  ON public.financial_accounts (user_id, lower(nickname))
  WHERE nickname IS NOT NULL AND is_active;

COMMENT ON COLUMN public.financial_accounts.nickname IS
  'Short name used in Google Calendar event titles as @nickname. Unique per user among active accounts, case-insensitive.';
