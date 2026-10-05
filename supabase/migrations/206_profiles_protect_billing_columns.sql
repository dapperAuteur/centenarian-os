-- 206_profiles_protect_billing_columns.sql
-- Stop signed-in users from changing their own billing, entitlement and admin columns on
-- public.profiles, and add the public_profiles view that public pages read other users through.
-- Part 1 of 2. Part 2 (207_profiles_private_reads.sql) closes the read side and must wait until
-- both apps read other users through public_profiles. See "APPLY ORDER" below.
--
-- THE HOLE (verified read-only against production, 2026-10-04)
--   Policy "Users can manage their own profile" is FOR ALL USING (auth.uid() = id), with no column
--   limits, and the role `authenticated` holds UPDATE (and INSERT) on every column. So any signed-in
--   user could, from the browser with the public anon key, run
--     supabase.from('profiles').update({ subscription_status: 'lifetime' }).eq('id', myId)
--   and give themselves a lifetime plan, set role = 'admin' (which the lead_emails and
--   lead_download_events policies trust), raise invite_limit, or point stripe_customer_id at a
--   different Stripe customer (which the billing-portal route would then open).
--
-- THE FIX (this file)
--   1. A BEFORE INSERT OR UPDATE trigger, profiles_protect_privileged_columns. When the statement
--      runs as a browser role (current_user is `anon` or `authenticated`, which is what PostgREST
--      switches to for the anon key and for a user's session), it raises 42501 if:
--        UPDATE: any protected column changes value;
--        INSERT: any protected column holds something other than NULL or its column default.
--      The service role (API routes, Stripe webhooks, admin tools), `postgres` (SQL editor) and
--      SECURITY DEFINER functions (handle_new_user) are not browser roles and are unaffected.
--      Writes that leave protected columns alone (display_name, bio, avatar_url, theme,
--      clock_format, dashboard_home*, onboarding_*, fiscal_year_*, likes_public, ...) keep working.
--   2. A view, public.public_profiles, exposing only the columns public pages show (id, username,
--      display_name, bio, avatar_url, created_at, updated_at). Today the table is readable by
--      everyone anyway, so the view exposes nothing new. It exists so both apps can move their
--      cross-user reads onto it before 207 makes the table owner-only.
--   3. REVOKE TRUNCATE on profiles from anon/authenticated (TRUNCATE ignores RLS; nothing uses it).
--
-- WHY A TRIGGER AND NOT COLUMN GRANTS
--   Column-level REVOKE UPDATE only works after revoking table-level UPDATE and re-granting every
--   allowed column, so each new column either app adds would silently become un-writable until
--   someone remembers the grant. It also would not cover INSERT (a user can delete their own row and
--   re-insert it with subscription_status = 'lifetime') without a second set of grants. The trigger
--   names the protected columns once, covers INSERT and UPDATE, gives a clear error, and behaves the
--   same for every client of this shared database.
--
-- PROTECTED COLUMNS (written only by server code with the service role, in both apps)
--   subscription_status, subscription_expires_at, stripe_customer_id, stripe_subscription_id,
--   cancel_at, cancel_at_period_end, cancellation_feedback, cancellation_comment (Stripe webhook),
--   shirt_promo_code (issued on lifetime purchase), role, contractor_role (admin / Stripe),
--   invite_limit (admin), products (Stripe webhook / sync), lead_session_id (enrolment attribution),
--   selected_modules (Starter-plan module picks; /api/user/starter-modules enforces the plan's
--   limit with the service role, so a direct browser write would bypass that limit).
--   Columns are compared through to_jsonb(), so a column missing in some environment is skipped
--   instead of erroring.
--
-- SHARED DB (Work.WitUS / contractor-os uses this same table)
--   Checked in both repos: no browser code writes a protected column. Two API routes wrote
--   stripe_customer_id with the user's session client and must switch to the service client
--   BEFORE this file is applied, or new checkouts silently fail to save the customer id:
--     CentenarianOS  app/api/stripe/checkout/route.ts  (fixed on branch fix/profiles-rls-billing)
--     Work.WitUS     app/api/stripe/checkout/route.ts  (~line 124: use the service client `db`)
--   Additive: drops, renames and narrows no column; existing policies are untouched by this file.
--
-- APPLY ORDER
--   a. Deploy the Work.WitUS checkout change above (it works with or without this file).
--   b. Apply this file (206).
--   c. Deploy both apps' switch of cross-user reads to public_profiles (needs the view from 206).
--   d. Apply 207_profiles_private_reads.sql.
--
-- SAFE TO RE-RUN: CREATE OR REPLACE for the function and view, DROP TRIGGER IF EXISTS before
-- CREATE TRIGGER, REVOKE/GRANT/COMMENT are repeatable.
--
-- NOT APPLIED AUTOMATICALLY: run by hand in the Supabase SQL editor. Verification script at the
-- bottom (commented out).

BEGIN;

-- 1. Trigger that rejects browser-role changes to protected columns ----------------------------

CREATE OR REPLACE FUNCTION public.profiles_protect_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY INVOKER on purpose: current_user must be the role that ran the statement.
SET search_path = ''
AS $$
DECLARE
  -- Keep in sync with lib/profiles/public-profiles.ts (PROTECTED_PROFILE_COLUMNS) and its test.
  protected_cols constant text[] := ARRAY[
    'subscription_status', 'subscription_expires_at',
    'stripe_customer_id', 'stripe_subscription_id',
    'cancel_at', 'cancel_at_period_end', 'cancellation_feedback', 'cancellation_comment',
    'shirt_promo_code', 'role', 'contractor_role', 'invite_limit', 'products',
    'lead_session_id', 'selected_modules'
  ];
  -- Values a browser-role INSERT may carry (the column defaults). Anything else must be NULL.
  insert_defaults constant jsonb := jsonb_build_object(
    'subscription_status', 'free',
    'role', 'member',
    'contractor_role', 'worker',
    'products', '[]'::jsonb,
    'cancel_at_period_end', false
  );
  new_row jsonb;
  old_row jsonb;
  col text;
  bad text[] := ARRAY[]::text[];
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  new_row := to_jsonb(NEW);

  IF TG_OP = 'UPDATE' THEN
    old_row := to_jsonb(OLD);
    FOREACH col IN ARRAY protected_cols LOOP
      IF (new_row -> col) IS DISTINCT FROM (old_row -> col) THEN
        bad := bad || col;
      END IF;
    END LOOP;
  ELSE -- INSERT
    FOREACH col IN ARRAY protected_cols LOOP
      IF (new_row ->> col) IS NOT NULL
         AND ((insert_defaults -> col) IS NULL OR (new_row -> col) <> (insert_defaults -> col)) THEN
        bad := bad || col;
      END IF;
    END LOOP;
  END IF;

  IF cardinality(bad) > 0 THEN
    RAISE EXCEPTION 'profiles: % can only be changed by the server', array_to_string(bad, ', ')
      USING ERRCODE = '42501',
            HINT = 'Billing, plan and role columns are set by Stripe webhooks and admin routes.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_protect_privileged_columns() IS
  'Rejects anon/authenticated INSERT/UPDATE that set billing, entitlement or role columns on profiles. Shared with Work.WitUS. Migration 206.';

DROP TRIGGER IF EXISTS profiles_protect_privileged_columns ON public.profiles;
CREATE TRIGGER profiles_protect_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_privileged_columns();

-- The function is only meant to run as a trigger.
REVOKE EXECUTE ON FUNCTION public.profiles_protect_privileged_columns() FROM PUBLIC, anon, authenticated;

-- 2. Public projection of profiles ------------------------------------------------------------
-- Not security_invoker: the view runs with its owner's rights, so it can show the public columns of
-- every row after 207 limits the table itself to the row's owner. It selects only public columns;
-- security_barrier stops caller-supplied filters from being pushed below it. (The Supabase linter
-- reports this as "security definer view"; that is intended here.)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true) AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.bio,
  p.avatar_url,
  p.created_at,
  p.updated_at
