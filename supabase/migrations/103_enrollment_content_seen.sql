-- 103_enrollment_content_seen.sql
-- Track when an enrolled student last viewed course content,
-- used to compute "new/updated lessons since last visit" badge counts.

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS last_content_seen_at TIMESTAMPTZ;
