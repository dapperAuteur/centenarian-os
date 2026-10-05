// app/api/cron/calendar-sync/route.ts
// GET: the daily Google Calendar sync (vercel.json cron, "0 6 * * *").
//
// Guard: Authorization: Bearer {CRON_SECRET}, the header Vercel Cron sends when CRON_SECRET is
// set (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs), same check as
// app/api/admin/demo/reset/route.ts. Middleware does not cover /api/*, so this is the only gate.
//
// Service role (no user session). Syncs every ACTIVE Google connection, the one synced longest
// ago first (never-synced first), and stops starting new work before the time budget runs out,
// so the next run picks up where this one left off.
//
// -> 200 { ran, skipped_for_time, results: [{ connection_id, status, counts, errors }] }
//    (no emails, no tokens) · 401 bad or missing secret

import { NextRequest, NextResponse } from 'next/server';
import { syncConnection } from '@/lib/calendar/google-sync';
import { CALENDAR_PROVIDER } from '@/lib/google/connection';
import { getServiceDb } from '@/lib/google/route-helpers';

export const maxDuration = 300;
/** Stop starting new work after this; leaves room for the last writes and the response. */
const BUDGET_MS = 270_000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const deadline = Date.now() + BUDGET_MS;
  const db = getServiceDb();

  const { data, error } = await db
    .from('calendar_connections')
    .select('id')
    .eq('provider', CALENDAR_PROVIDER)
    .eq('status', 'active')
    .order('last_synced_at', { ascending: true, nullsFirst: true });
  if (error) {
    console.error('[api/cron/calendar-sync] listing connections failed:', error.message);
    return NextResponse.json({ error: 'Could not list calendar connections.' }, { status: 500 });
  }

  const ids = ((data as { id: string }[] | null) ?? []).map((row) => row.id);
  const results: { connection_id: string; status: string; counts?: unknown; errors: string[] }[] = [];
  let index = 0;
  for (; index < ids.length; index += 1) {
    // Leave at least 20 s for a connection; otherwise stop and let tomorrow's run continue.
    if (deadline - Date.now() < 20_000) break;
    try {
      const summary = await syncConnection(db, ids[index], { deadline });
      results.push({
        connection_id: summary.connection_id,
        status: summary.status,
        counts: summary.counts,
        errors: summary.errors,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[api/cron/calendar-sync]', ids[index], message);
      results.push({ connection_id: ids[index], status: 'error', errors: [message] });
    }
  }

  return NextResponse.json({ ran: results.length, skipped_for_time: ids.length - index, results });
}
