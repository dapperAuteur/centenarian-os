-- 073_sequential_locking.sql
-- Add sequential module locking to courses.
-- When is_sequential is true, all lessons in Module N must be completed
-- before Module N+1 lessons are accessible. is_free_preview lessons bypass.

BEGIN;

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_sequential BOOLEAN NOT NULL DEFAULT false;

COMMIT;
