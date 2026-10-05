-- 207_profiles_private_reads.sql
-- Make public.profiles readable only by the row's owner (and the server). Other users' public
-- columns are read through public.public_profiles, created in 206.
-- Part 2 of 2. DO NOT APPLY until both apps read other users through public_profiles (see
-- "BEFORE APPLYING").
--
-- THE HOLE (verified read-only against production, 2026-10-04)
--   Policy "Profiles are publicly readable" is SELECT USING (true) for role `public`, and `anon`
--   holds SELECT on every column. Anyone, signed in or not, could read every profile row, including
--   stripe_customer_id, stripe_subscription_id, subscription_status, cancellation feedback and
--   comments, shirt promo codes, invite limits and lead attribution ids.
--
-- THE FIX (this file)
--   1. Drop the "Profiles are publicly readable" policy. "Users can manage their own profile"
--      (FOR ALL USING (auth.uid() = id)) stays, so a signed-in user still reads and writes their own
--      row exactly as before: settings, onboarding, useSubscription, dashboard_home, select('*') of
--      one's own profile all keep working. Reads of OTHER users' rows through the anon key or a
--      user session now return no rows; those reads must use public_profiles.
--   2. Revoke INSERT/UPDATE/DELETE on profiles from `anon`. A visitor who is not signed in has no
--      row of their own, so anon had nothing legitimate to write. SELECT stays granted on purpose:
--      with the public policy gone anon gets zero rows, and other tables' policies that look up
--      profiles (e.g. admin_messages) would raise "permission denied" for anon if SELECT went too.
--   The service role bypasses RLS and is unaffected: API routes, webhooks, admin pages, sitemap,
--   OG images and getPublicProfile keep working.
--
-- WHY A VIEW AND NOT COLUMN GRANTS
--   Column-level SELECT grants cannot depend on the row, so hiding billing columns from other users
--   would also hide them from the owner. Both apps read their own billing fields with the session
--   client (useSubscription, stripe portal/checkout, role checks) and use select('*') and
--   update(...).select() on their own row, which needs SELECT on every column. Restricting rows
--   instead keeps every own-row path unchanged and limits the change to the cross-user reads.
--
-- SHARED DB (Work.WitUS / contractor-os uses this same table). BEFORE APPLYING, deploy:
--   CentenarianOS (branch fix/profiles-rls-billing): blog, recipes, cooks, authors pages,
--     LikedSavedPosts, LikedSavedRecipes and GET /api/recipes read authors from public_profiles.
--   Work.WitUS: the same switch in
--     app/blog/page.tsx (~line 39), app/blog/authors/page.tsx (~46),
--     app/blog/[username]/page.tsx (~14), app/blog/[username]/[slug]/page.tsx (~75),
--     components/blog/LikedSavedPosts.tsx (~59).
--   If this file is applied first, those Work.WitUS pages show no authors (blog author pages 404)
--   until the change ships. Own-row reads in Work.WitUS are unaffected.
--
-- Additive in the shared-DB sense: no table or column is dropped, renamed or narrowed. The dropped
-- object is the over-broad policy itself, which is the hole.
--
-- SAFE TO RE-RUN: DROP POLICY IF EXISTS; REVOKE is repeatable.
--
-- ROLLBACK (only if something breaks and must be restored at once; reopens the read hole):
--   CREATE POLICY "Profiles are publicly readable" ON public.profiles FOR SELECT USING (true);
--   GRANT INSERT, UPDATE, DELETE ON public.profiles TO anon;
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Verification at the bottom.

BEGIN;

-- Guard: the view from 206 must exist, or public pages in both apps would have nothing to read.
DO $$
BEGIN
  IF to_regclass('public.public_profiles') IS NULL THEN
    RAISE EXCEPTION 'Apply 206_profiles_protect_billing_columns.sql first (public.public_profiles is missing).';
  END IF;
END $$;

DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;

COMMIT;

-- ============================================================================================
-- VERIFICATION (run after applying). Replace <TEST_USER_UUID> with a test user's id and
-- <OTHER_USER_UUID> with any other profile id. Every block rolls back.
-- ============================================================================================
--
-- -- 1. Anon cannot read private columns from the table (no rows come back), nor write.
-- BEGIN;
--   SET LOCAL ROLE anon;
--   SELECT count(*) FROM public.profiles WHERE stripe_customer_id IS NOT NULL;  -- expected: 0
--   SELECT stripe_customer_id FROM public.profiles LIMIT 1;                     -- expected: 0 rows
--   UPDATE public.profiles SET bio = 'x';  -- expected: ERROR: permission denied for table profiles
-- ROLLBACK;
--
-- -- 2. Anon can still read what public pages need, through the view.
-- BEGIN;
--   SET LOCAL ROLE anon;
--   SELECT id, username, display_name, bio, avatar_url FROM public.public_profiles WHERE username IS NOT NULL LIMIT 3;
--   -- expected: rows
-- ROLLBACK;
--
-- -- 3. A signed-in user reads their own full row, and nobody else's.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<TEST_USER_UUID>","role":"authenticated"}', true);
--   SELECT id, subscription_status, stripe_customer_id FROM public.profiles WHERE id = '<TEST_USER_UUID>';   -- 1 row
--   SELECT id, stripe_customer_id FROM public.profiles WHERE id = '<OTHER_USER_UUID>';                     -- 0 rows
--   SELECT id, username, display_name FROM public.public_profiles WHERE id = '<OTHER_USER_UUID>';          -- 1 row
-- ROLLBACK;
--
-- -- 4. Writes from 206 still behave: own display_name succeeds, subscription_status fails.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<TEST_USER_UUID>","role":"authenticated"}', true);
--   UPDATE public.profiles SET display_name = 'RLS test' WHERE id = '<TEST_USER_UUID>';            -- UPDATE 1
--   UPDATE public.profiles SET subscription_status = 'lifetime' WHERE id = '<TEST_USER_UUID>';     -- ERROR 42501
-- ROLLBACK;
--
-- -- 5. In the browser, signed out, on either app:
-- --    await supabase.from('profiles').select('stripe_customer_id').limit(1)  -> data: []
-- --    await supabase.from('public_profiles').select('username, display_name').limit(1)  -> rows
-- --    Then click through: /blog, /blog/authors, /blog/<user>, a post, /recipes, /recipes/cooks,
-- --    a cook page, a recipe; signed in: Settings, onboarding, the dashboard, billing page.
