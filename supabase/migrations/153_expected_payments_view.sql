-- Migration 153: Unified expected payments VIEW
-- Merges all sources of expected incoming money into one queryable table.
-- Both Work.WitUS and CentenarianOS can read from this view.
-- Copy this migration to both repos (contractor-os + centenarian-os)

-- Drop existing view if it exists (safe for re-runs)
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
      COALESCE(te.st_hours, 0) * COALESCE(j.pay_rate, 0)
      + COALESCE(te.ot_hours, 0) * COALESCE(j.ot_rate, j.pay_rate * 1.5, 0)
      + COALESCE(te.dt_hours, 0) * COALESCE(j.dt_rate, j.pay_rate * 2, 0)
    ) FROM job_time_entries te WHERE te.job_id = j.id),
    -- Fallback: if no time entries, estimate from pay_rate
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

-- Receivable invoices (due_date = when client should pay)
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

-- Comment on the view
COMMENT ON VIEW expected_payments IS 'Unified view of expected incoming payments from jobs and invoices. Used by both Work.WitUS and CentenarianOS.';
