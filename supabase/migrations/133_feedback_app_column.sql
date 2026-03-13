-- 133_feedback_app_column.sql
-- Adds `app` discriminator to user_feedback so admin can filter by product.
-- Default 'centenarian' leaves all existing rows unaffected.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

BEGIN;

ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'centenarian';

CREATE INDEX IF NOT EXISTS idx_user_feedback_app ON public.user_feedback(app);

COMMIT;
