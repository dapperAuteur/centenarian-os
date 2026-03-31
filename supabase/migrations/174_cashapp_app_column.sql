-- 174_cashapp_app_column.sql
-- Add app discriminator to cashapp_payments for shared DB.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

ALTER TABLE public.cashapp_payments
  ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'contractor';

CREATE INDEX IF NOT EXISTS idx_cashapp_payments_app ON public.cashapp_payments(app);
