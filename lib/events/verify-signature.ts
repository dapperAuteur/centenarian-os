// lib/events/verify-signature.ts
// Receiver half of the WitUS signed-webhook contract. The sender half lives in
// lib/inbox-sender.ts here, and in lib/witus-sender.ts in ride-wit-us; all three speak the
// same wire format:
//
//   X-Witus-Source:    <source-slug>
//   X-Witus-Timestamp: <unix seconds>
//   X-Witus-Signature: sha256=<hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))>
//
// The signature covers the timestamp AND the raw body, so a captured request cannot be
// replayed later with a fresh timestamp, and the body cannot be edited in flight.

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Replay window. Matches witus-inbox so every receiver in the ecosystem behaves the same. */
export const MAX_SKEW_SECONDS = 300;

export type VerifyFailure =
  | 'no_secret'
  | 'missing_headers'
  | 'bad_timestamp'
  | 'stale_timestamp'
  | 'bad_signature_format'
  | 'signature_mismatch';

export type VerifyResult =
  | { ok: true; source: string }
  | { ok: false; reason: VerifyFailure };

export interface VerifyArgs {
  /** Raw request body EXACTLY as received. Re-serializing parsed JSON will not match. */
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  sourceHeader: string | null;
  secret: string | undefined;
  /** Defaults to now; injectable so tests can pin the clock. */
  nowSeconds?: number;
}

export function verifyWitusSignature(args: VerifyArgs): VerifyResult {
  const { rawBody, signatureHeader, timestampHeader, sourceHeader, secret } = args;

  // A missing secret is a misconfiguration, not an attack. Distinguish it so ops can tell
  // "nobody set the env var" from "someone is forging requests" in the logs.
  if (!secret) return { ok: false, reason: 'no_secret' };
  if (!signatureHeader || !timestampHeader || !sourceHeader) {
    return { ok: false, reason: 'missing_headers' };
  }

  const ts = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad_timestamp' };

  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  // Absolute skew: reject far-future timestamps too, not just old ones. A clock-skewed or
  // hand-crafted future timestamp would otherwise buy an attacker an unbounded replay window.
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) return { ok: false, reason: 'stale_timestamp' };

  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return { ok: false, reason: 'bad_signature_format' };
  const provided = signatureHeader.slice(prefix.length);

  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');

  // timingSafeEqual throws on length mismatch, so length is checked first. Comparing the
  // hex strings (not the raw digests) is fine: both are fixed-length for a valid signature.
  if (provided.length !== expected.length) return { ok: false, reason: 'signature_mismatch' };
  if (!timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'))) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  return { ok: true, source: sourceHeader };
}
