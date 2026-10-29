// Starts the "Sign in with WitUS" OIDC flow: generate state + PKCE, stash them in
// short-lived httpOnly cookies, and redirect to the WitUS IdP authorize endpoint.
// The IdP returns to /api/auth/witus/callback with a code.
//
// Two optional query params, both from the login page:
//   ?prompt=none  the silent attempt (lib/auth/witus-sso.ts): same client, callback, state and
//                 PKCE, plus prompt=none, so the IdP answers at once with a code or with
//                 error=login_required instead of showing its login page. Any other value is
//                 ignored.
//   ?from=/path   where to land after sign-in; validated to a same-origin path, carried across the
//                 round trip in a transient httpOnly cookie.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  NEXT_PATH_COOKIE,
  WITUS_OIDC_AUTHORIZE_FALLBACK,
  buildWitusAuthorizeUrl,
  safeNextPath,
  withAttemptMarker,
} from '@/lib/auth/witus-sso';

// Single source for the IdP host — lib/auth/witus-sso.ts derives the endsession URL from this
// same value, so accounts.witus.online is asserted in one place only.
const AUTHORIZE_URL = process.env.WITUS_OIDC_AUTHORIZE_URL ?? WITUS_OIDC_AUTHORIZE_FALLBACK;

const b64url = (buf: Buffer) => buf.toString('base64url');

export async function GET(request: NextRequest) {
  const clientId = process.env.WITUS_OIDC_CLIENT_ID;
  if (!clientId) {
    // `?sso=tried` keeps the login page from starting a silent attempt on the bounce.
    return NextResponse.redirect(
      new URL(withAttemptMarker('/login?error=witus_not_configured'), request.url),
    );
  }

  // Must EXACTLY match the redirect URI registered for `centenarianos` in the IdP
  // (https://www.centenarianos.com/api/auth/witus/callback, apex as a fallback). Prefer the
  // configured site URL over the request origin (which on Vercel may be the deployment host).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const redirectUri = `${siteUrl.replace(/\/$/, '')}/api/auth/witus/callback`;

  const state = b64url(crypto.randomBytes(16));
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());

  const authUrl = buildWitusAuthorizeUrl({
    authorizeUrl: AUTHORIZE_URL,
    clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
    silent: request.nextUrl.searchParams.get('prompt') === 'none',
  });

  const res = NextResponse.redirect(authUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutes
  };
  res.cookies.set('witus_oauth_state', state, cookieOpts);
  res.cookies.set('witus_oauth_verifier', verifier, cookieOpts);
  const next = safeNextPath(request.nextUrl.searchParams.get('from'));
  if (next) res.cookies.set(NEXT_PATH_COOKIE, next, cookieOpts);
  else res.cookies.set(NEXT_PATH_COOKIE, '', { ...cookieOpts, maxAge: 0 });
  return res;
}
