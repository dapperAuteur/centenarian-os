// lib/oauth-state.ts
// HMAC-signed OAuth state parameter to prevent CSRF attacks.
// State format: userId:timestamp:signature

import { createHmac } from 'crypto';

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('SUPABASE_JWT_SECRET required for OAuth state signing');
  return secret;
}

export function signOAuthState(userId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}:${timestamp}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 16);
  return `${payload}:${sig}`;
}

export function verifyOAuthState(state: string): string | null {
  const parts = state.split(':');
  if (parts.length !== 3) return null;

  const [userId, timestamp, sig] = parts;

  // Check expiry
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age > STATE_MAX_AGE_MS || age < 0) return null;

  // Verify signature
  const payload = `${userId}:${timestamp}`;
  const expected = createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 16);

  if (sig !== expected) return null;

  return userId;
}
