-- 051_financial_dashboard.sql
-- Phase 8: Budget tracking, financial transactions, CSV import/export

-- Budget categories (user-defined, with optional monthly budget)
CREATE TABLE IF NOT EXISTS public.budget_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  monthly_budget NUMERIC(10,2),
  color         TEXT DEFAULT '#6366f1',
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Financial transactions (expenses + income in one table)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id       UUID REFERENCES public.budget_categories(id) ON DELETE SET NULL,
  amount            NUMERIC(10,2) NOT NULL,
  type              TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  description       TEXT,
  vendor            TEXT,
  transaction_date  DATE NOT NULL,
  source            TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'csv_import', 'stripe')),
  tags              TEXT[],
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_budget_categories_user ON public.budget_categories(user_id);
CREATE INDEX idx_financial_transactions_user ON public.financial_transactions(user_id);
CREATE INDEX idx_financial_transactions_category ON public.financial_transactions(category_id);
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(transaction_date);
CREATE INDEX idx_financial_transactions_type ON public.financial_transactions(type);

-- RLS
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their budget categories" ON public.budget_categories
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their financial transactions" ON public.financial_transactions
  FOR ALL USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_financial_transactions_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default categories for new signups (optional — these are just suggestions)
-- Users create their own categories via the UI; no per-user seeding needed.
