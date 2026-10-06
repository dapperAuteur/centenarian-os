// app/api/cron/integration-outbox/route.ts
// GET: the daily outgoing-events job (vercel.json cron, "30 6 * * *").
//   1. Nightly re-send of envelope.balance (RideWitUS PRD §6.5 "and nightly"):
//      for every user with a savings goal linked to a trip or equipment item,
//      queue the current state (plus retirements). Skipped when the receiver's
//      URL or secret is unset.
//   2. Drain every due pending row in integration_outbox (retries included).
//
// Guard: Authorization: Bearer {CRON_SECRET}, the header Vercel Cron sends when
// CRON_SECRET is set, same check as the other crons. Middleware does not cover
// /api/*, so this is the only gate.
//
// -> 200 { envelopes: { users, queued, skipped }, delivery: [...], skipped_for_time }
//    401 bad or missing secret

import { NextRequest, NextResponse } from 'next/server';
import { ENVELOPE_RECEIVER, enqueueEnvelopeBalances, usersWithLinkedGoals } from '@/lib/integrations/ridewitus/envelope';
import { drainNow, getServiceDb, noteNotConfigured, receiverConfigured } from '@/lib/integrations/ridewitus/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/** Stop starting new users after this, leaving time for the drain. */
const BUDGET_MS = 35_000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const started = Date.now();
  const db = getServiceDb();
  const envelopes = { users: 0, queued: 0, skipped: 0 };
  let skippedForTime = 0;

  if (receiverConfigured(ENVELOPE_RECEIVER)) {
    const { userIds, error } = await usersWithLinkedGoals(db);
    if (!error) {
      for (const userId of userIds) {
        if (Date.now() - started > BUDGET_MS) {
          skippedForTime += 1;
          continue;
        }
        const result = await enqueueEnvelopeBalances(db, userId, { goalIds: 'all', origin: request.nextUrl.origin });
        envelopes.users += 1;
        envelopes.queued += result.queued;
        if (result.skipped) envelopes.skipped += 1;
        if (result.skipped === 'missing_table') break;
      }
    }
  } else {
    noteNotConfigured(ENVELOPE_RECEIVER);
  }

  const delivery = (await drainNow()).receivers;
  return NextResponse.json({ envelopes, delivery, skipped_for_time: skippedForTime });
}
