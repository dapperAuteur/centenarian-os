// tests/unit/google-calendar-client.test.ts
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)
//
// Covers lib/google/calendar-client.ts (authorization URL, error classification, the
// token-expiry decision, calendar-list paging) and withAccessToken in
// lib/google/connection.ts. No network and no database: every Google call goes to a fake
// fetch, and the "database" is an object that records what would have been written.
// Every token, client id and secret below is made up for the test.

import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALENDAR_READONLY_SCOPE,
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_CALENDAR_LIST_ENDPOINT,
  GOOGLE_REVOKE_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  GoogleApiError,
  GoogleAuthError,
  GoogleConfigError,
  buildAuthUrl,
  buildRedirectUri,
  classifyGoogleError,
  exchangeCode,
  fetchUserInfo,
  getGoogleOAuthConfig,
  hasScope,
  isGoogleConfigured,
  listCalendars,
  refreshAccessToken,
  revokeToken,
  tokenNeedsRefresh,
} from '../../lib/google/calendar-client.ts';
import { withAccessToken, type CalendarConnection } from '../../lib/google/connection.ts';
import { decryptSecret, encryptSecret } from '../../lib/crypto/tokens.ts';

const CONFIG = { clientId: 'test-client-id.apps.example', clientSecret: 'test-client-secret' };
const REDIRECT_URI = 'https://app.example/api/calendar/google/callback';
const NOW = Date.parse('2026-10-03T12:00:00.000Z');

// Test-only key. Never a real secret.
const TEST_KEY = 'c3'.repeat(32);
const ORIGINAL_KEY = process.env.TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

after(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
  else process.env.TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
});

// ── Fakes ───────────────────────────────────────────────────────────────────────

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

type Reply = { status: number; body?: unknown } | Error;

/** A fetch that answers from a queue and records what it was asked. Never touches the network. */
function fakeFetch(replies: Reply[]) {
  const calls: RecordedCall[] = [];
  const queue = [...replies];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? init.body : '',
    });
    const reply = queue.shift();
    if (!reply) throw new Error('fakeFetch: no reply left for ' + String(input));
    if (reply instanceof Error) throw reply;
    return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

interface RecordedUpdate {
  table: string;
  values: Record<string, unknown>;
  filters: [string, unknown][];
}

/** Stands in for the Supabase client: records update().eq() calls and reports success. */
function fakeDb() {
  const updates: RecordedUpdate[] = [];
  const db = {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          const record: RecordedUpdate = { table, values, filters: [] };
          updates.push(record);
          const chain = {
            eq(column: string, value: unknown) {
              record.filters.push([column, value]);
              return chain;
            },
            then(resolve: (result: { error: null }) => void) {
              resolve({ error: null });
            },
          };
          return chain;
        },
      };
    },
  };
  return { db: db as never, updates };
}

function connection(overrides: Partial<CalendarConnection> = {}): CalendarConnection {
  return {
    id: 'conn-1',
    user_id: 'user-1',
    provider: 'google',
    account_email: 'person@example.com',
    provider_sub: 'sub-1',
    access_token_enc: encryptSecret('stored-access-token'),
    refresh_token_enc: encryptSecret('stored-refresh-token'),
    token_expires_at: new Date(NOW + 30 * 60_000).toISOString(),
    scopes: `openid email ${CALENDAR_READONLY_SCOPE}`,
    status: 'active',
    settings: {},
    last_synced_at: null,
    last_error: null,
    created_at: new Date(NOW).toISOString(),
    updated_at: new Date(NOW).toISOString(),
    ...overrides,
  };
}

// ── Authorization URL ───────────────────────────────────────────────────────────

test('buildAuthUrl: Google endpoint with the documented parameters', () => {
  const url = new URL(buildAuthUrl('signed-state', REDIRECT_URI, { config: CONFIG }));

  assert.equal(`${url.origin}${url.pathname}`, GOOGLE_AUTH_ENDPOINT);
  assert.equal(url.searchParams.get('client_id'), CONFIG.clientId);
  assert.equal(url.searchParams.get('redirect_uri'), REDIRECT_URI);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.get('include_granted_scopes'), 'true');
  assert.equal(url.searchParams.get('state'), 'signed-state');
  assert.equal(url.searchParams.get('login_hint'), null);
});

