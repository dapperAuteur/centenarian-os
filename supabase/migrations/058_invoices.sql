-- 058_invoices.sql
-- Invoices & receivables system: track money owed to you and money you owe.
-- Supports line items, status tracking, due dates, and payment recording.

-- ── Invoices table ──────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- invoice or bill (receivable vs payable)
  direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable')),
  -- status workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  -- counterparty
  contact_name TEXT NOT NULL,
  contact_id UUID REFERENCES user_contacts(id) ON DELETE SET NULL,
  -- amounts (computed from line items, stored for fast queries)
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  -- references
  invoice_number TEXT,
  account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES user_brands(id) ON DELETE SET NULL,
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  -- linked transaction created when marked paid
  transaction_id UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON invoices (user_id, status);
CREATE INDEX ON invoices (user_id, direction);
CREATE INDEX ON invoices (user_id, due_date);

-- ── Invoice line items ──────────────────────────────────────────────────────
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX ON invoice_items (invoice_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_owner ON invoices
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY invoice_items_owner ON invoice_items
  FOR ALL USING (
    invoice_id IN (SELECT id FROM invoices WHERE user_id = auth.uid())
  );

-- ── Payment reminders view ──────────────────────────────────────────────────
-- Upcoming and overdue items: unpaid receivables past due + payable due dates
CREATE OR REPLACE VIEW payment_reminders AS
SELECT
  id,
  user_id,
  direction,
  status,
  contact_name,
  total,
  amount_paid,
  total - amount_paid AS balance_due,
  due_date,
  invoice_number,
  CASE
    WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', 'cancelled') THEN 'overdue'
    WHEN due_date <= CURRENT_DATE + INTERVAL '7 days' AND status NOT IN ('paid', 'cancelled') THEN 'due_soon'
    ELSE 'upcoming'
  END AS urgency
FROM invoices
WHERE status NOT IN ('paid', 'cancelled')
  AND due_date IS NOT NULL
ORDER BY due_date ASC;

-- ── Account due date reminders ──────────────────────────────────────────────
-- Credit card and loan accounts with due_date set
CREATE OR REPLACE VIEW account_due_reminders AS
SELECT
  id,
  user_id,
  name,
  account_type,
  due_date,
  monthly_fee,
  CASE
    WHEN due_date <= EXTRACT(DAY FROM CURRENT_DATE) THEN 'due_now'
    WHEN due_date <= EXTRACT(DAY FROM CURRENT_DATE) + 7 THEN 'due_soon'
    ELSE 'upcoming'
  END AS urgency
FROM financial_accounts
WHERE is_active = true
  AND account_type IN ('credit_card', 'loan')
  AND due_date IS NOT NULL;
