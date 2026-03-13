-- Migration 138: Add app discriminator column to shared SEO tracking tables.
-- Both og_image_requests and social_referrals are shared with the contractor app
-- (Work.WitUS). Adding an app TEXT column lets each app filter its own data in
-- admin dashboards. Column is nullable with no default so existing contractor rows
-- are not incorrectly stamped.

ALTER TABLE og_image_requests ADD COLUMN IF NOT EXISTS app TEXT;
ALTER TABLE social_referrals   ADD COLUMN IF NOT EXISTS app TEXT;

CREATE INDEX IF NOT EXISTS og_image_requests_app_idx ON og_image_requests(app);
CREATE INDEX IF NOT EXISTS social_referrals_app_idx   ON social_referrals(app);