test('buildAuthUrl: asks for read-only calendar access plus openid email, and nothing else', () => {
  const url = new URL(buildAuthUrl('s', REDIRECT_URI, { config: CONFIG }));
  const scopes = (url.searchParams.get('scope') ?? '').split(' ');

  // Google's OpenID Connect guide: the scope parameter "must begin with the openid value".
  assert.equal(scopes[0], 'openid');
  assert.deepEqual([...scopes].sort(), ['email', CALENDAR_READONLY_SCOPE, 'openid'].sort());
  // Read-only: no write scope of any kind.
  assert.ok(!scopes.includes('https://www.googleapis.com/auth/calendar'));
  assert.ok(!scopes.includes('https://www.googleapis.com/auth/calendar.events'));
});

test('buildAuthUrl: never puts the client secret in the URL', () => {
  const url = buildAuthUrl('s', REDIRECT_URI, { config: CONFIG });
  assert.ok(!url.includes(CONFIG.clientSecret));
});

test('buildAuthUrl: login_hint is added only when an account is given', () => {
  const url = new URL(buildAuthUrl('s', REDIRECT_URI, { config: CONFIG, loginHint: 'person@example.com' }));
  assert.equal(url.searchParams.get('login_hint'), 'person@example.com');
});

test('buildRedirectUri: the request origin plus the callback path, no doubled slash', () => {
  assert.equal(buildRedirectUri('https://app.example'), REDIRECT_URI);
  assert.equal(buildRedirectUri('https://app.example/'), REDIRECT_URI);
  assert.equal(buildRedirectUri('http://localhost:3000'), 'http://localhost:3000/api/calendar/google/callback');
});

// ── Configuration ───────────────────────────────────────────────────────────────

