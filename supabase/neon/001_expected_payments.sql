-- supabase/neon/001_expected_payments.sql
-- Recreate the expected_payments VIEW in Work.WitUS's own database (Phase 3).
--
-- This view is NOT dropped from the shared database by migration 198, and must not be: Work.WitUS
-- reads it in three of its own routes (finance/forecast, finance/expected-payments,
-- finance/summary). It moves WITH contractor_jobs and invoices rather than being deleted.
--
-- ⚠️ ONE DELIBERATE CHANGE FROM MIGRATION 153 — do not "restore" it.
-- The original computes straight time as COALESCE(te.st_hours, 0). The job UI lets a user log a
-- bare total_hours with no straight/overtime/double split, and jobs/[id]/generate-invoice reads
-- `entry.st_hours ?? entry.total_hours ?? 0`. So one row produced two answers: the invoice billed
-- 10 hours while the forecast said $0. Found on real data 2026-09-07 (job TEST, total_hours 10,
-- st/ot/dt all NULL).
--
-- COALESCE(te.st_hours, te.total_hours, 0) makes the forecast agree with what actually gets
-- billed. contractor-os `computeExpectedAmount()` was fixed to match on the same date.

DROP VIEW IF EXISTS expected_payments;

CREATE VIEW expected_payments AS

-- Jobs with estimated pay dates (completed or invoiced, waiting on payment)
SELECT
  j.user_id,
  'job' AS source_type,
  j.id AS source_id,
  j.est_pay_date AS expected_date,
  j.client_name AS label,
  j.job_number AS reference_number,
  COALESCE(
    (SELECT SUM(
      -- the fix: fall back to total_hours when the split was never entered
      COALESCE(te.st_hours, te.total_hours, 0) * COALESCE(j.pay_rate, 0)
      + COALESCE(te.ot_hours, 0) * COALESCE(j.ot_rate, j.pay_rate * 1.5, 0)
      + COALESCE(te.dt_hours, 0) * COALESCE(j.dt_rate, j.pay_rate * 2, 0)
    ) FROM job_time_entries te WHERE te.job_id = j.id),
    CASE
      WHEN j.rate_type = 'daily' AND j.start_date IS NOT NULL AND j.end_date IS NOT NULL
        THEN j.pay_rate * (j.end_date - j.start_date + 1)
      WHEN j.rate_type = 'flat' THEN j.pay_rate
      ELSE 0
    END
  ) AS expected_amount,
  j.status,
  j.start_date,
  j.end_date,
  j.brand_id,
  j.created_at
FROM contractor_jobs j
WHERE j.est_pay_date IS NOT NULL
  AND j.status IN ('completed', 'invoiced')

UNION ALL

-- Receivable invoices (due_date = when the client should pay)
SELECT
  i.user_id,
  'invoice' AS source_type,
  i.id AS source_id,
  i.due_date AS expected_date,
  i.contact_name AS label,
  i.invoice_number AS reference_number,
  (i.total - i.amount_paid) AS expected_amount,
  i.status,
  i.invoice_date AS start_date,
  NULL::date AS end_date,
  i.brand_id,
  i.created_at
FROM invoices i
WHERE i.direction = 'receivable'
  AND i.due_date IS NOT NULL
  AND i.status IN ('sent', 'overdue');
