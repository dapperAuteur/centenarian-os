// app/api/v1/ride/resync/route.ts
// POST: RideWitUS's "Sync now" (RideWitUS PRD §6.10, option D). Re-sends this
// user's current CentenarianOS facts to RideWitUS through the normal outgoing
// path (integration_outbox -> the RideWitUS receivers), then answers with what
// was queued and sent.
//
// Server to server. Signed with X-Witus-* headers by source `ride-witus` and
// the secret RIDE_RESYNC_SECRET over the raw body.
//
// Body: { witus_sub, scopes?: ('calendar' | 'matches' | 'envelopes')[], since? }
//   No scopes = all. `since` is passed to scopes that can narrow by it
//   (envelopes are current state and ignore it).
//
// 202 { ok: true, data: { request_id, scopes: { <scope>: { status, queued, detail?, note? } },
//       delivery: [{ receiver, sent, retrying, failed, skipped, note }] } }
//     status: queued | nothing_to_send | error
//       | skipped (note: not_configured when the receiver's URL/secret is unset,
//         no_identity, savings_not_migrated, missing_table)
//       | not_available (calendar until the calendar feed branch registers its handler;
//         matches until cost.matched exists)
// 400 invalid_body / invalid_subject / invalid_scope / invalid_since · 401 unauthorized
// 404 unknown_subject · 429 rate_limited (one per user per 5 minutes; Retry-After header)
// 503 not_configured (RIDE_RESYNC_SECRET unset)

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { errorEnvelope, okEnvelope } from '@/lib/integrations/ridewitus/auth';
import { parseResyncBody, ResyncRateLimiter, runResync } from '@/lib/integrations/ridewitus/resync';
import { authorizeRideRequest, drainNow, getServiceDb, receiverConfigured } from '@/lib/integrations/ridewitus/server';
import { logInfo } from '@/lib/logging';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const limiter = new ResyncRateLimiter();

export async function POST(request: NextRequest) {
  // Read the body as text BEFORE parsing: the signature covers the exact bytes sent.
  const rawBody = await request.text();
  let parsedJson: unknown = null;
  try {
    parsedJson = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsedJson = null;
  }

  const auth = await authorizeRideRequest({
    request,
    module: 'v1/ride/resync',
    secret: process.env.RIDE_RESYNC_SECRET,
    signedBody: rawBody,
    witusSub: (parsedJson as { witus_sub?: unknown } | null)?.witus_sub,
  });
  if (!auth.ok) return auth.response;

  const parsed = parseResyncBody(parsedJson);
  if (!parsed.ok) return NextResponse.json(errorEnvelope(parsed.code, parsed.error), { status: 400 });

  const allowed = limiter.check(auth.witusSub);
  if (!allowed.ok) {
    return NextResponse.json(errorEnvelope('rate_limited', 'One resync per user every 5 minutes.'), {
      status: 429,
      headers: { 'Retry-After': String(allowed.retryAfterSeconds) },
    });
  }

  const requestId = randomUUID();
  const scopes = await runResync(
    {
      db: getServiceDb(),
      userId: auth.userId,
      witusSub: auth.witusSub,
      since: parsed.value.since,
      origin: request.nextUrl.origin,
      now: new Date(),
      receiverReady: receiverConfigured,
    },
    parsed.value.scopes,
  );

  const queued = Object.values(scopes).reduce((sum, s) => sum + s.queued, 0);
  const delivery = queued ? (await drainNow(auth.userId)).receivers : [];
  logInfo({
    source: 'api',
    module: 'v1/ride/resync',
    message: `resync ${requestId}: ${queued} event(s) queued`,
    metadata: { request_id: requestId, scopes: parsed.value.scopes },
    userId: auth.userId,
  });

  return NextResponse.json(okEnvelope({ request_id: requestId, scopes, delivery }), { status: 202 });
}
