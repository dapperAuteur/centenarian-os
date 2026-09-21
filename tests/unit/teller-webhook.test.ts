// tests/unit/teller-webhook.test.ts
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  verifyTellerSignature,
  TELLER_SIGNATURE_MAX_AGE_SECONDS,
} from '../../lib/teller-webhook.ts';

const SECRET = 'test_signing_secret_new';
const OLD_SECRET = 'test_signing_secret_old';
const BODY = JSON.stringify({
  id: 'wh_test',
  type: 'webhook.test',
  timestamp: '2026-09-21T12:00:00Z',
  payload: {},
});
const NOW_MS = 1_790_000_000_000;
const NOW_S = NOW_MS / 1000;

function sign(secret: string, timestamp: number, body: string = BODY): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

test('accepts a valid signature', () => {
  const header = `t=${NOW_S},v1=${sign(SECRET, NOW_S)}`;
  assert.deepEqual(
    verifyTellerSignature({ body: BODY, header, secret: SECRET, nowMs: NOW_MS }),
    { ok: true },
  );
});

test('accepts a signature right at the 3-minute limit', () => {
  const ts = NOW_S - TELLER_SIGNATURE_MAX_AGE_SECONDS;
  const header = `t=${ts},v1=${sign(SECRET, ts)}`;
  assert.equal(
    verifyTellerSignature({ body: BODY, header, secret: SECRET, nowMs: NOW_MS }).ok,
    true,
  );
});

test('rejects a stale timestamp (older than 3 minutes)', () => {
  const ts = NOW_S - TELLER_SIGNATURE_MAX_AGE_SECONDS - 1;
  const header = `t=${ts},v1=${sign(SECRET, ts)}`;
  assert.deepEqual(
    verifyTellerSignature({ body: BODY, header, secret: SECRET, nowMs: NOW_MS }),
    { ok: false, reason: 'stale_timestamp' },
  );
});

test('rejects a timestamp more than 3 minutes in the future', () => {
  const ts = NOW_S + TELLER_SIGNATURE_MAX_AGE_SECONDS + 1;
  const header = `t=${ts},v1=${sign(SECRET, ts)}`;
  assert.deepEqual(
    verifyTellerSignature({ body: BODY, header, secret: SECRET, nowMs: NOW_MS }),
    { ok: false, reason: 'stale_timestamp' },
  );
});

test('rejects a signature made with the wrong secret', () => {
  const header = `t=${NOW_S},v1=${sign('some_other_secret', NOW_S)}`;
  assert.deepEqual(
    verifyTellerSignature({ body: BODY, header, secret: SECRET, nowMs: NOW_MS }),
    { ok: false, reason: 'signature_mismatch' },
  );
});

test('rejects a valid signature over a tampered body', () => {
  const header = `t=${NOW_S},v1=${sign(SECRET, NOW_S)}`;
  assert.deepEqual(
    verifyTellerSignature({ body: BODY + ' ', header, secret: SECRET, nowMs: NOW_MS }),
    { ok: false, reason: 'signature_mismatch' },
  );
});

test('accepts multiple v1 values when the second one is valid (secret rotation)', () => {
  // Teller's rotation header: t=...,v1=signature_with_new_secret,v1=signature_with_old_secret.
  // Here the app still holds the OLD secret, so only the second v1 matches.
  const header = `t=${NOW_S},v1=${sign(SECRET, NOW_S)},v1=${sign(OLD_SECRET, NOW_S)}`;
  assert.deepEqual(
    verifyTellerSignature({ body: BODY, header, secret: OLD_SECRET, nowMs: NOW_MS }),
    { ok: true },
  );
});

test('rejects multiple v1 values when none is valid', () => {
  const header = `t=${NOW_S},v1=${sign('a', NOW_S)},v1=${sign('b', NOW_S)}`;
  assert.deepEqual(
    verifyTellerSignature({ body: BODY, header, secret: SECRET, nowMs: NOW_MS }),
    { ok: false, reason: 'signature_mismatch' },
  );
});

test('rejects a missing header', () => {
  assert.deepEqual(
    verifyTellerSignature({ body: BODY, header: null, secret: SECRET, nowMs: NOW_MS }),
    { ok: false, reason: 'missing_header' },
  );
  assert.deepEqual(
    verifyTellerSignature({ body: BODY, header: '', secret: SECRET, nowMs: NOW_MS }),
    { ok: false, reason: 'missing_header' },
  );
});

test('rejects when the secret is missing, even with a well-formed header', () => {
  const header = `t=${NOW_S},v1=${sign(SECRET, NOW_S)}`;
  assert.deepEqual(
    verifyTellerSignature({ body: BODY, header, secret: undefined, nowMs: NOW_MS }),
    { ok: false, reason: 'missing_secret' },
  );
  assert.deepEqual(
    verifyTellerSignature({ body: BODY, header, secret: '', nowMs: NOW_MS }),
    { ok: false, reason: 'missing_secret' },
  );
});

test('rejects malformed headers', () => {
  const sig = sign(SECRET, NOW_S);
  for (const header of [`v1=${sig}`, `t=${NOW_S}`, `t=abc,v1=${sig}`, 'garbage']) {
    assert.deepEqual(
      verifyTellerSignature({ body: BODY, header, secret: SECRET, nowMs: NOW_MS }),
      { ok: false, reason: 'malformed_header' },
      header,
    );
  }
});

test('tolerates spaces after commas in the header', () => {
  const header = `t=${NOW_S}, v1=${sign('a', NOW_S)}, v1=${sign(SECRET, NOW_S)}`;
  assert.equal(
    verifyTellerSignature({ body: BODY, header, secret: SECRET, nowMs: NOW_MS }).ok,
    true,
  );
});
