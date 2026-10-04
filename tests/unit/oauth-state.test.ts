// tests/unit/oauth-state.test.ts
// The OAuth state signer must work with either name of the Supabase JWT secret.
// Run: npm run test:unit

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasOAuthStateSecret, signOAuthState, verifyOAuthState } from '../../lib/oauth-state.ts';

const USER = '0fb0a347-2584-4baf-b742-3c167a98d088';

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const names = ['SUPABASE_JWT_SECRET', 'SUPABASE__SUPABASE_JWT_SECRET'];
  const saved = names.map((n) => process.env[n]);
  for (const n of names) delete process.env[n];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  try {
    fn();
  } finally {
    names.forEach((n, i) => {
      if (saved[i] === undefined) delete process.env[n];
      else process.env[n] = saved[i];
    });
  }
}

test('signs and verifies with the unprefixed secret', () => {
  withEnv({ SUPABASE_JWT_SECRET: 'a-secret' }, () => {
    assert.equal(hasOAuthStateSecret(), true);
    assert.equal(verifyOAuthState(signOAuthState(USER)), USER);
  });
});

test('signs and verifies with the integration-prefixed secret', () => {
  withEnv({ SUPABASE__SUPABASE_JWT_SECRET: 'b-secret' }, () => {
    assert.equal(hasOAuthStateSecret(), true);
    assert.equal(verifyOAuthState(signOAuthState(USER)), USER);
  });
});

test('the unprefixed name wins when both are set', () => {
  let state = '';
  withEnv({ SUPABASE_JWT_SECRET: 'a-secret', SUPABASE__SUPABASE_JWT_SECRET: 'b-secret' }, () => {
    state = signOAuthState(USER);
  });
  withEnv({ SUPABASE_JWT_SECRET: 'a-secret' }, () => assert.equal(verifyOAuthState(state), USER));
  withEnv({ SUPABASE__SUPABASE_JWT_SECRET: 'b-secret' }, () => assert.equal(verifyOAuthState(state), null));
});

test('with neither secret it reports not ready and signing throws', () => {
  withEnv({}, () => {
    assert.equal(hasOAuthStateSecret(), false);
    assert.throws(() => signOAuthState(USER), /SUPABASE_JWT_SECRET/);
  });
});

test('a tampered, malformed or expired state is rejected', () => {
  withEnv({ SUPABASE_JWT_SECRET: 'a-secret' }, () => {
    const state = signOAuthState(USER);
    const [id, ts, sig] = state.split(':');
    assert.equal(verifyOAuthState(`${id}:${ts}:${sig.slice(0, -1)}0`.replace(sig, sig === '0'.repeat(16) ? '1'.repeat(16) : '0'.repeat(16))), null);
    assert.equal(verifyOAuthState(`someone-else:${ts}:${sig}`), null);
    assert.equal(verifyOAuthState(`${id}:${ts}:short`), null);
    assert.equal(verifyOAuthState('not-a-state'), null);
    const old = String(Date.now() - 11 * 60 * 1000);
    assert.equal(verifyOAuthState(`${id}:${old}:${sig}`), null);
  });
});
