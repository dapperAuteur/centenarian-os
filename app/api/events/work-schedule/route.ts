// app/api/events/work-schedule/route.ts
// POST: receive a contractor job-schedule event from Work.WitUS into the local
// work_schedule_events projection.
//
// Stage 2, Phase 2b (plans/55-stage2-db-split.md). Sibling of /api/events/income: that one carries
// money, this one carries occupancy. Together they are the last things CentOS needed from
// Work.WitUS's tables, so once both are live no CentOS route reads a contractor table.

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SOURCES = new Set(['own', 'assigned']);

interface SchedulePayload {
  event_id?: unknown;
  user_id?: unknown;
  source?: unknown;
  assigner_name?: unknown;
  job_id?: unknown;
  job_number?: unknown;
  client_name?: unknown;
  event_name?: unknown;
  location_name?: unknown;
  status?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  is_multi_day?: unknown;
  scheduled_dates?: unknown;
  pay_rate?: unknown;
  rate_type?: unknown;
  brand_id?: unknown;
  notes?: unknown;
  is_active?: unknown;
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
const dateOrNull = (v: unknown): string | null => {
  const s = str(v);
  return s && DATE_RE.test(s) ? s : null;
};

export async function POST(request: NextRequest) {
  // Raw bytes first: the signature covers exactly what was sent.
  const rawBody = await request.text();

  const verdict = verifyWitusSignature({
    rawBody,
    signatureHeader: request.headers.get('x-witus-signature'),
    timestampHeader: request.headers.get('x-witus-timestamp'),
    sourceHeader: request.headers.get('x-witus-source'),
    // Same secret as the income channel: one trust relationship between these two apps, not two
    // to rotate. Split them only if one channel ever needs revoking independently.
    secret: process.env.INCOME_EVENTS_SECRET,
  });

  if (!verdict.ok) {
    logWarn({
      source: 'api',
      module: 'events/work-schedule',
      message: `schedule event rejected: ${verdict.reason}`,
      metadata: { reason: verdict.reason },
    });
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: verdict.reason === 'no_secret' ? 503 : 401 },
    );
  }

  let body: { events?: SchedulePayload[] } | SchedulePayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const incoming: SchedulePayload[] = Array.isArray((body as { events?: unknown }).events)
    ? (body as { events: SchedulePayload[] }).events
    : [body as SchedulePayload];

  if (incoming.length === 0) return NextResponse.json({ error: 'No events provided' }, { status: 400 });
  if (incoming.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 events per request' }, { status: 400 });
  }

  const rows: Record<string, unknown>[] = [];
  const rejected: string[] = [];

  incoming.forEach((e, i) => {
    const eventId = str(e.event_id);
    const userId = str(e.user_id);
    const start = dateOrNull(e.start_date);
    const end = dateOrNull(e.end_date);

    if (!eventId) return void rejected.push(`Event ${i + 1}: missing event_id`);
    if (!userId) return void rejected.push(`Event ${i + 1}: missing user_id`);
    // A schedule row with no date cannot answer "am I busy on X", which is the only question
    // this projection exists to answer.
    if (!start && !end) {
      return void rejected.push(`Event ${i + 1}: needs at least one of start_date/end_date (YYYY-MM-DD)`);
    }

    const source = str(e.source) ?? 'own';
    if (!VALID_SOURCES.has(source)) {
      return void rejected.push(`Event ${i + 1}: source must be 'own' or 'assigned'`);
    }

    const rate = e.pay_rate == null ? null : Number(e.pay_rate);
    if (rate != null && !Number.isFinite(rate)) {
      return void rejected.push(`Event ${i + 1}: pay_rate is not a number`);
    }

    rows.push({
      event_id: eventId,
      user_id: userId,
      source_app: verdict.source,
      source,
      assigner_name: str(e.assigner_name),
      job_id: str(e.job_id),
      job_number: str(e.job_number),
      client_name: str(e.client_name),
      event_name: str(e.event_name),
      location_name: str(e.location_name),
      status: str(e.status),
      start_date: start,
      end_date: end,
      is_multi_day: e.is_multi_day === true,
      // Passed through as-is: both consumers hand it to the UI without interpreting it.
      scheduled_dates: e.scheduled_dates ?? null,
      pay_rate: rate,
      rate_type: str(e.rate_type),
      brand_id: str(e.brand_id),
      notes: str(e.notes),
      is_active: e.is_active === false ? false : true,
      updated_at: new Date().toISOString(),
    });
  });

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'No valid events', details: rejected.slice(0, 10) },
      { status: 400 },
    );
  }

  const { data, error } = await getDb()
    .from('work_schedule_events')
    .upsert(rows, { onConflict: 'user_id,event_id' })
    .select('id');

  if (error) {
    logWarn({
      source: 'api',
      module: 'events/work-schedule',
      message: 'schedule event upsert failed',
      metadata: { error: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    accepted: data?.length ?? 0,
    rejected: rejected.length,
    details: rejected.length > 0 ? rejected.slice(0, 10) : undefined,
  });
}
