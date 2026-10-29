// tests/unit/witus-silent-sso.test.ts
// Run: npm run test:unit
//
// Covers silent "Sign in with WitUS" on /login (lib/auth/witus-sso.ts, lib/auth/witus-callback.ts):
// the once-per-session flag and the other loop guards, the ?no_sso=1 escape hatch, the prompt=none
// authorize URL, a login_required answer returning to /login quietly, and a code completing sign-in
// with a fake fetch (token exchange + userinfo) and a fake session minter.
// No network, no database. Every value below is made up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SILENT_SSO_COOKIE,
  buildWitusAuthorizeUrl,
  hasSilentSsoFlag,
  quietLoginPath,
  safeNextPath,
  silentSignInPath,
  silentSsoDecision,
  silentSsoFlagCookie,
} from '../../lib/auth/witus-sso.ts';
import { handleWitusCallback, type WitusCallbackInput } from '../../lib/auth/witus-callback.ts';

// ─── The flag and the other loop guards ─────────────────────────────────────

test('a signed-out first visit attempts silent sign-in', () => {
  assert.deepEqual(silentSsoDecision({ enabled: true, search: '', attempted: false }), {
    attempt: true,
  });
});

test('the browser-session flag prevents a second attempt', () => {
  const cookie = `theme=light; ${silentSsoFlagCookie(true).split(';')[0]}; other=x`;
  assert.equal(hasSilentSsoFlag(cookie), true);
  assert.deepEqual(
    silentSsoDecision({ enabled: true, search: '', attempted: hasSilentSsoFlag(cookie) }),
    { attempt: false, skip: 'already-attempted' },
  );
});

test('the flag cookie lasts for the browser session only and is site-wide', () => {
  const cookie = silentSsoFlagCookie(true);
  assert.match(cookie, new RegExp(`^${SILENT_SSO_COOKIE}=1;`));
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(cookie, /Max-Age|Expires/i);
  assert.doesNotMatch(silentSsoFlagCookie(false), /Secure/);
});

test('a lookalike cookie does not count as the flag', () => {
  assert.equal(hasSilentSsoFlag(`x${SILENT_SSO_COOKIE}=1`), false);
  assert.equal(hasSilentSsoFlag(`${SILENT_SSO_COOKIE}=0`), false);
  assert.equal(hasSilentSsoFlag(''), false);
  assert.equal(hasSilentSsoFlag(undefined), false);
});

test('the ?sso=tried marker stops a retry even without the cookie', () => {
  assert.deepEqual(silentSsoDecision({ enabled: true, search: '?sso=tried', attempted: false }), {
    attempt: false,
    skip: 'already-attempted',
  });
});

test('the quiet return carries the marker, so the round trip cannot loop', () => {
  const back = quietLoginPath(null);
  assert.equal(back, '/login?sso=tried');
  assert.deepEqual(silentSsoDecision({ enabled: true, search: back.split('?')[1] }), {
    attempt: false,
    skip: 'already-attempted',
  });
});

test('a page showing an error never starts an attempt', () => {
  assert.deepEqual(silentSsoDecision({ enabled: true, search: '?error=witus_token' }), {
    attempt: false,
    skip: 'error-shown',
  });
});

test('no attempt when the app is not a configured WitUS client', () => {
  assert.deepEqual(silentSsoDecision({ enabled: false, search: '' }), {
    attempt: false,
    skip: 'not-configured',
  });
});

test('no attempt for a visitor who owes a second factor (?mfa=pending)', () => {
  assert.deepEqual(silentSsoDecision({ enabled: true, search: '?mfa=pending' }), {
    attempt: false,
    skip: 'already-signed-in',
  });
  assert.deepEqual(silentSsoDecision({ enabled: true, search: '', signedIn: true }), {
    attempt: false,
    skip: 'already-signed-in',
  });
});

// ─── The escape hatch ───────────────────────────────────────────────────────

