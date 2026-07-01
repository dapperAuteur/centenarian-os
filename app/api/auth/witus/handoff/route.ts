// app/api/auth/witus/handoff/route.ts
//
// Signed deep-link receiver — "Option B" in docs/integrations/centos-read-your-body-data.md.
// Learn.WitUS sends a learner here to reach the CentOS metrics module ALREADY LOGGED IN,
// without a second account:
//
//   https://<centos-host>/api/auth/witus/handoff?token=<short-lived HS256 JWT>
//
// This is a TOP-LEVEL redirect (not an iframe), so it is immune to third-party-cookie
// blocking. Flow: verify the token's signature + claims -> rate-limit/replay guard ->
// find-or-create the Supabase user by email (service role) -> mint a normal CentOS
// session -> redirect to the metrics dashboard.
//
// Shares the session-minting pattern with ./callback (the "Sign in with WitUS" OIDC
// flow): admin.generateLink('magiclink') + verifyOtp({ token_hash }). When the shared
// ecosystem IdP (Option A) fully lands, this bespoke link can retire.
//
// SECURITY (verify-before-trust): NOTHING touches the database until the HMAC signature
// and every claim (exp, max-TTL, iss, aud, email) have passed in verifyHandoffToken().
// Least privilege: the token only carries an email; the minted user is a normal account,
// and the redirect target is allow-listed to the metrics module (no open redirect).
// No PII in logs: we record a SHA-256 email fingerprint, never the raw address or token.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyHandoffToken, emailFingerprint } from '@/lib/auth/handoff-token';
import { rateLimitOk, consumeJti } from '@/lib/auth/handoff-rate-limit';
import { logInfo, logWarn } from '@/lib/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Where a successful handoff lands. Optional ?next= is honored ONLY if it stays inside
// the metrics module — keeps the deep-link purpose-bound and blocks open redirects.
const DEFAULT_TARGET = '/dashboard/metrics';
const ALLOWED_TARGET_RE = /^\/dashboard\/metrics(?:\/[A-Za-z0-9/_-]*)?$/;

// Expected token binding. Both apps agree on these out-of-band.
const EXPECTED_ISS = process.env.WITUS_HANDOFF_ISS ?? 'learn.witus.online';
const EXPECTED_AUD = process.env.WITUS_HANDOFF_AUD ?? 'centenarian-os';

function safeTarget(next: string | null): string {
  if (next && ALLOWED_TARGET_RE.test(next)) return next;
  return DEFAULT_TARGET;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const token = url.searchParams.get('token');
  const target = safeTarget(url.searchParams.get('next'));

  // Generic failure -> bounce to login. We never echo the specific reason in the URL
  // (no oracle for a forger); the precise reason is logged server-side instead.
  const fail = (reason: string, fingerprint?: string) => {
    logWarn({
      source: 'auth',
      module: 'witus-handoff',
      message: `handoff rejected: ${reason}`,
      metadata: fingerprint ? { reason, email_fp: fingerprint } : { reason },
    });
    return NextResponse.redirect(new URL('/login?error=witus_handoff', request.url));
  };

  const secret = process.env.WITUS_HANDOFF_SECRET;
  if (!secret) {
    // Misconfiguration, not an attack — surface a distinct code for ops.
    logWarn({
      source: 'auth',
      module: 'witus-handoff',
      message: 'handoff rejected: WITUS_HANDOFF_SECRET not set',
      metadata: { reason: 'no_secret' },
    });
    return NextResponse.redirect(new URL('/login?error=witus_not_configured', request.url));
  }

  if (!token) return fail('missing_token');

  // Best-effort IP rate limit (see lib/auth/handoff-rate-limit.ts for scope caveats).
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  if (!rateLimitOk(ip)) return fail('rate_limited');

  // 1. Verify-before-trust: signature + all claims. No I/O happens before this passes.
  const result = verifyHandoffToken(token, {
    secret,
    expectedIss: EXPECTED_ISS,
    expectedAud: EXPECTED_AUD,
    maxTtlSec: 120,
  });
  if (!result.ok) return fail(result.reason);

  const { email, sub, jti, exp } = result.claims;
  const fp = emailFingerprint(email);

  // 2. Replay guard — reject a token id we've already consumed (best-effort, per instance).
  if (!consumeJti(jti, exp)) return fail('replay', fp);

  // 3. Find-or-create the Supabase user by email (service role bypasses RLS).
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  // Idempotent: ignore "email already registered". The on-signup trigger creates the
  // profiles row; existing learners are matched by email when the session is minted.
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => undefined);

  // 4. Mint a normal CentOS session for this user (same approach as ./callback).
  const cookieStore = await cookies();
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkErr || !tokenHash) return fail('mint_link', fp);

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
  if (verifyErr || !verified.user) return fail('verify_otp', fp);

  logInfo({
    source: 'auth',
    module: 'witus-handoff',
    message: 'handoff accepted',
    userId: verified.user.id,
    metadata: { email_fp: fp, sub: sub ?? null, target },
  });

  return NextResponse.redirect(new URL(target, request.url));
}
