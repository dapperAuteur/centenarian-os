-- supabase/migrations/017_financial_tracking.sql
-- This is the FINAL schema, not an example

-- Expense categories (predefined + user-defined)
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES expense_categories(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT FALSE, -- System categories can't be deleted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Income categories
CREATE TABLE income_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES income_categories(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL CHECK (amount > 0),
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  vendor TEXT,
  
  -- Dates
  incurred_date DATE NOT NULL,
  due_date DATE,
  paid_date DATE,
  
  -- Recurring
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSONB, -- Same pattern as recurring_tasks
  
  -- Linking
  linked_roadmap_id UUID REFERENCES roadmaps(id) ON DELETE SET NULL,
  linked_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  linked_milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  
  -- Tags
  tags TEXT[],
  
  -- Metadata
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Income
CREATE TABLE income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL CHECK (amount > 0),
  category_id UUID REFERENCES income_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL,
  
  -- Dates
  earned_date DATE NOT NULL,
  received_date DATE,
  expected_received_date DATE,
  
  -- Invoice Status
  invoice_number TEXT,
  invoice_sent BOOLEAN DEFAULT FALSE,
  invoice_sent_date DATE,
  invoice_paid BOOLEAN DEFAULT FALSE,
  
  -- Recurring
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSONB,
  
  -- Linking
  linked_roadmap_id UUID REFERENCES roadmaps(id) ON DELETE SET NULL,
  linked_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  linked_milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  linked_session_id UUID REFERENCES focus_sessions(id) ON DELETE SET NULL,
  
  -- Tags
  tags TEXT[],
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_incurred_date ON expenses(incurred_date);
CREATE INDEX idx_expenses_recurring ON expenses(is_recurring) WHERE is_recurring = TRUE;
CREATE INDEX idx_expenses_tags ON expenses USING GIN(tags);

CREATE INDEX idx_income_user ON income(user_id);
CREATE INDEX idx_income_category ON income(category_id);
CREATE INDEX idx_income_earned_date ON income(earned_date);
CREATE INDEX idx_income_received_date ON income(received_date);
CREATE INDEX idx_income_recurring ON income(is_recurring) WHERE is_recurring = TRUE;
CREATE INDEX idx_income_invoice_status ON income(invoice_sent, invoice_paid);
CREATE INDEX idx_income_tags ON income USING GIN(tags);

CREATE INDEX idx_expense_categories_user ON expense_categories(user_id);
CREATE INDEX idx_income_categories_user ON income_categories(user_id);

-- RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their expense categories" ON expense_categories
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their income categories" ON income_categories
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their expenses" ON expenses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their income" ON income
  FOR ALL USING (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_income_updated_at BEFORE UPDATE ON income
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- System Categories (Predefined)
INSERT INTO expense_categories (user_id, name, is_system) 
SELECT id, 'Software & Tools', TRUE FROM auth.users;

INSERT INTO expense_categories (user_id, name, is_system)
SELECT id, 'Equipment & Hardware', TRUE FROM auth.users;

INSERT INTO expense_categories (user_id, name, is_system)
SELECT id, 'Marketing & Advertising', TRUE FROM auth.users;

INSERT INTO expense_categories (user_id, name, is_system)
SELECT id, 'Office & Supplies', TRUE FROM auth.users;

INSERT INTO expense_categories (user_id, name, is_system)
SELECT id, 'Professional Services', TRUE FROM auth.users;

INSERT INTO expense_categories (user_id, name, is_system)
SELECT id, 'Travel & Transportation', TRUE FROM auth.users;

INSERT INTO expense_categories (user_id, name, is_system)
SELECT id, 'Meals & Entertainment', TRUE FROM auth.users;

INSERT INTO expense_categories (user_id, name, is_system)
SELECT id, 'Utilities', TRUE FROM auth.users;

INSERT INTO expense_categories (user_id, name, is_system)
SELECT id, 'Other', TRUE FROM auth.users;

INSERT INTO income_categories (user_id, name, is_system)
SELECT id, 'Client Work', TRUE FROM auth.users;

INSERT INTO income_categories (user_id, name, is_system)
SELECT id, 'Salary', TRUE FROM auth.users;

INSERT INTO income_categories (user_id, name, is_system)
SELECT id, 'Freelance', TRUE FROM auth.users;

INSERT INTO income_categories (user_id, name, is_system)
SELECT id, 'Investments', TRUE FROM auth.users;

INSERT INTO income_categories (user_id, name, is_system)
SELECT id, 'Consulting', TRUE FROM auth.users;

INSERT INTO income_categories (user_id, name, is_system)
SELECT id, 'Products', TRUE FROM auth.users;

INSERT INTO income_categories (user_id, name, is_system)
SELECT id, 'Other', TRUE FROM auth.users;

-- Views for financial reporting
CREATE VIEW financial_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', incurred_date) as month,
  SUM(amount) as total_expenses
FROM expenses
WHERE paid_date IS NOT NULL
GROUP BY user_id, DATE_TRUNC('month', incurred_date)

UNION ALL

SELECT
  user_id,
  DATE_TRUNC('month', received_date) as month,
  -SUM(amount) as total_income
FROM income
WHERE received_date IS NOT NULL
GROUP BY user_id, DATE_TRUNC('month', received_date);