test('getGoogleOAuthConfig: a missing value throws a labelled error that names it', () => {
  assert.throws(
    () => getGoogleOAuthConfig({}),
    (err: unknown) => {
      assert.ok(err instanceof GoogleConfigError);
      assert.deepEqual(err.missing, ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET']);
      assert.match(err.message, /GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are not set/);
      return true;
    },
  );
  assert.throws(
    () => getGoogleOAuthConfig({ GOOGLE_OAUTH_CLIENT_ID: 'id', GOOGLE_OAUTH_CLIENT_SECRET: '  ' }),
    (err: unknown) => err instanceof GoogleConfigError && err.missing.join() === 'GOOGLE_OAUTH_CLIENT_SECRET',
  );
});

test('getGoogleOAuthConfig / isGoogleConfigured: both values present', () => {
  const env = { GOOGLE_OAUTH_CLIENT_ID: ' id ', GOOGLE_OAUTH_CLIENT_SECRET: 'secret' };
  assert.deepEqual(getGoogleOAuthConfig(env), { clientId: 'id', clientSecret: 'secret' });
  assert.equal(isGoogleConfigured(env), true);
  assert.equal(isGoogleConfigured({ GOOGLE_OAUTH_CLIENT_ID: 'id' }), false);
});

// ── Error classification ────────────────────────────────────────────────────────

test('classifyGoogleError: invalid_grant becomes GoogleAuthError', () => {
  const err = classifyGoogleError(
    400,
    { error: 'invalid_grant', error_description: 'Token has been expired or revoked.', error_subtype: 'invalid_rapt' },
    'refresh',
  );
  assert.ok(err instanceof GoogleAuthError);
  assert.equal(err.code, 'invalid_grant');
  assert.equal(err.description, 'Token has been expired or revoked.');
  assert.equal(err.subtype, 'invalid_rapt');
});

test('classifyGoogleError: any other OAuth error becomes GoogleApiError with its status and code', () => {
  const err = classifyGoogleError(401, { error: 'invalid_client', error_description: 'Unauthorized' }, 'exchange');
  assert.ok(err instanceof GoogleApiError);
  assert.ok(!(err instanceof GoogleAuthError));
  assert.equal(err.status, 401);
  assert.equal(err.code, 'invalid_client');
});

test('classifyGoogleError: reads the Calendar API error shape', () => {
  const err = classifyGoogleError(
    403,
    {
      error: {
        code: 403,
        message: 'Rate Limit Exceeded',
        errors: [{ domain: 'usageLimits', reason: 'rateLimitExceeded', message: 'Rate Limit Exceeded' }],
      },
    },
    'calendar list',
  );
  assert.ok(err instanceof GoogleApiError);
  assert.equal(err.status, 403);
  assert.equal(err.code, 'rateLimitExceeded');
  assert.match(err.message, /Rate Limit Exceeded/);
});

test('classifyGoogleError: a body that is not JSON still gives a GoogleApiError with the status', () => {
  for (const body of [null, 'Bad Gateway', 42, []]) {
    const err = classifyGoogleError(502, body, 'calendar list');
    assert.ok(err instanceof GoogleApiError);
    assert.equal(err.status, 502);
    assert.equal(err.code, null);
  }
});

// ── Token expiry ────────────────────────────────────────────────────────────────

test('tokenNeedsRefresh: refresh when the token expires within 60 seconds', () => {
  const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

  assert.equal(tokenNeedsRefresh(at(61_000), NOW), false);
  assert.equal(tokenNeedsRefresh(at(60 * 60_000), NOW), false);
  assert.equal(tokenNeedsRefresh(at(60_000), NOW), true);
  assert.equal(tokenNeedsRefresh(at(59_000), NOW), true);
  assert.equal(tokenNeedsRefresh(at(0), NOW), true);
  assert.equal(tokenNeedsRefresh(at(-5_000), NOW), true);
  assert.equal(tokenNeedsRefresh(new Date(NOW + 61_000), NOW), false);
});

test('tokenNeedsRefresh: a missing or unreadable expiry means refresh', () => {
  assert.equal(tokenNeedsRefresh(null, NOW), true);
  assert.equal(tokenNeedsRefresh(undefined, NOW), true);
  assert.equal(tokenNeedsRefresh('', NOW), true);
  assert.equal(tokenNeedsRefresh('not a date', NOW), true);
});

test('hasScope: matches whole scopes only', () => {
  const granted = `openid email ${CALENDAR_READONLY_SCOPE}`;
  assert.equal(hasScope(granted, CALENDAR_READONLY_SCOPE), true);
  assert.equal(hasScope('openid email', CALENDAR_READONLY_SCOPE), false);
  assert.equal(hasScope(`${CALENDAR_READONLY_SCOPE}.extra`, CALENDAR_READONLY_SCOPE), false);
  assert.equal(hasScope(null, CALENDAR_READONLY_SCOPE), false);
});

// ── Token calls ─────────────────────────────────────────────────────────────────

test('exchangeCode: posts the documented form fields and reads the tokens', async () => {
  const { fetchImpl, calls } = fakeFetch([
    {
      status: 200,
      body: {
        access_token: 'new-access',
        expires_in: 3599,
        refresh_token: 'new-refresh',
        scope: `openid email ${CALENDAR_READONLY_SCOPE}`,
        token_type: 'Bearer',
        some_future_field: 'ignored',
      },
    },
  ]);

  const tokens = await exchangeCode('auth-code', REDIRECT_URI, { config: CONFIG, fetchImpl, now: NOW });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, GOOGLE_TOKEN_ENDPOINT);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[0].body)), {
    code: 'auth-code',
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  assert.deepEqual(tokens, {
    accessToken: 'new-access',
    expiresAt: new Date(NOW + 3599_000).toISOString(),
    refreshToken: 'new-refresh',
    scope: `openid email ${CALENDAR_READONLY_SCOPE}`,
  });
});

test('exchangeCode: a response without a refresh token reports null, not an empty string', async () => {
  const { fetchImpl } = fakeFetch([{ status: 200, body: { access_token: 'a', expires_in: 3599 } }]);
  const tokens = await exchangeCode('auth-code', REDIRECT_URI, { config: CONFIG, fetchImpl, now: NOW });
  assert.equal(tokens.refreshToken, null);
  assert.equal(tokens.scope, null);
});