test('?no_sso=1 skips the attempt', () => {
  assert.deepEqual(silentSsoDecision({ enabled: true, search: '?no_sso=1', attempted: false }), {
    attempt: false,
    skip: 'escape-hatch',
  });
  assert.deepEqual(
    silentSsoDecision({ enabled: true, search: 'from=%2Fdashboard%2Ffinance&no_sso=1' }),
    { attempt: false, skip: 'escape-hatch' },
  );
});

test('only no_sso=1 is the escape hatch', () => {
  assert.deepEqual(silentSsoDecision({ enabled: true, search: '?no_sso=0' }), { attempt: true });
});

// ─── The authorize request ──────────────────────────────────────────────────

test('the silent request goes to the same-origin authorize route with prompt=none and from', () => {
  assert.equal(silentSignInPath(null), '/api/auth/witus/authorize?prompt=none');
  assert.equal(
    silentSignInPath('/dashboard/finance?tab=1'),
    '/api/auth/witus/authorize?prompt=none&from=%2Fdashboard%2Ffinance%3Ftab%3D1',
  );
  // An unsafe `from` is dropped, not forwarded.
  assert.equal(silentSignInPath('https://evil.example'), '/api/auth/witus/authorize?prompt=none');
});

test('the authorize URL is the interactive one plus prompt=none', () => {
  const base = {
    authorizeUrl: 'https://idp.example/api/idp/oauth2/authorize',
    clientId: 'client-x',
    redirectUri: 'https://app.example/api/auth/witus/callback',
    state: 'state-1',
    codeChallenge: 'challenge-1',
  };
  const interactive = new URL(buildWitusAuthorizeUrl(base));
  const silent = new URL(buildWitusAuthorizeUrl({ ...base, silent: true }));
  assert.equal(interactive.searchParams.get('prompt'), null);
  assert.equal(silent.searchParams.get('prompt'), 'none');
  silent.searchParams.delete('prompt');
  assert.equal(silent.toString(), interactive.toString());
  assert.equal(interactive.searchParams.get('client_id'), 'client-x');
  assert.equal(interactive.searchParams.get('redirect_uri'), base.redirectUri);
  assert.equal(interactive.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(interactive.searchParams.get('response_type'), 'code');
});

test('safeNextPath refuses anything that could leave the site', () => {
  for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'dashboard', '', '/a\nb']) {
    assert.equal(safeNextPath(bad), null, bad);
  }
  assert.equal(safeNextPath('/dashboard/planner'), '/dashboard/planner');
});

// ─── The callback ───────────────────────────────────────────────────────────

