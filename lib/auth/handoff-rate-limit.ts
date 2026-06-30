// lib/auth/handoff-rate-limit.ts
// Best-effort, in-process guards for the signed deep-link handoff route:
//   1. a fixed-window rate limiter keyed by client IP, and
//   2. a single-use registry keyed by token jti (replay protection).
//
// SCOPE / HONESTY: these live in module memory, so they are PER WARM INSTANCE.
// On Vercel Fluid Compute an instance is reused across requests, so this stops the
// common cases (a script hammering one endpoint; a token replayed seconds later on
// the same instance). It does NOT coordinate across instances, so a token could be
// replayed once per cold instance within its (short) TTL. The real ceiling on abuse
// is the token itself: HMAC signature + <=120s lifetime. When this needs to be
// authoritative across instances, back both maps with Upstash/Redis or a DB
// `handoff_jti` table — see Phase 2 in the integration doc. No PII is stored here.

interface Window {
  count: number;
  resetAt: number; // epoch ms
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_PER_WINDOW = 10; // handoffs per IP per minute

const ipWindows = new Map<string, Window>();
const seenJti = new Map<string, number>(); // jti -> expiry epoch ms

// Bound memory: never let the maps grow without limit under load/abuse.
const MAX_TRACKED_IPS = 10_000;
const MAX_TRACKED_JTI = 50_000;

/** Drop expired entries so the maps don't grow unbounded. Cheap; called opportunistically. */
function sweep(now: number) {
  if (seenJti.size > MAX_TRACKED_JTI) {
    for (const [jti, exp] of seenJti) if (exp <= now) seenJti.delete(jti);
  }
  if (ipWindows.size > MAX_TRACKED_IPS) {
    for (const [ip, w] of ipWindows) if (w.resetAt <= now) ipWindows.delete(ip);
  }
}

/**
 * Fixed-window rate limit by IP. Returns true if the request is ALLOWED.
 * Unknown IPs (no key) are allowed — never fail closed on a missing header.
 */
export function rateLimitOk(ip: string | null): boolean {
  if (!ip) return true;
  const now = Date.now();
  sweep(now);

  const w = ipWindows.get(ip);
  if (!w || w.resetAt <= now) {
    ipWindows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (w.count >= MAX_PER_WINDOW) return false;
  w.count += 1;
  return true;
}

/**
 * Register a token's jti as used. Returns true if this is the FIRST time we've seen
 * it (i.e. accept), false if it's a replay we've already processed. Tokens without a
 * jti are always accepted (the short TTL is their only replay bound). `expSec` is the
 * token's exp claim (epoch seconds) so we can forget the jti once it can't be reused.
 */
export function consumeJti(jti: string | undefined, expSec: number): boolean {
  if (!jti) return true;
  const now = Date.now();
  sweep(now);

  if (seenJti.has(jti)) return false;
  // Keep until just past the token's own expiry; after that it can't be replayed anyway.
  seenJti.set(jti, expSec * 1000 + WINDOW_MS);
  return true;
}