test('exchangeCode: a used or expired code (invalid_grant) throws GoogleAuthError', async () => {
  const { fetchImpl } = fakeFetch([
    { status: 400, body: { error: 'invalid_grant', error_description: 'Bad Request' } },
  ]);
  await assert.rejects(
    exchangeCode('stale-code', REDIRECT_URI, { config: CONFIG, fetchImpl }),
    (err: unknown) => err instanceof GoogleAuthError && err.code === 'invalid_grant',
  );
});

test('a network failure becomes GoogleApiError with status 0', async () => {
  const { fetchImpl } = fakeFetch([new TypeError('fetch failed')]);
  await assert.rejects(
    exchangeCode('auth-code', REDIRECT_URI, { config: CONFIG, fetchImpl }),
    (err: unknown) => err instanceof GoogleApiError && err.status === 0 && err.code === 'network_error',
  );
});

test('a 200 without an access token is rejected instead of trusted', async () => {
  const { fetchImpl } = fakeFetch([{ status: 200, body: { token_type: 'Bearer' } }]);
  await assert.rejects(
    exchangeCode('auth-code', REDIRECT_URI, { config: CONFIG, fetchImpl }),
    (err: unknown) => err instanceof GoogleApiError && err.code === 'malformed_response',
  );
});

test('refreshAccessToken: posts grant_type=refresh_token; the stored refresh token stays in use', async () => {
  const { fetchImpl, calls } = fakeFetch([
    { status: 200, body: { access_token: 'refreshed-access', expires_in: 3920, token_type: 'Bearer' } },
  ]);

  const tokens = await refreshAccessToken('stored-refresh', { config: CONFIG, fetchImpl, now: NOW });

  assert.equal(calls[0].url, GOOGLE_TOKEN_ENDPOINT);
  assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[0].body)), {
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    refresh_token: 'stored-refresh',
    grant_type: 'refresh_token',
  });
  assert.equal(tokens.accessToken, 'refreshed-access');
  assert.equal(tokens.expiresAt, new Date(NOW + 3920_000).toISOString());
  assert.equal(tokens.refreshToken, null);
});

test('refreshAccessToken: invalid_grant throws GoogleAuthError; a server error throws GoogleApiError', async () => {
  const revoked = fakeFetch([
    { status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } },
  ]);
  await assert.rejects(
    refreshAccessToken('dead-refresh', { config: CONFIG, fetchImpl: revoked.fetchImpl }),
    (err: unknown) => err instanceof GoogleAuthError,
  );

  const down = fakeFetch([{ status: 503, body: 'unavailable' }]);
  await assert.rejects(
    refreshAccessToken('stored-refresh', { config: CONFIG, fetchImpl: down.fetchImpl }),
    (err: unknown) => err instanceof GoogleApiError && !(err instanceof GoogleAuthError) && err.status === 503,
  );
});

test('error messages never contain the token or the client secret', async () => {
  const { fetchImpl } = fakeFetch([{ status: 400, body: { error: 'invalid_grant' } }]);
  await assert.rejects(
    refreshAccessToken('very-secret-refresh-token', { config: CONFIG, fetchImpl }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(!err.message.includes('very-secret-refresh-token'));
      assert.ok(!err.message.includes(CONFIG.clientSecret));
      return true;
    },
  );
});

// ── Revoke ──────────────────────────────────────────────────────────────────────

test('revokeToken: posts the token as a form field; 200 means revoked', async () => {
  const { fetchImpl, calls } = fakeFetch([{ status: 200, body: {} }]);

  assert.deepEqual(await revokeToken('token-to-revoke', { fetchImpl }), { alreadyInvalid: false });
  assert.equal(calls[0].url, GOOGLE_REVOKE_ENDPOINT);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(calls[0].body, 'token=token-to-revoke');
});

test('revokeToken: a token Google no longer knows counts as already revoked', async () => {
  const { fetchImpl } = fakeFetch([{ status: 400, body: { error: 'invalid_token' } }]);
  assert.deepEqual(await revokeToken('old-token', { fetchImpl }), { alreadyInvalid: true });
});

