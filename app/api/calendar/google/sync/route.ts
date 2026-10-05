// app/api/calendar/google/sync/route.ts
// POST: "Sync now" from the settings page. Cookie auth, then the service-role client.
//
// Body (optional JSON): { connection_id?: string }
//   connection_id  sync that one Google account (it must be the user's and active)
//   left out       sync all of the user's ACTIVE Google accounts, one after another
//
// -> 200 { results: SyncSummary[] }   one entry per account, each with
//        { connection_id, account_email, status: ok|partial|needs_reauth|error|skipped,
//          counts: { created, updated, archived, flagged, unchanged },
//          calendars_synced, calendars_total, errors[], started_at, finished_at }
//    401 not signed in · 400 invalid_request · 404 not_connected · 503 migration_missing
//
// The work runs within this request (budget below); a run that runs out of time stops between
// events, keeps everything it wrote, and the next sync carries on.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncConnection, type SyncSummary } from '@/lib/calendar/google-sync';
import { getConnection, listConnections } from '@/lib/google/connection';
import { calendarErrorResponse, getServiceDb, isUuid } from '@/lib/google/route-helpers';

export const maxDuration = 300;
/** Leave headroom under maxDuration for the response and the final writes. */
const BUDGET_MS = 270_000;

export async function POST(request: NextRequest) {
  const deadline = Date.now() + BUDGET_MS;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let connectionId: unknown = null;
  try {
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text) as { connection_id?: unknown } | null;
      connectionId = body?.connection_id ?? null;
    }
  } catch {
    return NextResponse.json({ error: 'Send a JSON object or no body.', code: 'invalid_request' }, { status: 400 });
  }
  if (connectionId !== null && !isUuid(connectionId)) {
    return NextResponse.json({ error: 'connection_id must be a connection id.', code: 'invalid_request' }, { status: 400 });
  }

  try {
    const db = getServiceDb();
    let ids: string[];
    if (connectionId) {
      const conn = await getConnection(db, user.id, connectionId);
      if (!conn) {
        return NextResponse.json({ error: 'That Google account is not connected.', code: 'not_connected' }, { status: 404 });
      }
      ids = [conn.id];
    } else {
      const all = await listConnections(db, user.id);
      if (all.length === 0) {
        return NextResponse.json({ error: 'Google Calendar is not connected.', code: 'not_connected' }, { status: 404 });
      }
      ids = all.filter((conn) => conn.status === 'active').map((conn) => conn.id);
    }

    const results: SyncSummary[] = [];
    for (const id of ids) {
      if (Date.now() >= deadline) break;
      results.push(await syncConnection(db, id, { deadline }));
    }
    return NextResponse.json({ results });
  } catch (err) {
    return calendarErrorResponse(err, 'sync POST');
  }
}
