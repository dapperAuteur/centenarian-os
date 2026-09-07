-- 199_restore_task_sync_triggers.sql
-- ROLLBACK for migration 198. Restores the two planner task-sync triggers.
--
-- WHEN TO RUN THIS
-- If 198 was applied before its replacements were merged and deployed. Symptom: invoice due dates
-- and expected payments stop appearing as planner tasks under
-- "Work.WitUS Sync > Finances". Nothing errors; tasks simply stop being created.
--
-- 198 did NOT break anything else. Invoices, jobs and transactions still save normally — dropping
-- these triggers only removed the planner side effect. Verified by direct insert on 2026-09-07.
--
-- ORDER: run migration 157 FIRST. It is CREATE OR REPLACE FUNCTION for both functions (the
-- corrected target-year versions, superseding 148/154) and 198 dropped them. This file only
-- recreates the triggers that call them; the guard below fails loudly if 157 has not been run.

BEGIN;

-- Fail with a readable message rather than a cryptic "function does not exist" at trigger time.
DO $$
BEGIN
  IF to_regprocedure('public.sync_invoice_due_to_task()') IS NULL THEN
    RAISE EXCEPTION 'sync_invoice_due_to_task() is missing. Run migration 157 first, then re-run this file.';
  END IF;
  IF to_regprocedure('public.sync_pay_date_to_task()') IS NULL THEN
    RAISE EXCEPTION 'sync_pay_date_to_task() is missing. Run migration 157 first, then re-run this file.';
  END IF;
END $$;

-- Identical to the definitions in 148 and 154. Dropping first keeps this re-runnable.
DROP TRIGGER IF EXISTS trg_invoice_due_to_task ON invoices;
CREATE TRIGGER trg_invoice_due_to_task
  AFTER INSERT OR UPDATE OF status, due_date ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_due_to_task();

DROP TRIGGER IF EXISTS trg_pay_date_to_task ON contractor_jobs;
CREATE TRIGGER trg_pay_date_to_task
  AFTER INSERT OR UPDATE OF status, est_pay_date ON contractor_jobs
  FOR EACH ROW
  EXECUTE FUNCTION sync_pay_date_to_task();

COMMIT;

-- Backfill note: any invoice or job whose status or date changed while the triggers were absent
-- did not get its planner task. These triggers fire on the NEXT write to that row, so touching
-- the record (or re-saving it) creates the task. Nothing is permanently lost.