test('revokeToken: any other failure throws, so the caller knows nothing was revoked', async () => {
  const badRequest = fakeFetch([{ status: 400, body: { error: 'invalid_request' } }]);
  await assert.rejects(
    revokeToken('t', { fetchImpl: badRequest.fetchImpl }),
    (err: unknown) => err instanceof GoogleApiError && err.status === 400 && err.code === 'invalid_request',
  );

  const down = fakeFetch([{ status: 500 }]);
  await assert.rejects(
    revokeToken('t', { fetchImpl: down.fetchImpl }),
    (err: unknown) => err instanceof GoogleApiError && err.status === 500,
  );
});

// ── Account ─────────────────────────────────────────────────────────────────────

test('fetchUserInfo: sends the access token as a Bearer header and returns sub and email', async () => {
  const { fetchImpl, calls } = fakeFetch([
    { status: 200, body: { sub: '1076915035', email: 'person@example.com', email_verified: true } },
  ]);

  assert.deepEqual(await fetchUserInfo('access-1', { fetchImpl }), { sub: '1076915035', email: 'person@example.com' });
  assert.equal(calls[0].url, GOOGLE_USERINFO_ENDPOINT);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].headers.Authorization, 'Bearer access-1');
});

test('fetchUserInfo: a withheld email is null; a missing sub is an error', async () => {
  const noEmail = fakeFetch([{ status: 200, body: { sub: '1076915035' } }]);
  assert.deepEqual(await fetchUserInfo('a', { fetchImpl: noEmail.fetchImpl }), { sub: '1076915035', email: null });

  const noSub = fakeFetch([{ status: 200, body: { email: 'person@example.com' } }]);
  await assert.rejects(
    fetchUserInfo('a', { fetchImpl: noSub.fetchImpl }),
    (err: unknown) => err instanceof GoogleApiError && err.code === 'malformed_response',
  );
});

// ── Calendar list ───────────────────────────────────────────────────────────────

test('listCalendars: follows nextPageToken to the last page and merges every page', async () => {
  const { fetchImpl, calls } = fakeFetch([
    {
      status: 200,
      body: {
        kind: 'calendar#calendarList',
        nextPageToken: 'page-2',
        items: [
          {
            id: 'person@example.com',
            summary: 'person@example.com',
            summaryOverride: 'Personal',
            timeZone: 'America/Chicago',
            backgroundColor: '#0088aa',
            primary: true,
            accessRole: 'owner',
          },
        ],
      },
    },
    {
      status: 200,
      body: {
        nextPageToken: 'page-3',
        items: [
          { id: 'team@group.calendar.google.com', summary: 'Team', accessRole: 'reader' },
          { summary: 'entry without an id is skipped' },
        ],
      },
    },
    {
      status: 200,
      body: {
        nextSyncToken: 'sync-token-not-used-here',
        items: [{ id: 'gigs@group.calendar.google.com', summary: 'Gigs', timeZone: 'America/New_York' }],
      },
    },
  ]);

  const calendars = await listCalendars('access-1', { fetchImpl });

  assert.equal(calls.length, 3);
  for (const call of calls) {
    const url = new URL(call.url);
    assert.equal(`${url.origin}${url.pathname}`, GOOGLE_CALENDAR_LIST_ENDPOINT);
    assert.equal(url.searchParams.get('maxResults'), '250');
    assert.equal(url.searchParams.get('minAccessRole'), 'reader');
    assert.equal(call.method, 'GET');
    assert.equal(call.headers.Authorization, 'Bearer access-1');
  }
  assert.equal(new URL(calls[0].url).searchParams.get('pageToken'), null);
  assert.equal(new URL(calls[1].url).searchParams.get('pageToken'), 'page-2');
  assert.equal(new URL(calls[2].url).searchParams.get('pageToken'), 'page-3');

  assert.deepEqual(calendars, [
    {
      id: 'person@example.com',
      summary: 'Personal',
      timeZone: 'America/Chicago',
      color: '#0088aa',
      primary: true,
      accessRole: 'owner',
    },
    {
      id: 'team@group.calendar.google.com',
      summary: 'Team',
      timeZone: null,
      color: null,
      primary: false,
      accessRole: 'reader',
    },
    {
      id: 'gigs@group.calendar.google.com',
      summary: 'Gigs',
      timeZone: 'America/New_York',
      color: null,
      primary: false,
      accessRole: null,
    },
  ]);
});

