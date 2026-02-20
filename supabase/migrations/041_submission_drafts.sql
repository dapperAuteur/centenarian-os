-- 041_submission_drafts.sql
-- Adds draft status and multi-file attachment support to assignment_submissions.
--
-- Changes:
--   status        TEXT  'draft' | 'submitted'  (default 'submitted' preserves existing rows)
--   media_urls    JSONB array of {url, name, type} objects  (default [] preserves existing rows)
--   submitted_at  made nullable so drafts don't require a date

BEGIN;

-- Allow submitted_at to be null — drafts have no submission timestamp yet
ALTER TABLE public.assignment_submissions
  ALTER COLUMN submitted_at DROP NOT NULL;

-- Track whether the student has submitted or is still drafting
ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted'));

-- Backfill: existing rows are treated as submitted
UPDATE public.assignment_submissions SET status = 'submitted' WHERE submitted_at IS NOT NULL;

-- Multi-file attachment support: stores [{url, name, type}] array
ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS media_urls JSONB NOT NULL DEFAULT '[]';

COMMIT;