FROM public.profiles p;

ALTER VIEW public.public_profiles OWNER TO postgres;
REVOKE ALL ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

COMMENT ON VIEW public.public_profiles IS
  'Public columns of profiles for public pages (author names, avatars, bios). Read other users through this, never the table. Shared with Work.WitUS. Migration 206.';

-- 3. TRUNCATE bypasses RLS; no client needs it ---------------------------------------------------
REVOKE TRUNCATE ON public.profiles FROM anon, authenticated;

COMMIT;

-- ============================================================================================
-- VERIFICATION (run after applying; read the comments, then paste the parts you need).
-- Steps 1-3 simulate PostgREST in the SQL editor and roll back, so nothing is changed.
-- Replace <TEST_USER_UUID> with a real test user's id (not a paying customer).
-- ============================================================================================
--
-- -- 1. As that signed-in user: changing subscription_status must FAIL with 42501.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<TEST_USER_UUID>","role":"authenticated"}', true);
--   UPDATE public.profiles SET subscription_status = 'lifetime' WHERE id = '<TEST_USER_UUID>';
--   -- expected: ERROR: profiles: subscription_status can only be changed by the server
-- ROLLBACK;
--
-- -- 2. Same user: role, invite_limit and stripe_customer_id must also FAIL.
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<TEST_USER_UUID>","role":"authenticated"}', true);
--   UPDATE public.profiles SET role = 'admin', invite_limit = 999 WHERE id = '<TEST_USER_UUID>';
--   -- expected: ERROR: profiles: role, invite_limit can only be changed by the server
-- ROLLBACK;
--
-- -- 3. Same user: display_name (and other preference columns) must SUCCEED (1 row).
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<TEST_USER_UUID>","role":"authenticated"}', true);
--   UPDATE public.profiles SET display_name = 'RLS test', clock_format = '24h' WHERE id = '<TEST_USER_UUID>';
--   -- expected: UPDATE 1
-- ROLLBACK;
--
-- -- 4. Service role is unaffected (this is what webhooks and admin routes use).
-- BEGIN;
--   SET LOCAL ROLE service_role;
--   UPDATE public.profiles SET subscription_status = subscription_status WHERE id = '<TEST_USER_UUID>';
--   -- expected: UPDATE 1
-- ROLLBACK;
--
-- -- 5. The view returns public columns to anon, and has no private ones.
-- BEGIN;
--   SET LOCAL ROLE anon;
--   SELECT id, username, display_name, bio, avatar_url FROM public.public_profiles LIMIT 3;  -- rows
--   SELECT stripe_customer_id FROM public.public_profiles LIMIT 1;  -- ERROR: column does not exist
-- ROLLBACK;
--
-- -- 6. From a browser (DevTools console on the signed-in app), the real-world check:
-- --    await supabase.from('profiles').update({ subscription_status: 'lifetime' }).eq('id', (await supabase.auth.getUser()).data.user.id)
-- --    -> error.code '42501'
