-- Invoice templates + template line items
-- Allows users to save reusable invoice templates

CREATE TABLE invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'receivable' CHECK (direction IN ('receivable', 'payable')),
  contact_name TEXT,
  contact_id UUID REFERENCES user_contacts(id) ON DELETE SET NULL,
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES user_brands(id) ON DELETE SET NULL,
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  notes TEXT,
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoice_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES invoice_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(10,2) DEFAULT 0,
  amount NUMERIC(10,2) DEFAULT 0,
  sort_order INT DEFAULT 0
);

-- RLS
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_templates_owner ON invoice_templates
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY invoice_template_items_owner ON invoice_template_items
  FOR ALL USING (
    template_id IN (SELECT id FROM invoice_templates WHERE user_id = auth.uid())
  );
