-- 193_assignment_metric_prefill.sql
-- Assignment metric auto-prefill.
-- An assignment can declare which health metrics it needs and over how many days.
-- When set, the assignment page shows the student a read-only summary of their own
-- logged metrics, and the submission captures a snapshot of that summary at submit time
-- so the teacher sees the data as it was even if the student keeps logging.
--
-- Additive only. Shared DB safe (ADD COLUMN IF NOT EXISTS, no drops or renames).

BEGIN;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS requires_metrics JSONB;

ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS metric_snapshot JSONB;

COMMENT ON COLUMN public.assignments.requires_metrics IS
  'Optional. Shape: {"metrics": ["resting_hr","steps","sleep_hours","activity_min"], "days": 7}. When set, the assignment UI shows a read-only summary of the student''s logged metrics for the period, and the submission stores a metric_snapshot.';

COMMENT ON COLUMN public.assignment_submissions.metric_snapshot IS
  'Snapshot of the student metric summary captured at submit time: {"days", "log_count", "averages", "captured_at"}.';

COMMIT;
