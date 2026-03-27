-- 175_annual_plan.sql
-- Add 'annual' to subscription_status CHECK constraint.
-- Annual plan activates after lifetime founder's slots sell out.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free', 'monthly', 'annual', 'lifetime'));
