-- Migration 159: Fix Supabase security linter findings
-- 1. Recreate expected_payments view with security_invoker (removes SECURITY DEFINER warning)
-- 2. Enable RLS on 11 tables missing it
-- 3. Add SELECT policies for tables that need public read access
-- Copy this migration to both repos (contractor-os + centenarian-os)

-- ============================================================
-- 1. Fix SECURITY DEFINER view: expected_payments
-- ============================================================
DROP VIEW IF EXISTS expected_payments;

CREATE VIEW expected_payments
WITH (security_invoker = true)
AS

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

COMMENT ON VIEW expected_payments IS 'Unified view of expected incoming payments from jobs and invoices. Used by both Work.WitUS and CentenarianOS.';

-- ============================================================
-- 2. Enable RLS on all flagged tables (default-deny for anon/authenticated)
--    Service role client bypasses RLS, so all API routes continue working.
-- ============================================================
ALTER TABLE public.og_image_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invited_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prerequisite_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prerequisite_override_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_referrals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. SELECT policies for publicly-readable tables
--    These tables have public GET endpoints that use service role,
--    but adding policies ensures safe direct PostgREST access too.
-- ============================================================

-- institutions: public directory, anyone can browse
CREATE POLICY "Public read access"
  ON public.institutions FOR SELECT
  USING (true);

-- institution_offers: public, but only published ones
CREATE POLICY "Public read published offers"
  ON public.institution_offers FOR SELECT
  USING (is_published = true);

-- course_prerequisites: public read (course catalog)
CREATE POLICY "Public read access"
  ON public.course_prerequisites FOR SELECT
  USING (true);

-- course_recommendations: public read (course catalog)
CREATE POLICY "Public read access"
  ON public.course_recommendations FOR SELECT
  USING (true);

-- No policies needed for these tables (admin/service-role only):
--   og_image_requests, invited_users, app_logs,
--   usage_events, social_referrals,
--   prerequisite_overrides, prerequisite_override_requests
