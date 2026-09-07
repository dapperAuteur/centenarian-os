-- 198_drop_task_sync_triggers.sql
-- Stage 2, Phase 3: remove the two cross-app triggers that write CentOS planner tasks from
-- Work.WitUS writes. Their behaviour now lives in application code.
--
-- ⚠️ APPLIED OUT OF ORDER ON 2026-09-07 — ahead of the verification step, not ahead of the code.
-- Both replacements were already merged to main by then (centenarian-os `lib/planner/sync-tasks.ts`
-- and contractor-os `fireInvoiceIncomeEvent` + `fireJobIncomeEvent`), so the end state is correct
-- IF both are deployed. The skipped step was proving a test invoice creates its task first.
-- If planner tasks are missing, migration 199 restores the triggers (run 157 first).
--
-- ⚠️ PRECONDITIONS — do not run this until BOTH are true:
--   1. centenarian-os `lib/planner/sync-tasks.ts` is MERGED AND DEPLOYED. It is what creates the
--      planner tasks now, driven by income events at POST /api/events/income.
--   2. contractor-os `fireInvoiceIncomeEvent` AND `fireJobIncomeEvent` are MERGED AND DEPLOYED,
--      with INCOME_EVENTS_URL + INCOME_EVENTS_SECRET set in production.
--
-- Run it early and invoice due dates and expected payments silently stop appearing in the planner.
-- Nothing errors; tasks just stop being created. Verify by creating a test invoice and confirming
-- the task appears BEFORE applying this.
--
-- WHY THIS IS SAFE ONCE THOSE HOLD
-- The replacements are idempotent with these triggers: both match a task on
-- (source_type, source_id), so they have been running side by side. Dropping the triggers removes
-- the duplicate write, not the behaviour.
--
-- WHAT THIS DOES NOT TOUCH
-- The `expected_payments` VIEW stays. It is NOT only a CentOS bridge — Work.WitUS reads it in
-- three of its own routes (finance/forecast, finance/expected-payments, finance/summary) over its
-- own contractor_jobs and invoices. It moves WITH those tables to the new database rather than
-- being dropped. Dropping it here would break Work.WitUS.
--
-- Existing task rows are left alone. Tasks already created by these triggers keep their
-- source_type/source_id and are adopted by the application sync on the next event for that record.

BEGIN;

DROP TRIGGER IF EXISTS trg_invoice_due_to_task ON public.invoices;
DROP FUNCTION IF EXISTS public.sync_invoice_due_to_task();

DROP TRIGGER IF EXISTS trg_pay_date_to_task ON public.contractor_jobs;
DROP FUNCTION IF EXISTS public.sync_pay_date_to_task();

COMMIT;

-- ROLLBACK: re-run migrations 148 and 154, which are CREATE OR REPLACE and idempotent.
