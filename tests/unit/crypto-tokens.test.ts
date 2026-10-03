// tests/unit/crypto-tokens.test.ts
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)

import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv } from 'node:crypto';
import { encryptSecret, decryptSecret } from '../../lib/crypto/tokens.ts';

// Test-only keys. Never real secrets.
const KEY_A = 'a1'.repeat(32);
const KEY_B = 'b2'.repeat(32);
const ORIGINAL_KEY = process.env.TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = KEY_A;
});

after(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
  else process.env.TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
});

/** Flips one hex digit at `index` so the value still parses as hex. */
function flipHexAt(hex: string, index: number): string {
  const flipped = hex[index] === '0' ? '1' : '0';
  return hex.slice(0, index) + flipped + hex.slice(index + 1);
}

test('round trip: decryptSecret returns what encryptSecret was given', () => {
  for (const plain of ['token_abc123', '', 'ünïcödé ✓ 日本語', 'x'.repeat(4096)]) {
    assert.equal(decryptSecret(encryptSecret(plain)), plain);
  }
});

test('stored format: hex of iv (12 bytes) + ciphertext + auth tag (16 bytes)', () => {
  const plain = 'token_abc123';
  const stored = encryptSecret(plain);
  assert.match(stored, /^[0-9a-f]+$/);
  assert.equal(stored.length, (12 + Buffer.byteLength(plain, 'utf8') + 16) * 2);
  assert.ok(!stored.includes(plain));
});

test('stored format: reads a value built by hand in the documented layout', () => {
  const iv = Buffer.alloc(12, 7);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(KEY_A, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update('hand-built', 'utf8'), cipher.final()]);
  const stored = Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('hex');
  assert.equal(decryptSecret(stored), 'hand-built');
});

test('a fresh IV is used each time, so the same secret never encrypts the same way twice', () => {
  assert.notEqual(encryptSecret('same'), encryptSecret('same'));
});

test('tampered ciphertext fails to decrypt', () => {
  const stored = encryptSecret('token_abc123');
  // Byte 12 is the first ciphertext byte (hex index 24).
  assert.throws(() => decryptSecret(flipHexAt(stored, 24)));
});

test('tampered IV or auth tag fails to decrypt', () => {
  const stored = encryptSecret('token_abc123');
  assert.throws(() => decryptSecret(flipHexAt(stored, 0)));
  assert.throws(() => decryptSecret(flipHexAt(stored, stored.length - 1)));
});

test('a value encrypted under another key fails to decrypt', () => {
  const stored = encryptSecret('token_abc123');
  process.env.TOKEN_ENCRYPTION_KEY = KEY_B;
  assert.throws(() => decryptSecret(stored));
});

test('a value that is not an encrypted secret is rejected with a labelled error', () => {
  for (const bad of ['', 'revoked', 'abc', 'zz'.repeat(40), 'ab'.repeat(27)]) {
    assert.throws(() => decryptSecret(bad), /\[lib\/crypto\/tokens\] stored value is not an encrypted secret/, bad);
  }
});

test('bad key length fails for both encrypt and decrypt', () => {
  const stored = encryptSecret('token_abc123');
  for (const badKey of ['a1'.repeat(31), 'a1'.repeat(33), 'a1'.repeat(16), 'abc']) {
    process.env.TOKEN_ENCRYPTION_KEY = badKey;
    assert.throws(() => encryptSecret('x'), /TOKEN_ENCRYPTION_KEY is malformed/, `encrypt, length ${badKey.length}`);
    assert.throws(() => decryptSecret(stored), /TOKEN_ENCRYPTION_KEY is malformed/, `decrypt, length ${badKey.length}`);
  }
});

test('a 64-character key that is not hex fails', () => {
  process.env.TOKEN_ENCRYPTION_KEY = 'g'.repeat(64);
  assert.throws(() => encryptSecret('x'), /TOKEN_ENCRYPTION_KEY is malformed/);
});

test('a missing key fails with a labelled error', () => {
  delete process.env.TOKEN_ENCRYPTION_KEY;
  assert.throws(() => encryptSecret('x'), /\[lib\/crypto\/tokens\] TOKEN_ENCRYPTION_KEY is not set/);
  process.env.TOKEN_ENCRYPTION_KEY = '';
  assert.throws(() => encryptSecret('x'), /\[lib\/crypto\/tokens\] TOKEN_ENCRYPTION_KEY is not set/);
});

test('there is no fallback to the old Teller key', () => {
  delete process.env.TOKEN_ENCRYPTION_KEY;
  const originalTellerKey = process.env.TELLER_ENCRYPTION_KEY;
  process.env.TELLER_ENCRYPTION_KEY = KEY_A;
  try {
    assert.throws(() => encryptSecret('x'), /TOKEN_ENCRYPTION_KEY is not set/);
  } finally {
    if (originalTellerKey === undefined) delete process.env.TELLER_ENCRYPTION_KEY;
    else process.env.TELLER_ENCRYPTION_KEY = originalTellerKey;
  }
});
