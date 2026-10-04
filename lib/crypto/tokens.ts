// lib/crypto/tokens.ts
// Server-only — encrypts secrets (OAuth access/refresh tokens and the like) before
// they are stored in the database.
//
// Scheme: AES-256-GCM with a random 12-byte IV per value.
// Stored format: one lowercase hex string of  iv (12 bytes) + ciphertext + auth tag (16 bytes).
//
// Key: TOKEN_ENCRYPTION_KEY, 64 hex characters (32 bytes). Generate with
//   openssl rand -hex 32
// There is no fallback key. A missing or malformed key throws, so a secret is
// never stored unencrypted or under a key nobody chose.

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_ENV = 'TOKEN_ENCRYPTION_KEY';
const LABEL = '[lib/crypto/tokens]';

function getKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex) {
    throw new Error(
      `${LABEL} ${KEY_ENV} is not set. Generate one with "openssl rand -hex 32" and add it to the environment.`,
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `${LABEL} ${KEY_ENV} is malformed: it must be exactly 64 hex characters (32 bytes). Generate one with "openssl rand -hex 32".`,
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypts a secret for storage. Returns hex: iv + ciphertext + auth tag. */
export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('hex');
}

/**
 * Decrypts a value produced by encryptSecret. Throws when the value is not in
 * the stored format, was encrypted under a different key, or has been altered.
 */
export function decryptSecret(stored: string): string {
  const key = getKey();
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(stored) || stored.length < (IV_LEN + TAG_LEN) * 2) {
    throw new Error(`${LABEL} stored value is not an encrypted secret (expected hex: iv + ciphertext + auth tag).`);
  }
  const buf = Buffer.from(stored, 'hex');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
