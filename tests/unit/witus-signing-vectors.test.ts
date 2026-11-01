// tests/unit/witus-signing-vectors.test.ts
// The shared signing vectors (tests/fixtures/witus-signing-vectors.json) against this repo's
// signer (lib/events/sign-request.ts) and verifier (lib/events/verify-signature.ts,
// lib/integrations/ridewitus/auth.ts). RideWitUS runs the same file against its own port, so a
// byte-level drift between the two implementations fails a test in one repo or the other instead
// of a production request.
//
// This repo holds the source of truth for the vector file. Change it here first, then copy it to
// RideWitUS unchanged (docs/integrations/ridewitus-contract.md, "Signing test vectors").
// Run: npm run test:unit

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signedGetBody, signedHeaders, witusSignature } from '../../lib/events/sign-request.ts';
import { MAX_SKEW_SECONDS, verifyWitusSignature } from '../../lib/events/verify-signature.ts';
import { RIDEWITUS_SOURCE, verifyRideRequest } from '../../lib/integrations/ridewitus/auth.ts';

interface VectorRequest {
  method: 'GET' | 'POST';
  path_and_query: string;
  body: string | null;
  signed_string: string | null;
  headers: Record<string, string>;
}

interface VectorCase {
  name: string;
  note: string;
  request: VectorRequest;
  receiver: { secret: string | null; expected_source: string; now: number };
  expect: { ok: true } | { ok: false; reason: string; status: number };
}

interface VectorFile {
  version: number;
  algorithm: { max_skew_seconds: number; reasons: string[] };
  vectors: VectorCase[];
  must_reject: VectorCase[];
}

const file = JSON.parse(
  readFileSync(new URL('../fixtures/witus-signing-vectors.json', import.meta.url), 'utf8'),
) as VectorFile;

/** What the receiver signs for this request: the raw body, or the path plus query as sent. */
function signedBodyOf(request: VectorRequest): string {
  if (request.method === 'GET') return signedGetBody(new URL(request.path_and_query, 'https://receiver.invalid'));
  return request.body ?? '';
}

function headerReader(headers: Record<string, string>) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

type Outcome = { ok: true } | { ok: false; reason: string; status: number };

/** The generic receiver check: signature, window, then the endpoint's expected source slug. */
function receive(c: VectorCase): Outcome {
  const h = headerReader(c.request.headers);
  const verdict = verifyWitusSignature({
    rawBody: signedBodyOf(c.request),
    signatureHeader: h.get('x-witus-signature'),
    timestampHeader: h.get('x-witus-timestamp'),
    sourceHeader: h.get('x-witus-source'),
    secret: c.receiver.secret ?? undefined,
    nowSeconds: c.receiver.now,
  });
  if (!verdict.ok) return { ok: false, reason: verdict.reason, status: verdict.reason === 'no_secret' ? 503 : 401 };
  if (verdict.source !== c.receiver.expected_source) return { ok: false, reason: 'wrong_source', status: 401 };
  return { ok: true };
}

test('vector file: version 1, the 300-second window, and every reason this repo can return', () => {
  assert.equal(file.version, 1);
  assert.equal(file.algorithm.max_skew_seconds, MAX_SKEW_SECONDS);
  assert.ok(file.vectors.length >= 4);
  assert.ok(file.must_reject.length >= 4);
  for (const c of file.must_reject) {
    assert.ok(!c.expect.ok);
    assert.ok(file.algorithm.reasons.includes((c.expect as { reason: string }).reason), c.name);
  }
});

for (const c of file.vectors) {
  test(`vector ${c.name}: the signer reproduces the headers byte for byte`, () => {
    const body = signedBodyOf(c.request);
    assert.equal(body, c.request.method === 'GET' ? c.request.path_and_query : c.request.body);
    const ts = c.request.headers['X-Witus-Timestamp'];
    assert.equal(c.request.signed_string, `${ts}.${body}`);
    assert.equal(c.request.headers['X-Witus-Signature'], `sha256=${witusSignature(c.receiver.secret!, ts, body)}`);
    const made = signedHeaders({
      secret: c.receiver.secret!,
      source: c.request.headers['X-Witus-Source'],
      rawBody: body,
      nowSeconds: Number(ts),
    });
    assert.equal(made['X-Witus-Source'], c.request.headers['X-Witus-Source']);
    assert.equal(made['X-Witus-Timestamp'], ts);
    assert.equal(made['X-Witus-Signature'], c.request.headers['X-Witus-Signature']);
  });

  test(`vector ${c.name}: the verifier accepts it`, () => {
    assert.deepEqual(receive(c), { ok: true });
    if (c.receiver.expected_source === RIDEWITUS_SOURCE) {
      const ride = verifyRideRequest({
        signedBody: signedBodyOf(c.request),
        headers: headerReader(c.request.headers),
        secret: c.receiver.secret ?? undefined,
        nowSeconds: c.receiver.now,
      });
      assert.deepEqual(ride, { ok: true });
    }
  });
}

for (const c of file.must_reject) {
  test(`must reject ${c.name}`, () => {
    assert.deepEqual(receive(c), c.expect);
    if (c.receiver.expected_source === RIDEWITUS_SOURCE) {
      // The RideWitUS endpoints on this side (vendors, resync) answer the same reason and status.
      const ride = verifyRideRequest({
        signedBody: signedBodyOf(c.request),
        headers: headerReader(c.request.headers),
        secret: c.receiver.secret ?? undefined,
        nowSeconds: c.receiver.now,
      });
      assert.deepEqual(ride, c.expect);
    }
  });
}
