// app/api/events/vendor-bills/route.ts
// POST: receive the ecosystem cost snapshot from witus.online (/admin/costs, daily cron or the
// Refresh button) and upsert it into vendor_bills. Same wire contract and shape as events/income:
// X-Witus-* HMAC headers verified against VENDOR_BILLS_EVENTS_SECRET, single event or a batch,
// upsert on (user_id, event_id). The owner is VENDOR_BILLS_OWNER_USER_ID: witus.online does not
// know CentOS user ids, and this projection has exactly one reader.
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { verifyWitusSignature } from '@/lib/events/verify-signature';
import { logWarn } from '@/lib/logging';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface VendorBillPayload {
  event_id?: unknown;
  service_slug?: unknown;
  service_name?: unknown;
  vendor?: unknown;
  plan?: unknown;
  billed_via?: unknown;
  period_start?: unknown;
  period_end?: unknown;
  base_fee?: unknown;
  usage_cost?: unknown;
  currency?: unknown;
  account_url?: unknown;
  witus_url?: unknown;
  detail?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const verdict = verifyWitusSignature({
    rawBody,
    signatureHeader: request.headers.get('x-witus-signature'),
    timestampHeader: request.headers.get('x-witus-timestamp'),
    sourceHeader: request.headers.get('x-witus-source'),
    secret: process.env.VENDOR_BILLS_EVENTS_SECRET,
  });
  if (!verdict.ok) {
    logWarn({ source: 'api', module: 'events/vendor-bills', message: `vendor bill event rejected: ${verdict.reason}`, metadata: { reason: verdict.reason } });
    return NextResponse.json({ error: 'Unauthorized' }, { status: verdict.reason === 'no_secret' ? 503 : 401 });
  }
  const owner = str(process.env.VENDOR_BILLS_OWNER_USER_ID);
  if (!owner) return NextResponse.json({ error: 'VENDOR_BILLS_OWNER_USER_ID is not set' }, { status: 503 });

  let body: { events?: VendorBillPayload[] } | VendorBillPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const incoming: VendorBillPayload[] = Array.isArray((body as { events?: unknown }).events)
    ? (body as { events: VendorBillPayload[] }).events
    : [body as VendorBillPayload];
  if (incoming.length === 0) return NextResponse.json({ error: 'No events provided' }, { status: 400 });
  if (incoming.length > 500) return NextResponse.json({ error: 'Maximum 500 events per request' }, { status: 400 });

  const rows: Record<string, unknown>[] = [];
  const rejected: string[] = [];
  incoming.forEach((e, i) => {
    const eventId = str(e.event_id);
    const slug = str(e.service_slug);
    const name = str(e.service_name);
    const vendor = str(e.vendor);
    const ps = str(e.period_start);
    const pe = str(e.period_end);
    if (!eventId) return void rejected.push(`Event ${i + 1}: missing event_id`);
    if (!slug || !name || !vendor) return void rejected.push(`Event ${i + 1}: service_slug, service_name and vendor are required`);
    if (!ps || !DATE_RE.test(ps) || !pe || !DATE_RE.test(pe)) return void rejected.push(`Event ${i + 1}: period_start/period_end must be YYYY-MM-DD`);
    const usage = Number(e.usage_cost ?? 0);
    if (!Number.isFinite(usage)) return void rejected.push(`Event ${i + 1}: usage_cost is not a number`);
    const base = e.base_fee == null ? null : Number(e.base_fee);
    if (base !== null && !Number.isFinite(base)) return void rejected.push(`Event ${i + 1}: base_fee is not a number`);
    rows.push({
      event_id: eventId,
      user_id: owner,
      source_app: verdict.source,
      service_slug: slug,
      service_name: name,
      vendor,
      plan: str(e.plan),
      billed_via: str(e.billed_via),
      period_start: ps,
      period_end: pe,
      base_fee: base,
      usage_cost: usage,
      currency: str(e.currency) ?? 'USD',
      account_url: str(e.account_url),
      witus_url: str(e.witus_url),
      detail: e.detail && typeof e.detail === 'object' ? e.detail : null,
      updated_at: new Date().toISOString(),
    });
  });
  if (rejected.length && rows.length === 0) return NextResponse.json({ error: 'All events rejected', rejected }, { status: 400 });

  const { error } = await serviceClient().from('vendor_bills').upsert(rows, { onConflict: 'user_id,event_id' });
  if (error) {
    logWarn({ source: 'api', module: 'events/vendor-bills', message: 'vendor bill upsert failed', metadata: { error: error.message } });
    return NextResponse.json({ error: 'Upsert failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, upserted: rows.length, rejected });
}
