// File: lib/auth/witus-callback.ts
// The decision logic of the "Sign in with WitUS" callback (app/api/auth/witus/callback/route.ts),
// split out so node --test can run it with a fake fetch and a fake session minter
// (tests/unit/witus-silent-sso.test.ts). The route keeps the Next.js and Supabase wiring.
//
// Order matters:
//   1. A silent attempt (`prompt=none`) that finds no WitUS session comes back as
//      `?error=login_required` (or consent/interaction/account_selection_required) and, from the
//      live IdP, WITHOUT `state`. That is the ordinary "not signed in to WitUS" answer, so it returns
//      to /login with no message. It grants nothing, so it needs no state check.
//   2. Everything else goes through the existing checks: state + PKCE, token exchange, userinfo,
//      then the injected session minter. Each failure keeps the existing `/login?error=<code>`
//      path with the `?sso=tried` marker.
//   3. Success lands on the validated `from` path the authorize route stashed, else /dashboard.
//
// Pure apart from the injected dependencies, with relative imports only.

import { isQuietSilentSsoError, quietLoginPath, safeNextPath, withAttemptMarker } from './witus-sso.ts';

export type WitusCallbackFailure =
  | 'witus_state'
  | 'witus_token'
  | 'witus_userinfo'
  | 'witus_claims'
  | 'witus_session'
  | 'witus_verify';

export interface WitusCallbackInput {
  /** The callback's query string. */
  search: URLSearchParams;
  /** Transient cookies set by the authorize route. */
  expectedState?: string;
  verifier?: string;
  nextPath?: string;
  /** Must equal the redirect_uri the authorize route sent. */
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  userinfoUrl: string;
}

export interface WitusCallbackDeps {
  fetch: typeof fetch;
  /**
   * Find-or-create the local user for these verified claims, mint the CentOS session cookies, and
   * link `sub`. Returns null on success or the failure code to show.
   */
  establishSession(claims: { sub: string; email: string }): Promise<WitusCallbackFailure | null>;
}

export type WitusCallbackOutcome =
  | { kind: 'quiet'; redirectTo: string }
  | { kind: 'failed'; reason: WitusCallbackFailure; redirectTo: string }
  | { kind: 'signed-in'; redirectTo: string };

export async function handleWitusCallback(
  input: WitusCallbackInput,
  deps: WitusCallbackDeps,
): Promise<WitusCallbackOutcome> {
  const { search } = input;

  if (isQuietSilentSsoError(search.get('error'))) {
    return { kind: 'quiet', redirectTo: quietLoginPath(input.nextPath) };
  }

  const fail = (reason: WitusCallbackFailure): WitusCallbackOutcome => ({
    kind: 'failed',
    reason,
    // `?sso=tried` is the half of the loop guard that survives a browser with no usable cookie
    // flag: the login page reads it and does not start another silent attempt.
    redirectTo: withAttemptMarker(`/login?error=${reason}`),
  });

  const code = search.get('code');
  const state = search.get('state');
  if (!code || !state || !input.expectedState || state !== input.expectedState || !input.verifier) {
    return fail('witus_state');
  }

  // 1. Exchange the authorization code for tokens.
  let tokens: { access_token?: string };
  try {
    const tokenRes = await deps.fetch(input.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: input.redirectUri,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        code_verifier: input.verifier,
      }),
      cache: 'no-store',
    });
    if (!tokenRes.ok) return fail('witus_token');
    tokens = (await tokenRes.json()) as { access_token?: string };
  } catch {
    return fail('witus_token');
  }
  if (!tokens.access_token) return fail('witus_token');

  // 2. Read claims from userinfo (server-to-server, so no client-side JWT to verify).
  let claims: { sub?: unknown; email?: unknown };
  try {
    const userinfoRes = await deps.fetch(input.userinfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
    });
    if (!userinfoRes.ok) return fail('witus_userinfo');
    claims = (await userinfoRes.json()) as { sub?: unknown; email?: unknown };
  } catch {
    return fail('witus_userinfo');
  }
  if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string' || !claims.email) {
    return fail('witus_claims');
  }

  // 3. Mint the local session.
  const sessionFailure = await deps.establishSession({ sub: claims.sub, email: claims.email });
  if (sessionFailure) return fail(sessionFailure);

  return { kind: 'signed-in', redirectTo: safeNextPath(input.nextPath) ?? '/dashboard' };
}
