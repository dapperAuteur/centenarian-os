-- 132_invite_limits_paid_tracking.sql
-- Adds per-user invite limits and paid conversion tracking to the invite system.
-- COPY THIS MIGRATION TO THE CENTENARIAN-OS REPO (per SHARED_DB.md).

BEGIN;

-- 1. Per-user invite limit on profiles
--    NULL = use the platform default (10). Admin sets a higher value to grant more invites.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invite_limit INT;

-- 2. Paid conversion tracking on invited_users
--    Tracks when an invited user upgrades to a paid subscription.
ALTER TABLE public.invited_users
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.invited_users
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.invited_users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT;

-- 3. Index for fast paid-conversion queries
CREATE INDEX IF NOT EXISTS idx_invited_users_is_paid ON public.invited_users(is_paid);

-- 4. Index for fast referral tree lookups (invited_by)
CREATE INDEX IF NOT EXISTS idx_invited_users_invited_by ON public.invited_users(invited_by);

COMMIT;
