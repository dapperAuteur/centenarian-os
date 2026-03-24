-- Migration 156: Fix trigger functions that insert into goals without target_year
-- Both sync_invoice_due_to_task and sync_pay_date_to_task were missing the
-- required NOT NULL target_year column when creating the "Finances" goal,
-- causing invoice generation and pay-date syncs to fail with:
--   "null value in column 'target_year' violates not-null constraint"
-- Copy this migration to both repos (contractor-os + centenarian-os)

-- ═══════════════════════════════════════════════════════════════════
-- 1. Fix sync_invoice_due_to_task
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_invoice_due_to_task()
RETURNS TRIGGER AS $$
DECLARE
  v_milestone_id UUID;
  v_activity TEXT;
  v_existing_task_id UUID;
  v_roadmap_id UUID;
  v_goal_id UUID;
BEGIN
  -- Only act on receivable invoices with a due date
  IF NEW.direction != 'receivable' OR NEW.due_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find existing "Invoice Due Dates" milestone for this user
  SELECT m.id INTO v_milestone_id
  FROM milestones m
  JOIN goals g ON g.id = m.goal_id
  JOIN roadmaps r ON r.id = g.roadmap_id
  WHERE r.user_id = NEW.user_id
    AND m.title = 'Invoice Due Dates'
  LIMIT 1;

  -- If no milestone exists, create the full hierarchy
  IF v_milestone_id IS NULL THEN
    -- Create or find "Work.WitUS Sync" roadmap
    SELECT id INTO v_roadmap_id
    FROM roadmaps
    WHERE user_id = NEW.user_id AND title = 'Work.WitUS Sync'
    LIMIT 1;

    IF v_roadmap_id IS NULL THEN
      INSERT INTO roadmaps (user_id, title, status)
      VALUES (NEW.user_id, 'Work.WitUS Sync', 'active')
      RETURNING id INTO v_roadmap_id;
    END IF;

    -- Create or find "Finances" goal (with target_year)
    SELECT id INTO v_goal_id
    FROM goals
    WHERE roadmap_id = v_roadmap_id AND title = 'Finances'
    LIMIT 1;

    IF v_goal_id IS NULL THEN
      INSERT INTO goals (roadmap_id, title, category, status, target_year)
      VALUES (v_roadmap_id, 'Finances', 'LIFESTYLE', 'active', EXTRACT(YEAR FROM CURRENT_DATE)::integer)
      RETURNING id INTO v_goal_id;
    END IF;

    -- Create "Invoice Due Dates" milestone
    INSERT INTO milestones (goal_id, title, status)
    VALUES (v_goal_id, 'Invoice Due Dates', 'in_progress')
    RETURNING id INTO v_milestone_id;
  END IF;

  -- Build activity text
  v_activity := 'Invoice Due: ' || COALESCE(NEW.invoice_number, 'N/A') || ' — ' || NEW.contact_name;

  -- Check if a synced task already exists for this invoice
  SELECT id INTO v_existing_task_id
  FROM tasks
  WHERE source_type = 'invoice_due' AND source_id = NEW.id
  LIMIT 1;

  -- INVOICE SENT → create or update task
  IF NEW.status = 'sent' THEN
    IF v_existing_task_id IS NOT NULL THEN
      UPDATE tasks
      SET date = NEW.due_date,
          activity = v_activity,
          completed = false,
          completed_at = NULL,
          status = 'active',
          archived_at = NULL,
          estimated_cost = 0,
          revenue = NEW.total,
          updated_at = NOW()
      WHERE id = v_existing_task_id;
    ELSE
      INSERT INTO tasks (
        milestone_id, date, time, activity, description,
        tag, priority, completed, estimated_cost, revenue,
        source_type, source_id
      ) VALUES (
        v_milestone_id, NEW.due_date, '09:00', v_activity,
        'Auto-created from Work.WitUS invoice. Total: $' || NEW.total::TEXT,
        'finance', 2, false, 0, NEW.total,
        'invoice_due', NEW.id
      );
    END IF;

  -- INVOICE PAID → mark task completed
  ELSIF NEW.status = 'paid' THEN
    IF v_existing_task_id IS NOT NULL THEN
      UPDATE tasks
      SET completed = true,
          completed_at = NOW(),
          actual_cost = 0,
          revenue = NEW.amount_paid,
          updated_at = NOW()
      WHERE id = v_existing_task_id;
    END IF;

  -- INVOICE CANCELLED → archive the task
  ELSIF NEW.status = 'cancelled' THEN
    IF v_existing_task_id IS NOT NULL THEN
      UPDATE tasks
      SET status = 'archived',
          archived_at = NOW(),
          updated_at = NOW()
      WHERE id = v_existing_task_id;
    END IF;

  -- INVOICE OVERDUE → update task if it exists
  ELSIF NEW.status = 'overdue' THEN
    IF v_existing_task_id IS NOT NULL THEN
      UPDATE tasks
      SET activity = 'OVERDUE — ' || v_activity,
          priority = 1,
          updated_at = NOW()
      WHERE id = v_existing_task_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Fix sync_pay_date_to_task
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_pay_date_to_task()
RETURNS TRIGGER AS $$
DECLARE
  v_milestone_id UUID;
  v_activity TEXT;
  v_existing_task_id UUID;
  v_roadmap_id UUID;
  v_goal_id UUID;
  v_expected_amount NUMERIC;
