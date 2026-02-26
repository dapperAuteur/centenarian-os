-- scripts/create-demo-users.sql
-- NOTE: Direct INSERT into auth.users is unreliable in Supabase.
-- Use one of the two methods below instead.

-- ──────────────────────────────────────────────────────────────────────────
-- METHOD 1 (Recommended): Use the setup API endpoint after deploying
-- ──────────────────────────────────────────────────────────────────────────
-- 1. Make sure CRON_SECRET is set in your env vars.
-- 2. Run this curl (replace passwords and secret):
--
--   curl -X POST https://centenarianos.com/api/admin/demo/setup \
--     -H "Authorization: Bearer YOUR_CRON_SECRET" \
--     -H "Content-Type: application/json" \
--     -d '{
--       "tutorial_email": "tutorial@centenarianos.com",
--       "tutorial_password": "****",
--       "visitor_email": "demo@centenarianos.com",
--       "visitor_password": "****"
--     }'
--
-- 3. The response includes the UUIDs. Add them to .env.local + Vercel env vars:
--      DEMO_TUTORIAL_USER_ID=<uuid>
--      DEMO_VISITOR_USER_ID=<uuid>
--
-- 4. Then seed the data:
--   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
--        https://centenarianos.com/api/admin/demo/reset

-- ──────────────────────────────────────────────────────────────────────────
-- METHOD 2: Supabase Dashboard (no code needed)
-- ──────────────────────────────────────────────────────────────────────────
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User" → set email to tutorial@centenarianos.com + password
-- 3. Repeat for demo@centenarianos.com
-- 4. Copy the UUID for each user (shown in the users table)
-- 5. Add to .env.local + Vercel env vars:
--      DEMO_TUTORIAL_USER_ID=<uuid>
--      DEMO_VISITOR_USER_ID=<uuid>
-- 6. Seed the data:
--   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
--        https://centenarianos.com/api/admin/demo/reset

-- ──────────────────────────────────────────────────────────────────────────
-- To look up existing user UUIDs:
-- ──────────────────────────────────────────────────────────────────────────
SELECT id, email, created_at FROM auth.users
WHERE email IN ('tutorial@centenarianos.com', 'demo@centenarianos.com');
