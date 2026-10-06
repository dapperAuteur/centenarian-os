// tests/unit/witus-signing.test.ts
// The X-Witus-* signer (lib/events/sign-request.ts), the RideWitUS request
// check built on the existing verifier (lib/integrations/ridewitus/auth.ts),
// and the WitUS identity lookup (lib/witus/identity.ts).
// Run: npm run test:unit
//
// Secrets, subjects and ids are made up. No network: fetch is a fake.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postSigned, signedGetBody, signedHeaders, witusSignature } from '../../lib/events/sign-request.ts';
import type { FetchLike } from '../../lib/events/sign-request.ts';
import { verifyWitusSignature } from '../../lib/events/verify-signature.ts';
import { RIDEWITUS_SOURCE, verifyRideRequest } from '../../lib/integrations/ridewitus/auth.ts';
import { isWitusSub, userIdForWitusSub, witusSubForUserId } from '../../lib/witus/identity.ts';
import { FakeDb } from './fake-supabase.ts';

const SECRET = 'test-secret-0123456789abcdef0123456789abcdef';
const NOW = 1_790_000_000;

function headerReader(h: Record<string, string>) {
  const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

// ── Signer + verifier round trip ────────────────────────────────────────────

test('signedHeaders produce a signature the existing verifier accepts', () => {
  const rawBody = JSON.stringify({ witus_sub: 'sub-1', scopes: ['envelopes'] });
  const h = signedHeaders({ secret: SECRET, source: RIDEWITUS_SOURCE, rawBody, nowSeconds: NOW });
  assert.equal(h['X-Witus-Timestamp'], String(NOW));
  assert.equal(h['X-Witus-Signature'], `sha256=${witusSignature(SECRET, NOW, rawBody)}`);
  const verdict = verifyWitusSignature({
    rawBody,
    signatureHeader: h['X-Witus-Signature'],
    timestampHeader: h['X-Witus-Timestamp'],
    sourceHeader: h['X-Witus-Source'],
    secret: SECRET,
    nowSeconds: NOW + 10,
  });
  assert.deepEqual(verdict, { ok: true, source: RIDEWITUS_SOURCE });
});

test('verifyRideRequest: accepts ride-witus, refuses wrong source, tampering, staleness, wrong secret', () => {
  const rawBody = '{"witus_sub":"sub-1"}';
  const good = signedHeaders({ secret: SECRET, source: RIDEWITUS_SOURCE, rawBody, nowSeconds: NOW });
  assert.deepEqual(verifyRideRequest({ signedBody: rawBody, headers: headerReader({ ...good }), secret: SECRET, nowSeconds: NOW }), { ok: true });

  const other = signedHeaders({ secret: SECRET, source: 'work-witus', rawBody, nowSeconds: NOW });
  assert.deepEqual(verifyRideRequest({ signedBody: rawBody, headers: headerReader({ ...other }), secret: SECRET, nowSeconds: NOW }), {
    ok: false,
    reason: 'wrong_source',
    status: 401,
  });

  const tampered = verifyRideRequest({ signedBody: '{"witus_sub":"sub-2"}', headers: headerReader({ ...good }), secret: SECRET, nowSeconds: NOW });
  assert.equal(tampered.ok, false);
  assert.equal(!tampered.ok && tampered.reason, 'signature_mismatch');

  const stale = verifyRideRequest({ signedBody: rawBody, headers: headerReader({ ...good }), secret: SECRET, nowSeconds: NOW + 301 });
  assert.equal(!stale.ok && stale.reason, 'stale_timestamp');

  const wrongSecret = verifyRideRequest({ signedBody: rawBody, headers: headerReader({ ...good }), secret: `${SECRET}x`, nowSeconds: NOW });
  assert.equal(!wrongSecret.ok && wrongSecret.status, 401);

  const noSecret = verifyRideRequest({ signedBody: rawBody, headers: headerReader({ ...good }), secret: undefined, nowSeconds: NOW });
  assert.deepEqual(noSecret, { ok: false, reason: 'no_secret', status: 503 });

  const missing = verifyRideRequest({ signedBody: rawBody, headers: headerReader({}), secret: SECRET, nowSeconds: NOW });
  assert.equal(!missing.ok && missing.reason, 'missing_headers');
});

test('a GET signs its path and query, so editing witus_sub breaks the signature', () => {
  const sent = new URL('https://centos.example/api/v1/ride/vendors?witus_sub=sub-1&q=shell');
  const body = signedGetBody(sent);
  assert.equal(body, '/api/v1/ride/vendors?witus_sub=sub-1&q=shell');
  const h = signedHeaders({ secret: SECRET, source: RIDEWITUS_SOURCE, rawBody: body, nowSeconds: NOW });
  const ok = verifyRideRequest({ signedBody: signedGetBody(sent), headers: headerReader({ ...h }), secret: SECRET, nowSeconds: NOW });
  assert.deepEqual(ok, { ok: true });
  const edited = new URL('https://centos.example/api/v1/ride/vendors?witus_sub=sub-2&q=shell');
  const refused = verifyRideRequest({ signedBody: signedGetBody(edited), headers: headerReader({ ...h }), secret: SECRET, nowSeconds: NOW });
  assert.equal(!refused.ok && refused.reason, 'signature_mismatch');
});

test('postSigned sends exactly the bytes it signed and parses the answer', async () => {
  const seen: { url: string; headers: Record<string, string>; body?: string }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    seen.push({ url, headers: init.headers, body: init.body });
    return { ok: true, status: 200, text: async () => '{"accepted":1,"rejected":[]}' };
  };
  const result = await postSigned({ url: 'https://ride.example/api/events/envelope-balance', secret: SECRET, source: 'centenarianos', payload: { events: [{ a: 1 }] }, fetchImpl, nowSeconds: NOW });
  assert.equal(result.ok, true);
  assert.deepEqual(result.body, { accepted: 1, rejected: [] });
  assert.equal(seen.length, 1);
  const { headers, body } = seen[0];
  assert.equal(body, '{"events":[{"a":1}]}');
  assert.equal(headers['X-Witus-Signature'], `sha256=${witusSignature(SECRET, headers['X-Witus-Timestamp'], body!)}`);
  assert.equal(headers['X-Witus-Source'], 'centenarianos');
});

