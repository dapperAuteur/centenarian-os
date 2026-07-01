// lib/auth/handoff-token.ts
// Verifier for the Learn.WitUS -> CentOS signed deep-link handoff token (Option B
// in docs/integrations/centos-read-your-body-data.md). The partner app (Learn.WitUS)
// mints a short-lived HS256 JWT with a SHARED SECRET; we verify it here before we
// trust any identity claim or touch the database.
//
// We hand-roll HMAC verification with node:crypto rather than add `jose` — the repo
// deliberately avoids a JWT dependency (see app/api/auth/witus/callback comments and
// the node:crypto use in app/api/auth/witus/authorize). HS256 is the simplest JWS
// primitive and the classic JWT footguns are all closed below:
//   - algorithm-confusion / "alg: none": we REQUIRE header.alg === 'HS256' and never
//     read the algorithm from the token to choose how to verify.
//   - signature forgery: constant-time HMAC compare over the raw 32-byte digest.
//   - long-lived / stale tokens: exp is required, AND we cap (exp - iat) at maxTtlSec.
//   - audience/issuer confusion: iss and aud are checked against expected values.
//
// SECURITY: this module verifies BEFORE trust. It performs no I/O and logs nothing,
// so it can't leak PII; callers get back only a short machine reason on failure.

import crypto from 'node:crypto';

export interface HandoffClaims {
  /** Learner email — the identity key both apps share. Normalized lower-case. */
  email: string;
  /** Stable Learn.WitUS user id. Carried for audit/linking; NOT trusted for identity. */
  sub?: string;
  /** Unique token id — lets the caller enforce single-use (replay protection). */
  jti?: string;
  iss?: string;
  aud?: string | string[];
  iat: number;
  exp: number;
  nbf?: number;
}

export interface VerifyOptions {
  /** Shared secret (from env). Never hard-code; callers must pass it. */
  secret: string;
  /** Required issuer, e.g. 'learn.witus.online'. */
  expectedIss?: string;
  /** Required audience, e.g. 'centenarian-os'. */
  expectedAud?: string;
  /** Hard ceiling on token lifetime (exp - iat), in seconds. Default 120. */
  maxTtlSec?: number;
  /** Allowed clock skew, in seconds. Default 30. */
  clockSkewSec?: number;
}

export type VerifyResult =
  | { ok: true; claims: HandoffClaims }
  | { ok: false; reason: HandoffFailureReason };

// Short, non-sensitive codes — safe to log and to surface as ?error=.
export type HandoffFailureReason =
  | 'no_secret'
  | 'malformed'
  | 'bad_alg'
  | 'bad_signature'
  | 'bad_payload'
  | 'expired'
  | 'not_yet_valid'
  | 'ttl_too_long'
  | 'bad_issuer'
  | 'bad_audience'
  | 'no_email'
  | 'bad_email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(reason: HandoffFailureReason): VerifyResult {
  return { ok: false, reason };
}

/**
 * Verify a compact HS256 JWS handoff token. Pure + synchronous: no DB, no logging.
 * Returns the validated claims on success, or a short reason code on failure.
 */
export function verifyHandoffToken(token: string, opts: VerifyOptions): VerifyResult {
  const { secret, expectedIss, expectedAud } = opts;
  const maxTtlSec = opts.maxTtlSec ?? 120;
  const skew = opts.clockSkewSec ?? 30;

  if (!secret) return fail('no_secret');
  if (typeof token !== 'string' || token.length === 0) return fail('malformed');

  // Compact JWS = header.payload.signature
  const parts = token.split('.');
  if (parts.length !== 3) return fail('malformed');
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return fail('malformed');

  // 1. Header — pin the algorithm. Reject 'none', RS256, etc. before doing anything.
  let header: { alg?: unknown; typ?: unknown };
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  } catch {
    return fail('malformed');
  }
  if (header.alg !== 'HS256') return fail('bad_alg');

  // 2. Signature — constant-time HMAC compare over the raw digest bytes.
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return fail('bad_signature');
  }
  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(expectedSig, providedSig)
  ) {
    return fail('bad_signature');
  }

  // 3. Payload — only parsed AFTER the signature is proven authentic.
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return fail('bad_payload');
  }

  const iat = payload.iat;
  const exp = payload.exp;
  if (typeof iat !== 'number' || typeof exp !== 'number') return fail('bad_payload');

  const now = Math.floor(Date.now() / 1000);

  // 4. Temporal validity. exp required; cap total lifetime; honor nbf if present.
  if (now >= exp + skew) return fail('expired');
  if (iat - skew > now) return fail('not_yet_valid');
  if (exp - iat > maxTtlSec) return fail('ttl_too_long');
  if (typeof payload.nbf === 'number' && now + skew < payload.nbf) {
    return fail('not_yet_valid');
  }

  // 5. Issuer / audience binding.
  if (expectedIss && payload.iss !== expectedIss) return fail('bad_issuer');
  if (expectedAud) {
    const aud = payload.aud;
    const audOk = Array.isArray(aud) ? aud.includes(expectedAud) : aud === expectedAud;
    if (!audOk) return fail('bad_audience');
  }

  // 6. Identity claim — the whole point of the token.
  if (typeof payload.email !== 'string' || payload.email.trim() === '') {
    return fail('no_email');
  }
  const email = payload.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail('bad_email');

  return {
    ok: true,
    claims: {
      email,
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
      jti: typeof payload.jti === 'string' ? payload.jti : undefined,
      iss: typeof payload.iss === 'string' ? payload.iss : undefined,
      aud: payload.aud as string | string[] | undefined,
      iat,
      exp,
      nbf: typeof payload.nbf === 'number' ? payload.nbf : undefined,
    },
  };
}

/**
 * SHA-256 fingerprint of an email for safe, non-reversible audit logging.
 * Lets us correlate failures to a learner WITHOUT writing PII to app_logs.
 */
export function emailFingerprint(email: string): string {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
}
