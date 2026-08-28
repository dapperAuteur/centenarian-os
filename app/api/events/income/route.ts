// app/api/events/income/route.ts
// POST: receive a business-income event from Work.WitUS and upsert it into the local
// income_events projection.
//
// Stage 2, Phase 2 (plans/55-stage2-db-split.md). This is the replacement for CentOS reading
// the cross-app `expected_payments` view: Work.WitUS pushes, CentOS reads locally. Chosen over
// a synchronous API call because CentOS is offline-first — the planner must render from local
// data when the sibling app is unreachable.
//
// Auth is by HMAC on the SENDER, not by user session: there is no browser here. The user is
// identified by `user_id` in the signed payload, which is why the signature covers the body.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { verifyWitusSignature } from '@/lib/events/verify-signature';
import { logWarn } from '@/lib/logging';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_SOURCE_TYPES = new Set(['job', 'invoice', 'expected_payment', 'schedule']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** One income event. Mirrors the expected_payments view's shape — see migration 196. */
interface IncomeEventPayload {
  event_id?: unknown;
  user_id?: unknown;
  source_type?: unknown;
  source_id?: unknown;
  expected_date?: unknown;
  label?: unknown;
  reference_number?: unknown;
  expected_amount?: unknown;
  status?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  brand_id?: unknown;
  is_active?: unknown;
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

export async function POST(request: NextRequest) {
  // Read the body as text BEFORE parsing: the signature covers the exact bytes sent, and
  // JSON.stringify(JSON.parse(x)) is not guaranteed to reproduce them.
  const rawBody = await request.text();

  const verdict = verifyWitusSignature({
    rawBody,
    signatureHeader: request.headers.get('x-witus-signature'),
    timestampHeader: request.headers.get('x-witus-timestamp'),
    sourceHeader: request.headers.get('x-witus-source'),
    secret: process.env.INCOME_EVENTS_SECRET,
  });

  if (!verdict.ok) {
    // Log the precise reason server-side; return a flat 401 so the response is not an oracle
    // that tells a forger which part of their attempt was wrong.
    logWarn({
      source: 'api',
      module: 'events/income',
      message: `income event rejected: ${verdict.reason}`,
      metadata: { reason: verdict.reason },
    });
    const status = verdict.reason === 'no_secret' ? 503 : 401;
    return NextResponse.json({ error: 'Unauthorized' }, { status });
  }

  let body: { events?: IncomeEventPayload[] } | IncomeEventPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Accept either a single event or a batch, so the emitter can catch up after downtime
  // without issuing hundreds of requests.
  const incoming: IncomeEventPayload[] = Array.isArray((body as { events?: unknown }).events)
    ? (body as { events: IncomeEventPayload[] }).events
    : [body as IncomeEventPayload];

  if (incoming.length === 0) {
    return NextResponse.json({ error: 'No events provided' }, { status: 400 });
  }
  if (incoming.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 events per request' }, { status: 400 });
  }

  const rows: Record<string, unknown>[] = [];
  const rejected: string[] = [];

  incoming.forEach((e, i) => {
    const eventId = str(e.event_id);
    const userId = str(e.user_id);
    const sourceType = str(e.source_type);
    const expectedDate = str(e.expected_date);

    // Every rejection names the row and the field. A silent skip counter is exactly the
    // failure mode that made the media CSV export useless for months.
    if (!eventId) return void rejected.push(`Event ${i + 1}: missing event_id`);
    if (!userId) return void rejected.push(`Event ${i + 1}: missing user_id`);
    if (!sourceType || !VALID_SOURCE_TYPES.has(sourceType)) {
      return void rejected.push(`Event ${i + 1}: invalid source_type`);
    }
    if (!expectedDate || !DATE_RE.test(expectedDate)) {
      return void rejected.push(`Event ${i + 1}: expected_date must be YYYY-MM-DD`);
    }

    const amount = Number(e.expected_amount ?? 0);
    if (!Number.isFinite(amount)) {
      return void rejected.push(`Event ${i + 1}: expected_amount is not a number`);
    }

    const startDate = str(e.start_date);
    const endDate = str(e.end_date);

    rows.push({
      event_id: eventId,
      user_id: userId,
      source_app: verdict.source,
      source_type: sourceType,
      source_id: str(e.source_id),
      expected_date: expectedDate,
      label: str(e.label),
      reference_number: str(e.reference_number),
      expected_amount: amount,
      status: str(e.status),
      start_date: startDate && DATE_RE.test(startDate) ? startDate : null,
      end_date: endDate && DATE_RE.test(endDate) ? endDate : null,
      brand_id: str(e.brand_id),
      // Absent means active. Only an explicit `false` retires a row, so a cancelled invoice
      // stops counting toward the forecast without the row being deleted.
      is_active: e.is_active === false ? false : true,
      updated_at: new Date().toISOString(),
    });
  });

  // If nothing survived validation, that is an error, not a 200 with a skip count.
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'No valid events', details: rejected.slice(0, 10) },
      { status: 400 },
    );
  }

  // At-least-once delivery is expected, so redelivery must be a no-op rather than a
  // duplicate. The unique index on (user_id, event_id) makes this last-write-wins.
  const { data, error } = await getDb()
    .from('income_events')
    .upsert(rows, { onConflict: 'user_id,event_id' })
    .select('id');

  if (error) {
    logWarn({
      source: 'api',
      module: 'events/income',
      message: 'income event upsert failed',
      metadata: { error: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Report both numbers. A caller that sent 40 and sees accepted:38 knows to look.
  return NextResponse.json({
    ok: true,
    accepted: data?.length ?? 0,
    rejected: rejected.length,
    details: rejected.length > 0 ? rejected.slice(0, 10) : undefined,
  });
}
