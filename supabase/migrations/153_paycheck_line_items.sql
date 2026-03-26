-- 153_paycheck_line_items.sql
-- Line-item detail for paycheck reconciliation

BEGIN;

CREATE TABLE IF NOT EXISTS paycheck_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period_id UUID NOT NULL REFERENCES schedule_pay_periods(id) ON DELETE CASCADE,
  line_type     TEXT NOT NULL CHECK (line_type IN ('earning','tax','deduction','benefit')),
  description   TEXT NOT NULL,
  rate          NUMERIC(10,2),
  hours         NUMERIC(6,2),
  amount        NUMERIC(10,2) NOT NULL,
  ytd_amount    NUMERIC(12,2),
  is_pretax     BOOLEAN DEFAULT FALSE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paycheck_line_items_period
  ON paycheck_line_items(pay_period_id);

ALTER TABLE paycheck_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their paycheck line items" ON paycheck_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schedule_pay_periods pp
      JOIN schedule_templates st ON st.id = pp.template_id
      WHERE pp.id = paycheck_line_items.pay_period_id
      AND st.user_id = auth.uid()
    )
  );

-- Saved line item templates on schedule_template_finance
-- so user only enters descriptions once per job
ALTER TABLE schedule_template_finance
  ADD COLUMN IF NOT EXISTS line_item_templates JSONB DEFAULT '[]';
-- Format: [{line_type, description, rate?, hours?, is_pretax?}, ...]
-- Reused to pre-populate PaycheckReconcileModal each pay period

COMMENT ON COLUMN schedule_template_finance.line_item_templates
  IS 'Saved paycheck line item descriptions for reuse: [{line_type, description, rate, hours, is_pretax}]';

COMMIT;
