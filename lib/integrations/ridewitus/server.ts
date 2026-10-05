// lib/integrations/ridewitus/server.ts
// Server-only glue between the routes and the pure RideWitUS integration code:
// the service-role client, env, and logging. The logic and its tests live in
// the sibling files (auth, vendors, envelope, resync) and lib/integrations/outbox.ts.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { userIdForWitusSub } from '@/lib/witus/identity';
import { errorEnvelope, verifyRideRequest } from '@/lib/integrations/ridewitus/auth';
import { logInfo, logWarn } from '@/lib/logging';
import { drain, RECEIVERS } from '@/lib/integrations/outbox';
import type { DrainResult } from '@/lib/integrations/outbox';
import { ENVELOPE_RECEIVER, enqueueEnvelopeBalances } from '@/lib/integrations/ridewitus/envelope';

export { getServiceDb };

/** True when a receiver's URL and secret are both set. */
export function receiverConfigured(receiver: string): boolean {
  const spec = RECEIVERS[receiver];
  return !!spec && !!process.env[spec.urlEnv] && !!process.env[spec.secretEnv];
}

export { noteNotConfigured };

/** Send this user's due rows now (or every user's when userId is omitted), logging the outcome. */
export async function drainNow(userId?: string, receivers?: string[]): Promise<DrainResult> {
  const result = await drain(getServiceDb(), {
    env: process.env,
    userId,
    receivers,
    quickRetries: userId ? 2 : 0,
  });
  if (result.error) {
    logWarn({
      source: 'integration',
      module: 'outbox',
      message: result.missingTable ? 'integration_outbox missing (run migration 217)' : `outbox drain failed: ${result.error}`,
      userId,
    });
  }
  for (const r of result.receivers) {
    if (r.note === 'not_configured') {
      logInfo({
        source: 'integration',
        module: 'outbox',
        message: `${r.receiver}: URL or secret not set, ${r.skipped} event(s) left pending`,
        userId,
      });
    } else if (r.failed || r.retrying) {
      logWarn({
        source: 'integration',
        module: 'outbox',
        message: `${r.receiver}: sent ${r.sent}, retrying ${r.retrying}, failed ${r.failed}`,
        userId,
      });
    }
  }
  return result;
}

let warnedNotConfigured = false;

/** Logs "not configured" once per warm instance, not on every write. */
function noteNotConfigured(receiver: string): void {
  if (warnedNotConfigured) return;
  warnedNotConfigured = true;
  logInfo({
    source: 'integration',
    module: 'outbox',
    message: `${receiver}: URL or secret not set, so nothing is sent to RideWitUS (no-op)`,
  });
}

/**
 * After a savings goal or allocation write: queue envelope.balance for the
 * goals it touched and try to send at once. Call from next/server after(), so
 * the user's response never waits on RideWitUS. Never throws.
 */
export async function emitEnvelopeChanges(userId: string, goalIds: string[], origin: string): Promise<void> {
  // Missing env: a no-op, logged. Nothing is queued, so turning the receiver
  // on later starts from a resync or the nightly re-send, not a backlog.
  if (!receiverConfigured(ENVELOPE_RECEIVER)) return noteNotConfigured(ENVELOPE_RECEIVER);
  try {
    const result = await enqueueEnvelopeBalances(getServiceDb(), userId, { goalIds, origin });
    if (result.skipped === 'missing_table') {
      logWarn({ source: 'integration', module: 'envelope', message: 'integration_outbox missing (run migration 217)', userId });
      return;
    }
    if (result.skipped === 'lookup_failed') {
      logWarn({ source: 'integration', module: 'envelope', message: `envelope emit failed: ${result.error ?? 'lookup failed'}`, userId });
      return;
    }
    if (!result.queued) return;
    await drainNow(userId, [ENVELOPE_RECEIVER]);
  } catch (err) {
    logWarn({
      source: 'integration',
      module: 'envelope',
      message: `envelope emit threw: ${err instanceof Error ? err.message : 'unknown error'}`,
      userId,
    });
  }
}

// ── Route helpers ───────────────────────────────────────────────────────────

/**
 * Signature check plus identity for a request from RideWitUS. Returns the
 * CentenarianOS user id, or the response to send. Every 401 says the same
 * thing; the precise reason is logged here, never returned.
 */
export async function authorizeRideRequest(args: {
  request: NextRequest;
  module: string;
  secret: string | undefined;
  signedBody: string;
  witusSub: unknown;
}): Promise<{ ok: true; userId: string; witusSub: string } | { ok: false; response: NextResponse }> {
  const auth = verifyRideRequest({ signedBody: args.signedBody, headers: args.request.headers, secret: args.secret });
  if (!auth.ok) {
    logWarn({
      source: 'api',
      module: args.module,
      message: `ridewitus request rejected: ${auth.reason}`,
      metadata: { reason: auth.reason },
    });
    const message = auth.status === 503 ? 'Not configured' : 'Unauthorized';
    const code = auth.status === 503 ? 'not_configured' : 'unauthorized';
    return { ok: false, response: NextResponse.json(errorEnvelope(code, message), { status: auth.status }) };
  }

  const identity = await userIdForWitusSub(getServiceDb(), args.witusSub);
  if (!identity.ok) {
    if (identity.reason === 'lookup_failed') {
      return { ok: false, response: NextResponse.json(errorEnvelope('lookup_failed', 'Could not resolve the user.'), { status: 500 }) };
    }
    if (identity.reason === 'invalid_subject') {
      return { ok: false, response: NextResponse.json(errorEnvelope('invalid_subject', 'witus_sub is required.'), { status: 400 }) };
    }
    // PRD §6.3 / §6.9: unknown subject = 404 unknown_subject. RideWitUS keeps
    // the request queued; it works once the person signs in here with WitUS.
    return {
      ok: false,
      response: NextResponse.json(
        errorEnvelope('unknown_subject', 'No CentenarianOS account is linked to this WitUS account yet.'),
        { status: 404 },
      ),
    };
  }
  return { ok: true, userId: identity.userId, witusSub: args.witusSub as string };
}