test('listCalendars: one page with no nextPageToken makes one request', async () => {
  const { fetchImpl, calls } = fakeFetch([{ status: 200, body: { items: [] } }]);
  assert.deepEqual(await listCalendars('access-1', { fetchImpl }), []);
  assert.equal(calls.length, 1);
});

test('listCalendars: an expired access token (401) throws GoogleApiError with status 401', async () => {
  const { fetchImpl } = fakeFetch([
    {
      status: 401,
      body: { error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } },
    },
  ]);
  await assert.rejects(
    listCalendars('expired', { fetchImpl }),
    (err: unknown) => err instanceof GoogleApiError && err.status === 401 && err.code === 'authError',
  );
});

test('listCalendars: a failure on a later page fails the whole call (no partial list)', async () => {
  const { fetchImpl } = fakeFetch([
    { status: 200, body: { nextPageToken: 'page-2', items: [{ id: 'a', summary: 'A' }] } },
    { status: 500, body: { error: { code: 500, message: 'Backend Error' } } },
  ]);
  await assert.rejects(
    listCalendars('access-1', { fetchImpl }),
    (err: unknown) => err instanceof GoogleApiError && err.status === 500,
  );
});

test('listCalendars: a nextPageToken that never ends stops after 20 pages', async () => {
  const endless: Reply[] = Array.from({ length: 25 }, () => ({
    status: 200,
    body: { nextPageToken: 'again', items: [] },
  }));
  const { fetchImpl, calls } = fakeFetch(endless);
  await assert.rejects(
    listCalendars('access-1', { fetchImpl }),
    (err: unknown) => err instanceof GoogleApiError && err.code === 'too_many_pages',
  );
  assert.equal(calls.length, 20);
});

// ── withAccessToken ─────────────────────────────────────────────────────────────

test('withAccessToken: a token with time left is used as is (no refresh, nothing written)', async () => {
  const { db, updates } = fakeDb();
  const { fetchImpl, calls } = fakeFetch([]);

  const seen = await withAccessToken(db, connection(), async (token) => token, { config: CONFIG, fetchImpl, now: NOW });

  assert.equal(seen, 'stored-access-token');
  assert.equal(calls.length, 0);
  assert.equal(updates.length, 0);
});

test('withAccessToken: a token expiring within 60 seconds is refreshed and saved encrypted', async () => {
  const { db, updates } = fakeDb();
  const { fetchImpl, calls } = fakeFetch([
    { status: 200, body: { access_token: 'refreshed-access', expires_in: 3600 } },
  ]);
  const conn = connection({ token_expires_at: new Date(NOW + 30_000).toISOString() });

  const seen = await withAccessToken(db, conn, async (token) => token, { config: CONFIG, fetchImpl, now: NOW });

  assert.equal(seen, 'refreshed-access');
  assert.equal(calls.length, 1);
  assert.equal(new URLSearchParams(calls[0].body).get('refresh_token'), 'stored-refresh-token');

  assert.equal(updates.length, 1);
  assert.equal(updates[0].table, 'calendar_connections');
  assert.deepEqual(updates[0].filters, [['id', 'conn-1']]);
  const saved = updates[0].values;
  assert.equal(saved.token_expires_at, new Date(NOW + 3600_000).toISOString());
  assert.equal(saved.status, 'active');
  assert.equal(saved.last_error, null);
  // Stored encrypted, never in plain text; the refresh token is left alone.
  assert.notEqual(saved.access_token_enc, 'refreshed-access');
  assert.ok(!JSON.stringify(saved).includes('refreshed-access'));
  assert.equal(decryptSecret(saved.access_token_enc as string), 'refreshed-access');
  assert.ok(!('refresh_token_enc' in saved));

  // The connection object is brought up to date, so a second call does not refresh again.
  const again = await withAccessToken(db, conn, async (token) => token, { config: CONFIG, fetchImpl, now: NOW });
  assert.equal(again, 'refreshed-access');
  assert.equal(calls.length, 1);
});

