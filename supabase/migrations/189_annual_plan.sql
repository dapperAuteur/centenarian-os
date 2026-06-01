-- 189_annual_plan.sql
-- Add 'annual' to subscription_status CHECK constraint.
-- Annual plan activates after lifetime founder's slots sell out.
--
-- SHARED DB: this widens the existing constraint. Migration 182 added
-- 'starter'; we must preserve it (and every other current status) here —
-- the CHECK below is the union of all in-use statuses, not a replacement.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free', 'monthly', 'annual', 'lifetime', 'starter'));
