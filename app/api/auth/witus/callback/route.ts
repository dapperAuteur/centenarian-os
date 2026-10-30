// Completes the "Sign in with WitUS" OIDC flow, both the button's interactive one and the login
// page's silent `prompt=none` attempt:
//   0. a silent attempt that found no WitUS session (`?error=login_required` and friends) returns
//      to /login quietly, with no message;
//   1. verify state, exchange the code (+ PKCE verifier) for tokens,
//   2. read the user's claims from the IdP userinfo endpoint (server-to-server,
//      so no client-side JWT to verify — avoids a jose dependency),
//   3. find-or-create the Supabase user by email (service role),
//   4. mint a Supabase session for them, and link witus_sub -> user_id,
//   5. land on the `from` path the authorize route stashed, else /dashboard.
// Steps 0-3 and 5 are decided in lib/auth/witus-callback.ts (unit-tested); this file wires
// Next.js cookies and Supabase into it.
//
// NOTE (verify live): step 4 mints a session via admin.generateLink('magiclink')
// + verifyOtp({ token_hash }). This is the one part that can't be unit-tested and
// is the most Supabase-version-sensitive. If sign-in lands back on /login with
// ?error=witus_verify, the likely fix is the verifyOtp `type` ('magiclink' vs
// 'email') for @supabase/supabase-js v2.75 / @supabase/ssr v0.7.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { handleWitusCallback, type WitusCallbackFailure } from '@/lib/auth/witus-callback';
import { NEXT_PATH_COOKIE } from '@/lib/auth/witus-sso';

const TOKEN_URL =
  process.env.WITUS_OIDC_TOKEN_URL ?? 'https://accounts.witus.online/api/idp/oauth2/token';
const USERINFO_URL =
  process.env.WITUS_OIDC_USERINFO_URL ?? 'https://accounts.witus.online/api/idp/oauth2/userinfo';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const cookieStore = await cookies();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const redirectUri = `${siteUrl.replace(/\/$/, '')}/api/auth/witus/callback`;

  const outcome = await handleWitusCallback(
    {
      search: url.searchParams,
      expectedState: cookieStore.get('witus_oauth_state')?.value,
      verifier: cookieStore.get('witus_oauth_verifier')?.value,
      nextPath: cookieStore.get(NEXT_PATH_COOKIE)?.value,
      redirectUri,
      clientId: process.env.WITUS_OIDC_CLIENT_ID ?? '',
      clientSecret: process.env.WITUS_OIDC_CLIENT_SECRET ?? '',
      tokenUrl: TOKEN_URL,
      userinfoUrl: USERINFO_URL,
    },
    {
      fetch,
      establishSession: (claims) => establishSupabaseSession(claims, cookieStore),
    },
  );

  // Every outcome is the end of this round trip: the transient cookies are single-use.
  for (const name of ['witus_oauth_state', 'witus_oauth_verifier', NEXT_PATH_COOKIE]) {
    cookieStore.set({ name, value: '', maxAge: 0, path: '/' });
  }
  return NextResponse.redirect(new URL(outcome.redirectTo, request.url));
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/** Steps 3-4: find-or-create the Supabase user, mint its session cookies, link the WitUS sub. */
async function establishSupabaseSession(
  { sub, email }: { sub: string; email: string },
  cookieStore: CookieStore,
): Promise<WitusCallbackFailure | null> {
  // 3. Find-or-create the Supabase user by email (service role bypasses RLS).
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  // Idempotent: ignore "email already registered". The on-signup trigger creates
  // the profiles row; existing users are matched by email below.
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => undefined);

  // 4. Mint a Supabase session for this user (see NOTE at top).
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkErr || !tokenHash) return 'witus_session';

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return cookieStore.get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        async remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    },
  );
  const { data: verified, error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (verifyErr || !verified.user) return 'witus_verify';

  // Link WitUS sub -> Supabase user id for subsequent logins.
  await admin
    .from('witus_identities')
    .upsert({ user_id: verified.user.id, witus_sub: sub }, { onConflict: 'witus_sub' });

  return null;
}
