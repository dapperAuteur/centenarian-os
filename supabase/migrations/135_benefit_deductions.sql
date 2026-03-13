-- Migration 135: Add benefit_deductions to contractor_jobs
-- Stores dynamic union benefit/deduction line items (e.g. H&W, TTF, Pension, Annuity).
-- Array of {label: string, amount: number} objects.

ALTER TABLE public.contractor_jobs
  ADD COLUMN IF NOT EXISTS benefit_deductions JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contractor_jobs.benefit_deductions IS
  'Dynamic list of union/employer benefit deduction line items. '
  'Each item: {label: string, amount: number}. '
  'Used to track employer contributions to union funds (H&W, TTF, Pension, Annuity, etc.).';
