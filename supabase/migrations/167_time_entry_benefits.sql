-- 167_time_entry_benefits.sql
-- Add per-day benefit deductions to time entries.
-- Each work day can have its own benefit line items for accurate invoicing.
-- Falls back to job-level benefit_deductions when empty.

ALTER TABLE public.job_time_entries
  ADD COLUMN IF NOT EXISTS benefit_deductions JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.job_time_entries.benefit_deductions IS
  'Per-day employer benefit contributions. Array of {label, amount}. '
  'When present, overrides job-level benefit_deductions for invoice generation.';
