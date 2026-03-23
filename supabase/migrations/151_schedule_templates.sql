-- 151_schedule_templates.sql
-- Unified schedule templates system: work, fitness, class, custom
-- Also upgrades recurring task generation with weekInterval support

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. Schedule Templates
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schedule_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  template_type       TEXT NOT NULL CHECK (template_type IN ('work','fitness','class','custom')),
  schedule_days       INT[] NOT NULL,            -- [0-6], 0=Sun matches EXTRACT(DOW)
  week_interval       INT NOT NULL DEFAULT 1,    -- every N weeks
  start_date          DATE,
  end_date            DATE,                      -- NULL = indefinite
  time_start          TIME,
  time_end            TIME,
  milestone_id        UUID REFERENCES milestones(id) ON DELETE SET NULL,
  tag                 TEXT,
  priority            INT DEFAULT 2 CHECK (priority IN (1, 2, 3)),
  is_active           BOOLEAN DEFAULT TRUE,
  last_generated_date DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_user ON schedule_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_active
  ON schedule_templates(is_active) WHERE is_active = TRUE;

ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their schedule templates" ON schedule_templates
  FOR ALL USING (user_id = auth.uid());

CREATE TRIGGER update_schedule_templates_updated_at
  BEFORE UPDATE ON schedule_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════
-- 2. Schedule Template Finance (work-type financial details)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schedule_template_finance (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id             UUID NOT NULL UNIQUE REFERENCES schedule_templates(id) ON DELETE CASCADE,
  employment_type         TEXT NOT NULL CHECK (employment_type IN ('w2','1099','other')),
  pay_rate                NUMERIC(10,2) NOT NULL,
  rate_type               TEXT DEFAULT 'daily' CHECK (rate_type IN ('hourly','daily','flat')),
  hours_per_day           NUMERIC(4,1),
  pay_frequency           TEXT NOT NULL CHECK (pay_frequency IN ('weekly','biweekly','semimonthly','monthly')),
  payday_anchor           DATE NOT NULL,
  pay_account_id          UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
  pay_category_id         UUID REFERENCES budget_categories(id) ON DELETE SET NULL,

  -- Tax fields
  estimated_tax_rate      NUMERIC(5,2),
  estimated_tax_amount    NUMERIC(10,2),
  tax_tracking_method     TEXT DEFAULT 'none' CHECK (tax_tracking_method IN ('percentage','flat','none')),

  -- Per diem & travel
  per_diem_amount         NUMERIC(10,2),
  per_diem_category_id    UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  travel_income_amount    NUMERIC(10,2),
  travel_category_id      UUID REFERENCES budget_categories(id) ON DELETE SET NULL,

  -- Deductions (reuses benefit_deductions pattern from contractor_jobs)
  deductions              JSONB DEFAULT '[]',    -- [{label, amount, is_pretax}]

  -- Independent contractor (1099) fields
  quarterly_tax_account_id UUID REFERENCES financial_accounts(id) ON DELETE SET NULL,
  set_aside_percentage    NUMERIC(5,2),

  -- Invoice integration
  auto_invoice            BOOLEAN DEFAULT FALSE,
  invoice_template_id     UUID REFERENCES invoice_templates(id) ON DELETE SET NULL,
  invoice_contact_id      UUID REFERENCES user_contacts(id) ON DELETE SET NULL
);

ALTER TABLE schedule_template_finance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their schedule finance" ON schedule_template_finance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schedule_templates
      WHERE schedule_templates.id = schedule_template_finance.template_id
      AND schedule_templates.user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════
-- 3. Schedule Exceptions (day-off, skip, reschedule)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         UUID NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  exception_date      DATE NOT NULL,
  exception_type      TEXT NOT NULL CHECK (exception_type IN ('skip','paid_off','unpaid_off','reschedule')),
  reason              TEXT,                      -- sick, vacation, holiday, personal, other
  notes               TEXT,
  override_time_start TIME,                      -- for reschedule
  override_time_end   TIME,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, exception_date)
);

CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_template
  ON schedule_exceptions(template_id);
CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_date
  ON schedule_exceptions(exception_date);

ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their schedule exceptions" ON schedule_exceptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schedule_templates
      WHERE schedule_templates.id = schedule_exceptions.template_id
      AND schedule_templates.user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════
-- 4. Schedule Pay Periods (estimated vs actual tracking)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schedule_pay_periods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         UUID NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  days_scheduled      INT NOT NULL,
  days_worked         INT NOT NULL,
  days_paid_off       INT DEFAULT 0,
  days_unpaid_off     INT DEFAULT 0,
  estimated_gross     NUMERIC(10,2),
  estimated_taxes     NUMERIC(10,2),
  estimated_net       NUMERIC(10,2),
  actual_gross        NUMERIC(10,2),
  actual_taxes        NUMERIC(10,2),
  actual_net          NUMERIC(10,2),
  per_diem_total      NUMERIC(10,2),
  travel_income_total NUMERIC(10,2),
  transaction_id      UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  tax_transaction_id  UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  is_reconciled       BOOLEAN DEFAULT FALSE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_schedule_pay_periods_template
  ON schedule_pay_periods(template_id);

ALTER TABLE schedule_pay_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their schedule pay periods" ON schedule_pay_periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schedule_templates
      WHERE schedule_templates.id = schedule_pay_periods.template_id
      AND schedule_templates.user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════
-- 5. Schedule Expenses (job-related expense linking)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS schedule_expenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         UUID NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  transaction_id      UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
  expense_date        DATE NOT NULL,
  description         TEXT,
  is_deductible       BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_expenses_template
  ON schedule_expenses(template_id);

