-- 114_admin_contractor_access.sql
-- Grant admin (bam@awews.com) full contractor/lister/union_leader access.
-- This ensures the admin can access all contractor and lister features.

BEGIN;

-- Ensure columns exist (migration 110 may not have been applied yet)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contractor_role TEXT DEFAULT 'worker';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS products TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lister_company_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lister_union_local TEXT;

-- Add CHECK constraint on contractor_role if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_contractor_role_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_contractor_role_check
      CHECK (contractor_role IN ('worker', 'lister', 'union_leader'));
  END IF;
END $$;

-- Set admin to union_leader (highest role, includes lister capabilities)
-- and grant all product access
UPDATE profiles
SET
  contractor_role = 'union_leader',
  products = ARRAY['centos', 'contractor', 'lister']
WHERE id = (SELECT id FROM auth.users WHERE email = 'bam@awews.com' LIMIT 1);

COMMIT;