BEGIN
  -- Only act on jobs with an estimated pay date
  IF NEW.est_pay_date IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.est_pay_date IS NOT NULL THEN
      UPDATE tasks
      SET status = 'archived', archived_at = NOW(), updated_at = NOW()
      WHERE source_type = 'expected_payment' AND source_id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  -- Only create tasks for jobs that are completed or invoiced
  IF NEW.status NOT IN ('completed', 'invoiced', 'paid', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Find or create the "Expected Payments" milestone
  SELECT m.id INTO v_milestone_id
  FROM milestones m
  JOIN goals g ON g.id = m.goal_id
  JOIN roadmaps r ON r.id = g.roadmap_id
  WHERE r.user_id = NEW.user_id
    AND m.title = 'Expected Payments'
  LIMIT 1;

  IF v_milestone_id IS NULL THEN
    SELECT id INTO v_roadmap_id
    FROM roadmaps
    WHERE user_id = NEW.user_id AND title = 'Work.WitUS Sync'
    LIMIT 1;

    IF v_roadmap_id IS NULL THEN
      INSERT INTO roadmaps (user_id, title, status)
      VALUES (NEW.user_id, 'Work.WitUS Sync', 'active')
      RETURNING id INTO v_roadmap_id;
    END IF;

    -- Create or find "Finances" goal (with target_year)
    SELECT id INTO v_goal_id
    FROM goals
    WHERE roadmap_id = v_roadmap_id AND title = 'Finances'
    LIMIT 1;

    IF v_goal_id IS NULL THEN
      INSERT INTO goals (roadmap_id, title, category, status, target_year)
      VALUES (v_roadmap_id, 'Finances', 'LIFESTYLE', 'active', EXTRACT(YEAR FROM CURRENT_DATE)::integer)
      RETURNING id INTO v_goal_id;
    END IF;

    INSERT INTO milestones (goal_id, title, status)
    VALUES (v_goal_id, 'Expected Payments', 'in_progress')
    RETURNING id INTO v_milestone_id;
  END IF;

  -- Calculate expected amount from time entries
  SELECT COALESCE(
    SUM(
      COALESCE(te.st_hours, 0) * COALESCE(NEW.pay_rate, 0)
      + COALESCE(te.ot_hours, 0) * COALESCE(NEW.ot_rate, NEW.pay_rate * 1.5, 0)
      + COALESCE(te.dt_hours, 0) * COALESCE(NEW.dt_rate, NEW.pay_rate * 2, 0)
    ), 0
  ) INTO v_expected_amount
  FROM job_time_entries te
  WHERE te.job_id = NEW.id;

  IF v_expected_amount = 0 THEN
    v_expected_amount := CASE
      WHEN NEW.rate_type = 'daily' AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL
        THEN NEW.pay_rate * (NEW.end_date - NEW.start_date + 1)
      WHEN NEW.rate_type = 'flat' THEN COALESCE(NEW.pay_rate, 0)
      ELSE 0
    END;
  END IF;

  v_activity := 'Expected Payment: $' || ROUND(v_expected_amount, 2)::TEXT || ' — ' || NEW.client_name;

  SELECT id INTO v_existing_task_id
  FROM tasks
  WHERE source_type = 'expected_payment' AND source_id = NEW.id
  LIMIT 1;

  IF NEW.status IN ('completed', 'invoiced') THEN
    IF v_existing_task_id IS NOT NULL THEN
      UPDATE tasks
      SET date = NEW.est_pay_date,
          activity = v_activity,
          description = 'Expected payment for job #' || NEW.job_number || '. Check your account on this date.',
          completed = false,
          completed_at = NULL,
          status = 'active',
          archived_at = NULL,
          revenue = v_expected_amount,
          updated_at = NOW()
      WHERE id = v_existing_task_id;
    ELSE
      INSERT INTO tasks (
        milestone_id, date, time, activity, description,
        tag, priority, completed, estimated_cost, revenue,
        source_type, source_id
      ) VALUES (
        v_milestone_id, NEW.est_pay_date, '09:00', v_activity,
        'Expected payment for job #' || NEW.job_number || '. Check your account on this date.',
        'finance', 2, false, 0, v_expected_amount,
        'expected_payment', NEW.id
      );
    END IF;

  ELSIF NEW.status = 'paid' THEN
    IF v_existing_task_id IS NOT NULL THEN
      UPDATE tasks
      SET completed = true,
          completed_at = NOW(),
          activity = 'Paid: $' || ROUND(v_expected_amount, 2)::TEXT || ' — ' || NEW.client_name,
          updated_at = NOW()
      WHERE id = v_existing_task_id;
    END IF;

  ELSIF NEW.status = 'cancelled' THEN
    IF v_existing_task_id IS NOT NULL THEN
      UPDATE tasks
      SET status = 'archived',
          archived_at = NOW(),
          updated_at = NOW()
      WHERE id = v_existing_task_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
