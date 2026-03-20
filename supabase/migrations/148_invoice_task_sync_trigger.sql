-- Migration 148: Auto-sync invoice due dates to CentOS planner tasks
-- When an invoice is sent, create a task on the due date.
-- When paid, mark it completed. When cancelled, archive it.
-- Copy this migration to both repos (contractor-os + centenarian-os)

-- Function: sync invoice due dates to planner tasks
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

    -- Create or find "Finances" goal
    SELECT id INTO v_goal_id
    FROM goals
    WHERE roadmap_id = v_roadmap_id AND title = 'Finances'
    LIMIT 1;

    IF v_goal_id IS NULL THEN
      INSERT INTO goals (roadmap_id, title, category, status)
      VALUES (v_roadmap_id, 'Finances', 'LIFESTYLE', 'active')
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
      -- Update existing task (date may have changed)
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
      -- Create new task
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

  -- INVOICE OVERDUE → update task if it exists (keep visible, update status context)
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

-- Trigger: fires on invoice insert or status/due_date change
DROP TRIGGER IF EXISTS trg_invoice_due_to_task ON invoices;
CREATE TRIGGER trg_invoice_due_to_task
  AFTER INSERT OR UPDATE OF status, due_date ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_due_to_task();
