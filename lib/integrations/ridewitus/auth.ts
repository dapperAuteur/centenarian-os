// lib/integrations/ridewitus/auth.ts
// Checks a server-to-server request from RideWitUS (RideWitUS PRD §6.2, §6.9,
// §6.10): a valid X-Witus-* signature with the endpoint's own secret, inside
// the 300-second window, from source `ride-witus`.
//
// Each endpoint has its own secret so one can be rotated or revoked alone:
//   RIDE_VENDOR_API_SECRET  GET /api/v1/ride/vendors...   (PRD §6.9)
//   RIDE_RESYNC_SECRET      POST /api/v1/ride/resync      (PRD §6.10)
//
// POST requests sign the raw body; GET requests sign their path and query
// (lib/events/sign-request.ts, "SIGNED GET REQUESTS").
//
// No '@/' imports, so node --test loads it.

import { verifyWitusSignature } from '../../events/verify-signature.ts';
import type { VerifyFailure } from '../../events/verify-signature.ts';

/** RideWitUS's slug in gemini/witus/lib/products.ts (checked 2026-10-05). */
export const RIDEWITUS_SOURCE = 'ride-witus';

export type RideAuthFailure = VerifyFailure | 'wrong_source';

export type RideAuthResult = { ok: true } | { ok: false; reason: RideAuthFailure; status: 401 | 503 };

export interface HeaderReader {
  get(name: string): string | null;
}

export function verifyRideRequest(args: {
  /** The raw body for a POST; signedGetBody(url) for a GET. */
  signedBody: string;
  headers: HeaderReader;
  secret: string | undefined;
  nowSeconds?: number;
}): RideAuthResult {
  const verdict = verifyWitusSignature({
    rawBody: args.signedBody,
    signatureHeader: args.headers.get('x-witus-signature'),
    timestampHeader: args.headers.get('x-witus-timestamp'),
    sourceHeader: args.headers.get('x-witus-source'),
    secret: args.secret,
    nowSeconds: args.nowSeconds,
  });
  if (!verdict.ok) {
    // 503 for "nobody set the env var", 401 for everything else. The route
    // answers the same flat message for every 401, so it is not an oracle.
    return { ok: false, reason: verdict.reason, status: verdict.reason === 'no_secret' ? 503 : 401 };
  }
  if (verdict.source !== RIDEWITUS_SOURCE) return { ok: false, reason: 'wrong_source', status: 401 };
  return { ok: true };
}

/** The ecosystem response envelope (PRD §6.9). */
export type Envelope<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

export function okEnvelope<T>(data: T): Envelope<T> {
  return { ok: true, data };
}

export function errorEnvelope(code: string, error: string): Envelope<never> {
  return { ok: false, error, code };
}