function input(query: string, extra: Partial<WitusCallbackInput> = {}): WitusCallbackInput {
  return {
    search: new URLSearchParams(query),
    expectedState: 'state-1',
    verifier: 'verifier-1',
    redirectUri: 'https://app.example/api/auth/witus/callback',
    clientId: 'client-x',
    clientSecret: 'secret-x',
    tokenUrl: 'https://idp.example/token',
    userinfoUrl: 'https://idp.example/userinfo',
    ...extra,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const neverFetch = (async () => {
  throw new Error('fetch must not be called');
}) as typeof fetch;
const neverSession = async () => {
  throw new Error('establishSession must not be called');
};

test('login_required returns to /login quietly: no error, no IdP calls, marker set', async () => {
  // The live IdP sends no state with this error (checked 2026-10-29).
  const outcome = await handleWitusCallback(
    input('error=login_required&error_description=Authentication+required+but+prompt+is+none', {
      nextPath: '/dashboard/finance',
    }),
    { fetch: neverFetch, establishSession: neverSession },
  );
  assert.equal(outcome.kind, 'quiet');
  const back = new URL(outcome.redirectTo, 'https://app.example');
  assert.equal(back.pathname, '/login');
  assert.equal(back.searchParams.get('error'), null);
  assert.equal(back.searchParams.get('sso'), 'tried');
  assert.equal(back.searchParams.get('from'), '/dashboard/finance');
});

test('consent_required and interaction_required are quiet too', async () => {
  for (const error of ['consent_required', 'interaction_required', 'account_selection_required']) {
    const outcome = await handleWitusCallback(input(`error=${error}`), {
      fetch: neverFetch,
      establishSession: neverSession,
    });
    assert.equal(outcome.kind, 'quiet', error);
    assert.equal(outcome.redirectTo, '/login?sso=tried');
  }
});

test('any other IdP error keeps the existing error path', async () => {
  const outcome = await handleWitusCallback(input('error=access_denied'), {
    fetch: neverFetch,
    establishSession: neverSession,
  });
  assert.equal(outcome.kind, 'failed');
  assert.equal(outcome.redirectTo, '/login?error=witus_state&sso=tried');
});

test('a code completes sign-in: token exchange, userinfo, session, lands on from', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url) === 'https://idp.example/token') return json({ access_token: 'at-1' });
    if (String(url) === 'https://idp.example/userinfo') {
      return json({ sub: 'sub-1', email: 'person@example.com' });
    }
    return json({}, 404);
  }) as typeof fetch;
  const sessions: { sub: string; email: string }[] = [];

  const outcome = await handleWitusCallback(
    input('code=code-1&state=state-1', { nextPath: '/dashboard/finance' }),
    {
      fetch: fakeFetch,
      establishSession: async (claims) => {
        sessions.push(claims);
        return null;
      },
    },
  );

  assert.deepEqual(outcome, { kind: 'signed-in', redirectTo: '/dashboard/finance' });
  assert.deepEqual(sessions, [{ sub: 'sub-1', email: 'person@example.com' }]);
  const body = new URLSearchParams(String(calls[0].init?.body));
  assert.equal(body.get('grant_type'), 'authorization_code');
  assert.equal(body.get('code'), 'code-1');
  assert.equal(body.get('code_verifier'), 'verifier-1');
  assert.equal(body.get('redirect_uri'), 'https://app.example/api/auth/witus/callback');
  assert.equal(body.get('client_id'), 'client-x');
  assert.equal(
    (calls[1].init?.headers as Record<string, string>).Authorization,
    'Bearer at-1',
  );
});

test('a code with no stashed from lands on /dashboard, and an unsafe from is ignored', async () => {
  const fakeFetch = (async (url: string | URL | Request) =>
    String(url).endsWith('/token')
      ? json({ access_token: 'at-1' })
      : json({ sub: 'sub-1', email: 'person@example.com' })) as typeof fetch;
  for (const nextPath of [undefined, '//evil.example']) {
    const outcome = await handleWitusCallback(input('code=code-1&state=state-1', { nextPath }), {
      fetch: fakeFetch,
      establishSession: async () => null,
    });
    assert.deepEqual(outcome, { kind: 'signed-in', redirectTo: '/dashboard' });
  }
});

test('a code with a wrong state never reaches the IdP', async () => {
  const outcome = await handleWitusCallback(input('code=code-1&state=forged'), {
    fetch: neverFetch,
    establishSession: neverSession,
  });
  assert.deepEqual(outcome, {
    kind: 'failed',
    reason: 'witus_state',
    redirectTo: '/login?error=witus_state&sso=tried',
  });
});

test('a failed token exchange or session mint uses the existing error codes', async () => {
  const badToken = (async () => json({ error: 'invalid_grant' }, 400)) as typeof fetch;
  const t = await handleWitusCallback(input('code=code-1&state=state-1'), {
    fetch: badToken,
    establishSession: neverSession,
  });
  assert.equal(t.kind === 'failed' && t.reason, 'witus_token');

  const ok = (async (url: string | URL | Request) =>
    String(url).endsWith('/token')
      ? json({ access_token: 'at-1' })
      : json({ sub: 'sub-1', email: 'person@example.com' })) as typeof fetch;
  const s = await handleWitusCallback(input('code=code-1&state=state-1'), {
    fetch: ok,
    establishSession: async () => 'witus_verify',
  });
  assert.equal(s.redirectTo, '/login?error=witus_verify&sso=tried');
});
