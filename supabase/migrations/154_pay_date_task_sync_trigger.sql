-- Migration 154: Auto-sync expected pay dates to CentOS planner tasks
-- When a job is completed/invoiced and has est_pay_date, create a planner task.
-- When paid, mark task completed. When cancelled, archive task.
-- Reuses source_type/source_id from migration 147.
-- Copy this migration to both repos (contractor-os + centenarian-os)

-- Function: sync job expected pay dates to planner tasks
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
    -- If est_pay_date was removed, archive any existing synced task
    IF TG_OP = 'UPDATE' AND OLD.est_pay_date IS NOT NULL THEN
      UPDATE tasks
      SET status = 'archived', archived_at = NOW(), updated_at = NOW()
      WHERE source_type = 'expected_payment' AND source_id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  -- Only create tasks for jobs that are completed or invoiced (money is expected)
  -- Also handle paid/cancelled for lifecycle management
  IF NEW.status NOT IN ('completed', 'invoiced', 'paid', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Find or create the "Expected Payments" milestone under "Work.WitUS Sync > Finances"
  SELECT m.id INTO v_milestone_id
  FROM milestones m
  JOIN goals g ON g.id = m.goal_id
  JOIN roadmaps r ON r.id = g.roadmap_id
  WHERE r.user_id = NEW.user_id
    AND m.title = 'Expected Payments'
  LIMIT 1;

  IF v_milestone_id IS NULL THEN
    -- Reuse or create the "Work.WitUS Sync" roadmap (shared with invoice trigger)
    SELECT id INTO v_roadmap_id
    FROM roadmaps
    WHERE user_id = NEW.user_id AND title = 'Work.WitUS Sync'
    LIMIT 1;

    IF v_roadmap_id IS NULL THEN
      INSERT INTO roadmaps (user_id, title, status)
      VALUES (NEW.user_id, 'Work.WitUS Sync', 'active')
      RETURNING id INTO v_roadmap_id;
    END IF;

    -- Reuse or create "Finances" goal (shared with invoice trigger)
    SELECT id INTO v_goal_id
    FROM goals
    WHERE roadmap_id = v_roadmap_id AND title = 'Finances'
    LIMIT 1;

    IF v_goal_id IS NULL THEN
      INSERT INTO goals (roadmap_id, title, category, status)
      VALUES (v_roadmap_id, 'Finances', 'LIFESTYLE', 'active')
      RETURNING id INTO v_goal_id;
    END IF;

    -- Create "Expected Payments" milestone (sibling to "Invoice Due Dates")
    INSERT INTO milestones (goal_id, title, status)
    VALUES (v_goal_id, 'Expected Payments', 'in_progress')
    RETURNING id INTO v_milestone_id;
  END IF;

  -- Calculate expected amount from time entries or rate estimate
  SELECT COALESCE(
    SUM(
      COALESCE(te.st_hours, 0) * COALESCE(NEW.pay_rate, 0)
      + COALESCE(te.ot_hours, 0) * COALESCE(NEW.ot_rate, NEW.pay_rate * 1.5, 0)
      + COALESCE(te.dt_hours, 0) * COALESCE(NEW.dt_rate, NEW.pay_rate * 2, 0)
    ), 0
  ) INTO v_expected_amount
  FROM job_time_entries te
  WHERE te.job_id = NEW.id;

  -- Fallback estimate if no time entries
  IF v_expected_amount = 0 THEN
    v_expected_amount := CASE
      WHEN NEW.rate_type = 'daily' AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL
        THEN NEW.pay_rate * (NEW.end_date - NEW.start_date + 1)
      WHEN NEW.rate_type = 'flat' THEN COALESCE(NEW.pay_rate, 0)
      ELSE 0
    END;
  END IF;

  -- Build activity text
  v_activity := 'Expected Payment: $' || ROUND(v_expected_amount, 2)::TEXT || ' — ' || NEW.client_name;

  -- Check for existing synced task
  SELECT id INTO v_existing_task_id
  FROM tasks
  WHERE source_type = 'expected_payment' AND source_id = NEW.id
  LIMIT 1;

  -- JOB COMPLETED/INVOICED → create or update task
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

  -- JOB PAID → mark task completed
  ELSIF NEW.status = 'paid' THEN
    IF v_existing_task_id IS NOT NULL THEN
      UPDATE tasks
      SET completed = true,
          completed_at = NOW(),
          activity = 'Paid: $' || ROUND(v_expected_amount, 2)::TEXT || ' — ' || NEW.client_name,
          updated_at = NOW()
      WHERE id = v_existing_task_id;
    END IF;

  -- JOB CANCELLED → archive the task
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

-- Trigger: fires on job insert or status/est_pay_date change
DROP TRIGGER IF EXISTS trg_pay_date_to_task ON contractor_jobs;
CREATE TRIGGER trg_pay_date_to_task
  AFTER INSERT OR UPDATE OF status, est_pay_date ON contractor_jobs
  FOR EACH ROW
  EXECUTE FUNCTION sync_pay_date_to_task();
