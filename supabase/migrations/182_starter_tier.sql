-- 182_starter_tier.sql
-- Adds the Starter ($5.46/mo, $51.80/yr — pick-3-modules) subscription
-- tier. Two schema changes:
--
--   1. profiles.selected_modules TEXT[] — the list of module slugs a
--      Starter user has selected access to. NULL for every tier other
--      than starter (Monthly/Lifetime/Free/Admin/Invited all ignore it).
--   2. subscription_status CHECK widens to include 'starter'.
--
-- Access enforcement happens in the app layer (app/dashboard/layout.tsx
-- + components/nav/NavConfig.ts), not RLS, because the existing paid
-- gating already lives there. This migration only makes the data
-- model ready; it does not change any existing user's behavior.
--
-- The profiles table is shared with the Contractor/JobHub app per
-- CLAUDE.md. This migration is additive — a new nullable column plus
-- a widened CHECK constraint — and will not affect other apps that
-- read profile rows.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_modules TEXT[];

COMMENT ON COLUMN public.profiles.selected_modules IS
  'Starter-tier users: array of module slugs (e.g. [''finance'',''travel'',''workouts'']) picked at checkout. Max 3. NULL for every other tier.';

-- The original CHECK from migration 033 was inline and got auto-named
-- by Postgres. Drop by the conventional name (Postgres derives it from
-- tablename_columnname_check) and re-add widened.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
    CHECK (subscription_status IN ('free', 'monthly', 'lifetime', 'starter'));

COMMIT;
