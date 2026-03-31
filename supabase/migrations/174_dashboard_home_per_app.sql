-- Per-app dashboard home preference
-- The shared profiles.dashboard_home column is used by ContractorOS.
-- CentenarianOS now uses its own column so the two apps don't clash.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_home_centos TEXT DEFAULT '/dashboard/blog';

-- Seed: copy existing dashboard_home into the new column
-- unless it points to a ContractorOS-only route.
UPDATE public.profiles
SET dashboard_home_centos = dashboard_home
WHERE dashboard_home IS NOT NULL
  AND dashboard_home NOT LIKE '/dashboard/contractor%';
