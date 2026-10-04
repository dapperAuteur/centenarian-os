// lib/oauth-state.ts
// HMAC-signed OAuth state parameter to prevent CSRF attacks.
// State format: userId:timestamp:signature

import { createHmac, timingSafeEqual } from 'crypto';

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

// The Vercel-Supabase integration names this variable SUPABASE__SUPABASE_JWT_SECRET (prefixed), which is
// what this project's environment actually defines. Reading only the unprefixed name made every OAuth
// connect (wearables, Google Calendar) throw before it could redirect. Accept both; unprefixed wins.
function readSecret(): string | undefined {
  return process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE__SUPABASE_JWT_SECRET || undefined;
}

/** True when an OAuth state can be signed, so a route can say "not configured" instead of throwing. */
export function hasOAuthStateSecret(): boolean {
  return Boolean(readSecret());
}

function getSecret(): string {
  const secret = readSecret();
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET (or SUPABASE__SUPABASE_JWT_SECRET) required for OAuth state signing');
  }
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

  // Constant-time compare; lengths differ only for a malformed state.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return userId;
}
