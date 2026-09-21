// lib/teller-webhook.ts
// Pure Teller webhook signature verification. No I/O, no env reads, so it can be
// unit-tested (tests/unit/teller-webhook.test.ts).
//
// Teller's rules (https://teller.io/docs/api/webhooks, signature verification):
//   - Header: `Teller-Signature: t=signature_timestamp,v1=signature_1,v1=signature_2,...`
//   - signed_message = signature_timestamp + "." + the raw JSON request body
//   - HMAC-SHA256 keyed with a non-expired signing secret; the result must match a v1 value
//   - "reject webhook events with a signature_timestamp (Unix time) older than 3 minutes"
//   - During secret rotation Teller signs with both secrets, sending one v1 per
//     secret, so accept the request if ANY v1 matches.
// Teller's page does not state the digest encoding. Hex is used, as before this
// file existed; confirm with a webhook.test event from the Teller dashboard.

import { createHmac, timingSafeEqual } from 'crypto';

/** Teller's documented replay window. */
export const TELLER_SIGNATURE_MAX_AGE_SECONDS = 3 * 60;

export type TellerSignatureFailure =
  | 'missing_secret'
  | 'missing_header'
  | 'malformed_header'
  | 'stale_timestamp'
  | 'signature_mismatch';

export type TellerSignatureResult =
  | { ok: true }
  | { ok: false; reason: TellerSignatureFailure };

export interface VerifyTellerSignatureInput {
  /** Raw request body, exactly as received. Do not re-serialize parsed JSON. */
  body: string;
  /** Value of the Teller-Signature header, or null when absent. */
  header: string | null;
  /** TELLER_WEBHOOK_SECRET. Missing means reject: verification never fails open. */
  secret: string | undefined;
  /** Current time in ms. Injected for tests. */
  nowMs?: number;
}

export function verifyTellerSignature({
  body,
  header,
  secret,
  nowMs = Date.now(),
}: VerifyTellerSignatureInput): TellerSignatureResult {
  if (!secret) return { ok: false, reason: 'missing_secret' };
  if (!header || !header.trim()) return { ok: false, reason: 'missing_header' };

  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const rawPart of header.split(',')) {
    const part = rawPart.trim();
    if (part.startsWith('t=') && timestamp === null) timestamp = part.slice(2);
    else if (part.startsWith('v1=')) signatures.push(part.slice(3));
  }

  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) {
    return { ok: false, reason: 'malformed_header' };
  }

  // Replay protection. Teller only says "older than 3 minutes"; a timestamp more
  // than 3 minutes in the future is also rejected as a clock-skew guard.
  const ageSeconds = nowMs / 1000 - Number(timestamp);
  if (Math.abs(ageSeconds) > TELLER_SIGNATURE_MAX_AGE_SECONDS) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  const expected = Buffer.from(
    createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex'),
    'utf8',
  );

  const matched = signatures.some((sig) => {
    const candidate = Buffer.from(sig.toLowerCase(), 'utf8');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });

  return matched ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
}
