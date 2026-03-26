-- 164_notification_preferences_expand.sql
-- Expand notification_preferences with email marketing opt-out and new push categories.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

BEGIN;

-- Email marketing opt-out (for campaign system — users can unsubscribe)
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_marketing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_weekly_digest BOOLEAN NOT NULL DEFAULT true;

-- New push notification categories
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS invoice_status_reminder BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS assignment_update BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS course_update BOOLEAN NOT NULL DEFAULT true;

COMMIT;