ALTER TABLE schedule_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their schedule expenses" ON schedule_expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schedule_templates
      WHERE schedule_templates.id = schedule_expenses.template_id
      AND schedule_templates.user_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════
-- 6. Expand financial_transactions source CHECK to include 'schedule'
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_check;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_source_check
    CHECK (source IN ('manual','csv_import','stripe','fuel_log','vehicle_maintenance','trip','transfer','interest','recurring','scan','bank_sync','job','schedule'));

-- Expand source_module CHECK
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_module_check;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_source_module_check
    CHECK (source_module IS NULL OR source_module IN ('fuel_log','vehicle_maintenance','trip','scan','job','schedule'));


-- ═══════════════════════════════════════════════════════════════════
-- 7. Expand activity_links + entity_life_categories for 'schedule'
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.activity_links
  DROP CONSTRAINT IF EXISTS activity_links_source_type_check;
ALTER TABLE public.activity_links
  ADD CONSTRAINT activity_links_source_type_check
    CHECK (source_type IN (
      'task','trip','route','transaction','recipe',
      'fuel_log','maintenance','invoice','workout','equipment',
      'focus_session','exercise','daily_log','job',
      'media_item','podcast_episode','blog_post','schedule'
    ));

ALTER TABLE public.activity_links
  DROP CONSTRAINT IF EXISTS activity_links_target_type_check;
ALTER TABLE public.activity_links
  ADD CONSTRAINT activity_links_target_type_check
    CHECK (target_type IN (
      'task','trip','route','transaction','recipe',
      'fuel_log','maintenance','invoice','workout','equipment',
      'focus_session','exercise','daily_log','job',
      'media_item','podcast_episode','blog_post','schedule'
    ));

ALTER TABLE public.entity_life_categories
  DROP CONSTRAINT IF EXISTS entity_life_categories_entity_type_check;
ALTER TABLE public.entity_life_categories
  ADD CONSTRAINT entity_life_categories_entity_type_check
    CHECK (entity_type IN (
      'task','trip','route','transaction','recipe',
      'fuel_log','maintenance','invoice','workout','equipment',
      'focus_session','exercise','daily_log','job',
      'media_item','podcast_episode','blog_post','schedule'
    ));


-- ═══════════════════════════════════════════════════════════════════
-- 8. Updated generate_recurring_tasks with weekInterval support
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_recurring_tasks(
  p_recurring_task_id UUID,
  p_target_date DATE
) RETURNS VOID AS $$
DECLARE
  v_recurring recurring_tasks;
  v_should_create BOOLEAN;
  v_week_interval INT;
  v_anchor_date DATE;
  v_weeks_since INT;
BEGIN
  SELECT * INTO v_recurring FROM recurring_tasks WHERE id = p_recurring_task_id;

  IF NOT FOUND OR NOT v_recurring.is_active THEN
    RETURN;
  END IF;

  -- Check end date
  IF (v_recurring.pattern->>'endDate') IS NOT NULL
     AND p_target_date > (v_recurring.pattern->>'endDate')::DATE THEN
    RETURN;
  END IF;

  -- Check if already generated for this date
  IF v_recurring.last_generated_date >= p_target_date THEN
    RETURN;
  END IF;

  v_should_create := FALSE;

  IF v_recurring.pattern->>'type' = 'daily' THEN
    v_should_create := TRUE;

  ELSIF v_recurring.pattern->>'type' = 'weekly' THEN
    -- Check day of week matches
    IF (v_recurring.pattern->'daysOfWeek')::jsonb ? EXTRACT(DOW FROM p_target_date)::TEXT THEN
      -- Check week interval (default 1 = every week)
      v_week_interval := COALESCE((v_recurring.pattern->>'weekInterval')::INT, 1);
      IF v_week_interval <= 1 THEN
        v_should_create := TRUE;
      ELSE
        -- Anchor to creation date to determine which weeks are active
        v_anchor_date := v_recurring.created_at::DATE;
        -- Calculate weeks since anchor, check if divisible by interval
        v_weeks_since := (p_target_date - v_anchor_date) / 7;
        IF v_weeks_since % v_week_interval = 0 THEN
          v_should_create := TRUE;
        END IF;
      END IF;
    END IF;

  ELSIF v_recurring.pattern->>'type' = 'biweekly' THEN
    -- Legacy biweekly support (equivalent to weekly with weekInterval=2)
    IF v_recurring.last_generated_date IS NULL
       OR p_target_date - v_recurring.last_generated_date >= 14 THEN
      v_should_create := TRUE;
    END IF;

  ELSIF v_recurring.pattern->>'type' = 'monthly' THEN
    IF EXTRACT(DAY FROM p_target_date) = (v_recurring.pattern->>'dayOfMonth')::INT THEN
      v_should_create := TRUE;
    END IF;

  ELSIF v_recurring.pattern->>'type' = 'custom' THEN
    IF v_recurring.last_generated_date IS NULL
       OR p_target_date - v_recurring.last_generated_date >= (v_recurring.pattern->>'interval')::INT THEN
      v_should_create := TRUE;
    END IF;
  END IF;

  IF v_should_create THEN
    INSERT INTO tasks (
      milestone_id,
      date,
      time,
      activity,
      description,
      tag,
      priority,
      completed
    ) VALUES (
      v_recurring.milestone_id,
      p_target_date,
      v_recurring.time,
      v_recurring.activity,
      v_recurring.description,
      v_recurring.tag,
      v_recurring.priority,
      FALSE
    );

    UPDATE recurring_tasks
    SET last_generated_date = p_target_date
    WHERE id = p_recurring_task_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
