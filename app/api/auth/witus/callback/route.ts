// Completes the "Sign in with WitUS" OIDC flow:
//   1. verify state, exchange the code (+ PKCE verifier) for tokens,
//   2. read the user's claims from the IdP userinfo endpoint (server-to-server,
//      so no client-side JWT to verify — avoids a jose dependency),
//   3. find-or-create the Supabase user by email (service role),
//   4. mint a Supabase session for them, and link witus_sub -> user_id.
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

const TOKEN_URL =
  process.env.WITUS_OIDC_TOKEN_URL ?? 'https://accounts.witus.online/api/idp/oauth2/token';
const USERINFO_URL =
  process.env.WITUS_OIDC_USERINFO_URL ?? 'https://accounts.witus.online/api/idp/oauth2/userinfo';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('witus_oauth_state')?.value;
  const verifier = cookieStore.get('witus_oauth_verifier')?.value;

  const clearTransient = () => {
    cookieStore.set({ name: 'witus_oauth_state', value: '', maxAge: 0, path: '/' });
    cookieStore.set({ name: 'witus_oauth_verifier', value: '', maxAge: 0, path: '/' });
  };
  const fail = (reason: string) => {
    clearTransient();
    return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
  };

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return fail('witus_state');
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const redirectUri = `${siteUrl.replace(/\/$/, '')}/api/auth/witus/callback`;

  // 1. Exchange the authorization code for tokens.
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.WITUS_OIDC_CLIENT_ID ?? '',
      client_secret: process.env.WITUS_OIDC_CLIENT_SECRET ?? '',
      code_verifier: verifier,
    }),
    cache: 'no-store',
  });
  if (!tokenRes.ok) return fail('witus_token');
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return fail('witus_token');

  // 2. Read claims from userinfo.
  const userinfoRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: 'no-store',
  });
  if (!userinfoRes.ok) return fail('witus_userinfo');
  const claims = (await userinfoRes.json()) as { sub?: string; email?: string };
  const sub = claims.sub;
  const email = claims.email;
  if (!sub || !email) return fail('witus_claims');

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
  if (linkErr || !tokenHash) return fail('witus_session');

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
  if (verifyErr || !verified.user) return fail('witus_verify');

  // Link WitUS sub -> Supabase user id for subsequent logins.
  await admin
    .from('witus_identities')
    .upsert({ user_id: verified.user.id, witus_sub: sub }, { onConflict: 'witus_sub' });

  clearTransient();
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