test('withAccessToken: invalid_grant marks the connection needs_reauth and rethrows', async () => {
  const { db, updates } = fakeDb();
  const { fetchImpl } = fakeFetch([
    { status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } },
  ]);
  const conn = connection({ token_expires_at: new Date(NOW - 1000).toISOString() });
  let ran = false;

  await assert.rejects(
    withAccessToken(db, conn, async () => { ran = true; }, { config: CONFIG, fetchImpl, now: NOW }),
    (err: unknown) => err instanceof GoogleAuthError,
  );

  assert.equal(ran, false);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].values.status, 'needs_reauth');
  assert.match(String(updates[0].values.last_error), /invalid_grant: Token has been expired or revoked\./);
  assert.ok(!String(updates[0].values.last_error).includes('stored-refresh-token'));
  assert.equal(conn.status, 'needs_reauth');
});

test('withAccessToken: a connection already marked needs_reauth fails without calling Google', async () => {
  const { db, updates } = fakeDb();
  const { fetchImpl, calls } = fakeFetch([]);
  const conn = connection({ status: 'needs_reauth', last_error: 'Reconnect Google Calendar.' });

  await assert.rejects(
    withAccessToken(db, conn, async (token) => token, { config: CONFIG, fetchImpl, now: NOW }),
    (err: unknown) => err instanceof GoogleAuthError,
  );
  assert.equal(calls.length, 0);
  assert.equal(updates.length, 0);
});

test('withAccessToken: a 401 from Google refreshes once and runs the call again', async () => {
  const { db, updates } = fakeDb();
  const { fetchImpl, calls } = fakeFetch([
    { status: 200, body: { access_token: 'refreshed-access', expires_in: 3600 } },
  ]);
  const tokensSeen: string[] = [];

  const result = await withAccessToken(
    db,
    connection(),
    async (token) => {
      tokensSeen.push(token);
      if (token === 'stored-access-token') throw new GoogleApiError(401, 'authError', 'Invalid Credentials', 'test');
      return 'ok';
    },
    { config: CONFIG, fetchImpl, now: NOW },
  );

  assert.equal(result, 'ok');
  assert.deepEqual(tokensSeen, ['stored-access-token', 'refreshed-access']);
  assert.equal(calls.length, 1);
  assert.equal(updates.length, 1);
});

test('withAccessToken: a second 401 after the refresh is not retried again', async () => {
  const { db } = fakeDb();
  const { fetchImpl, calls } = fakeFetch([
    { status: 200, body: { access_token: 'refreshed-access', expires_in: 3600 } },
  ]);
  let runs = 0;

  await assert.rejects(
    withAccessToken(
      db,
      connection(),
      async () => {
        runs += 1;
        throw new GoogleApiError(401, 'authError', 'Invalid Credentials', 'test');
      },
      { config: CONFIG, fetchImpl, now: NOW },
    ),
    (err: unknown) => err instanceof GoogleApiError && err.status === 401,
  );
  assert.equal(runs, 2);
  assert.equal(calls.length, 1);
});

test('withAccessToken: an error that is not a 401 is passed on untouched', async () => {
  const { db, updates } = fakeDb();
  const { fetchImpl, calls } = fakeFetch([]);

  await assert.rejects(
    withAccessToken(
      db,
      connection(),
      async () => { throw new GoogleApiError(403, 'rateLimitExceeded', 'Rate Limit Exceeded', 'test'); },
      { config: CONFIG, fetchImpl, now: NOW },
    ),
    (err: unknown) => err instanceof GoogleApiError && err.status === 403,
  );
  assert.equal(calls.length, 0);
  assert.equal(updates.length, 0);
});

test('withAccessToken: tokens saved under a different key give a clear error, not garbage', async () => {
  const { db } = fakeDb();
  const { fetchImpl } = fakeFetch([]);
  const conn = connection();
  process.env.TOKEN_ENCRYPTION_KEY = 'd4'.repeat(32);

  await assert.rejects(
    withAccessToken(db, conn, async (token) => token, { config: CONFIG, fetchImpl, now: NOW }),
    (err: unknown) => err instanceof Error && err.name === 'StoredTokenError',
  );
});
