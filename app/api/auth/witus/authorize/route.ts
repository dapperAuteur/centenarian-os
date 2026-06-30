// Starts the "Sign in with WitUS" OIDC flow: generate state + PKCE, stash them in
// short-lived httpOnly cookies, and redirect to the WitUS IdP authorize endpoint.
// The IdP returns to /api/auth/witus/callback with a code.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

const AUTHORIZE_URL =
  process.env.WITUS_OIDC_AUTHORIZE_URL ??
  'https://accounts.witus.online/api/idp/oauth2/authorize';

const b64url = (buf: Buffer) => buf.toString('base64url');

export async function GET(request: NextRequest) {
  const clientId = process.env.WITUS_OIDC_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL('/login?error=witus_not_configured', request.url));
  }

  // Must EXACTLY match the redirect URI registered for `centenarianos` in the IdP
  // (https://centenarianos.com/api/auth/witus/callback). Prefer the configured site
  // URL over the request origin (which on Vercel may be the deployment host).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const redirectUri = `${siteUrl.replace(/\/$/, '')}/api/auth/witus/callback`;

  const state = b64url(crypto.randomBytes(16));
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const res = NextResponse.redirect(authUrl.toString());
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutes
  };
  res.cookies.set('witus_oauth_state', state, cookieOpts);
  res.cookies.set('witus_oauth_verifier', verifier, cookieOpts);
  return res;
}
