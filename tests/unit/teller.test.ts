// tests/unit/teller.test.ts
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tellerRetryDelayMs,
  isEnrollmentAlreadyGone,
  TELLER_MAX_ATTEMPTS,
  TELLER_MAX_RETRY_WAIT_MS,
} from '../../lib/teller.ts';

const noJitter = () => 0;

test('429 retry: backs off exponentially without Retry-After', () => {
  assert.equal(tellerRetryDelayMs(1, undefined, 0, noJitter), 500);
  assert.equal(tellerRetryDelayMs(2, undefined, 0, noJitter), 1000);
});

test('429 retry: stops after the attempt cap', () => {
  assert.equal(TELLER_MAX_ATTEMPTS, 3);
  assert.equal(tellerRetryDelayMs(TELLER_MAX_ATTEMPTS, undefined, 0, noJitter), null);
  assert.equal(tellerRetryDelayMs(TELLER_MAX_ATTEMPTS, '1', 0, noJitter), null);
});

test('429 retry: honors Retry-After in seconds', () => {
  assert.equal(tellerRetryDelayMs(1, '2', 0, noJitter), 2000);
  assert.equal(tellerRetryDelayMs(1, '0', 0, noJitter), 0);
});

test('429 retry: honors Retry-After as an HTTP date', () => {
  const now = Date.parse('Mon, 21 Sep 2026 12:00:00 GMT');
  assert.equal(tellerRetryDelayMs(1, 'Mon, 21 Sep 2026 12:00:03 GMT', now, noJitter), 3000);
  // A date in the past means "retry now".
  assert.equal(tellerRetryDelayMs(1, 'Mon, 21 Sep 2026 11:59:00 GMT', now, noJitter), 0);
});

test('429 retry: gives up instead of retrying early when Retry-After exceeds the cap', () => {
  const tooLong = String(TELLER_MAX_RETRY_WAIT_MS / 1000 + 1);
  assert.equal(tellerRetryDelayMs(1, tooLong, 0, noJitter), null);
});

test('429 retry: ignores an unparseable Retry-After and falls back to backoff', () => {
  assert.equal(tellerRetryDelayMs(1, 'soon', 0, noJitter), 500);
});

test('revoke: 403, 410 and a plain 404 mean the enrollment is already gone', () => {
  assert.equal(isEnrollmentAlreadyGone(403, null), true);
  assert.equal(isEnrollmentAlreadyGone(410, 'account.closed'), true);
  assert.equal(isEnrollmentAlreadyGone(404, null), true);
  assert.equal(isEnrollmentAlreadyGone(404, 'not_found'), true);
});

test('revoke: a disconnected enrollment (404 enrollment.disconnected.*) is NOT gone', () => {
  assert.equal(isEnrollmentAlreadyGone(404, 'enrollment.disconnected'), false);
  assert.equal(isEnrollmentAlreadyGone(404, 'enrollment.disconnected.credentials_invalid'), false);
});

test('revoke: other failures are not treated as gone', () => {
  for (const status of [400, 401, 422, 429, 500, 502]) {
    assert.equal(isEnrollmentAlreadyGone(status, null), false, String(status));
  }
});
