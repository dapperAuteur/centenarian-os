-- 169_paycheck_portal_url.sql
-- Add paycheck_portal_url to contacts so users can store the URL where
-- they check pay stubs for each company/client.
-- Displayed on job detail, invoice detail, and paycheck detail pages.

ALTER TABLE public.user_contacts
  ADD COLUMN IF NOT EXISTS paycheck_portal_url TEXT,
  ADD COLUMN IF NOT EXISTS paycheck_portal_company_id TEXT;

COMMENT ON COLUMN public.user_contacts.paycheck_portal_url IS
  'URL to the company paycheck portal (e.g., ADP, Paychex, custom portal). '
  'Shown on job/invoice/paycheck detail for easy reconciliation access.';

COMMENT ON COLUMN public.user_contacts.paycheck_portal_company_id IS
  'Company/Employer ID required to log in to the paycheck portal. '
  'Displayed alongside the portal URL for quick reference.';
