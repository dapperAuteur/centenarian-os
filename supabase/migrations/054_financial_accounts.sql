-- 054_financial_accounts.sql
-- Adds financial accounts (checking, savings, credit card, loan, cash) so that
-- transactions can be assigned to specific accounts. Balance is computed as
-- opening_balance + SUM(income) - SUM(expenses) for the account.

CREATE TABLE financial_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  account_type     TEXT NOT NULL CHECK (account_type IN (
                     'checking', 'savings', 'credit_card', 'loan', 'cash'
                   )),
  institution_name TEXT,
  last_four        CHAR(4),
  interest_rate    NUMERIC(5,2),
  credit_limit     NUMERIC(10,2),
  opening_balance  NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_fee      NUMERIC(10,2),
  due_date         INT CHECK (due_date BETWEEN 1 AND 28),
  statement_date   INT CHECK (statement_date BETWEEN 1 AND 28),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON financial_accounts (user_id);

ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own financial accounts"
  ON financial_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add account FK to transactions (nullable — existing transactions unaffected)
ALTER TABLE financial_transactions
  ADD COLUMN account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL;

CREATE INDEX ON financial_transactions (account_id);
