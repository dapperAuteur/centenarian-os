-- Migration 136: Add job_limit to invited_users
-- Allows admin to restrict how many jobs a trial user can create before being prompted to upgrade.
-- NULL = unlimited jobs (default for paid/lifetime users).

ALTER TABLE public.invited_users
  ADD COLUMN IF NOT EXISTS job_limit INT;

COMMENT ON COLUMN public.invited_users.job_limit IS
  'Maximum number of contractor jobs this invited user can create. '
  'NULL = unlimited. When limit is reached, user is prompted to upgrade to paid.';