test('postSigned reports http errors and network errors without throwing', async () => {
  const failing: FetchLike = async () => ({ ok: false, status: 502, text: async () => 'bad gateway' });
  const r1 = await postSigned({ url: 'https://x.example', secret: SECRET, source: 's', payload: {}, fetchImpl: failing });
  assert.deepEqual([r1.ok, r1.status, r1.error], [false, 502, 'http_502']);

  const throwing: FetchLike = async () => {
    throw new Error('ECONNREFUSED');
  };
  const r2 = await postSigned({ url: 'https://x.example', secret: SECRET, source: 's', payload: {}, fetchImpl: throwing });
  assert.deepEqual([r2.ok, r2.status, r2.error], [false, 0, 'network_error']);
});

// ── Identity ────────────────────────────────────────────────────────────────

const USER = '11111111-1111-4111-8111-111111111111';

test('userIdForWitusSub resolves a known subject and types the unknown one', async () => {
  const db = new FakeDb();
  db.seed('witus_identities', [{ user_id: USER, witus_sub: 'sub-known' }]);
  assert.deepEqual(await userIdForWitusSub(db, 'sub-known'), { ok: true, userId: USER });
  assert.deepEqual(await userIdForWitusSub(db, 'sub-unknown'), { ok: false, reason: 'unknown_subject' });
  assert.deepEqual(await userIdForWitusSub(db, ''), { ok: false, reason: 'invalid_subject' });
  assert.deepEqual(await userIdForWitusSub(db, ' padded '), { ok: false, reason: 'invalid_subject' });
  assert.deepEqual(await userIdForWitusSub(db, 42), { ok: false, reason: 'invalid_subject' });
  assert.deepEqual(await userIdForWitusSub(db, 'x'.repeat(256)), { ok: false, reason: 'invalid_subject' });
});

test('witusSubForUserId is the reverse; no row = no_identity', async () => {
  const db = new FakeDb();
  db.seed('witus_identities', [{ user_id: USER, witus_sub: 'sub-known' }]);
  assert.deepEqual(await witusSubForUserId(db, USER), { ok: true, sub: 'sub-known' });
  assert.deepEqual(await witusSubForUserId(db, '22222222-2222-4222-8222-222222222222'), { ok: false, reason: 'no_identity' });
  assert.deepEqual(await witusSubForUserId(db, 'not-a-uuid'), { ok: false, reason: 'invalid_user' });
});

test('a failed lookup is lookup_failed, never unknown_subject', async () => {
  const db = new FakeDb();
  db.missingTables = ['witus_identities'];
  assert.deepEqual(await userIdForWitusSub(db, 'sub-known'), { ok: false, reason: 'lookup_failed' });
  assert.deepEqual(await witusSubForUserId(db, USER), { ok: false, reason: 'lookup_failed' });
  assert.equal(isWitusSub('auth0|abc'), true);
});
