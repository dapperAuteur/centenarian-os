-- 115_multi_product_invites.sql
-- Phase 11: Extend invite system for multi-product (centos, contractor, lister).
-- Allow same email to be invited to different products.
-- Allow contractors and listers to invite peers.

BEGIN;

-- ── 1. Add product column to invited_users ────────────────────────────
ALTER TABLE invited_users
  ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'centos'
    CHECK (product IN ('centos', 'contractor', 'lister'));

-- Add invited_by_role to track who invited
ALTER TABLE invited_users
  ADD COLUMN IF NOT EXISTS invited_by_role TEXT DEFAULT 'admin'
    CHECK (invited_by_role IN ('admin', 'contractor', 'lister'));

-- Extend demo_profile with contractor and lister demos
ALTER TABLE invited_users
  DROP CONSTRAINT IF EXISTS invited_users_demo_profile_check;
ALTER TABLE invited_users
  ADD CONSTRAINT invited_users_demo_profile_check
    CHECK (demo_profile IN ('visitor', 'tutorial', 'contractor_demo', 'lister_demo'));

-- ── 2. Change UNIQUE from email to (email, product) ──────────────────
-- Same user can be invited to multiple products
ALTER TABLE invited_users DROP CONSTRAINT IF EXISTS invited_users_email_key;
ALTER TABLE invited_users ADD CONSTRAINT invited_users_email_product_key UNIQUE (email, product);

COMMIT;
