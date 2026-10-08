// app/api/wearables/whoop/sync/route.ts
// POST: sync WHOOP data for the authenticated user.
//
// WHOOP has no card on the Wearables settings page, so nothing in the app
// calls this route today. Its write path matches the Garmin sync: source
// 'whoop', the provider's own day, importDailyMetrics (a value WHOOP sends
// wins, a field it leaves out is never erased, no day is added twice), a
// failed write marks the connection 'error', and each sync reaches back to the
// last sync minus 2 days (30 days at most).
//
// Steps and active calories are added up from the day's workouts and written
// in replace mode, so every day written must be complete: the fetch starts a
// whole day early (wholeDaySyncWindow), every page is read (readAllWhoopPages,
// WHOOP sends at most 25 records a page), and only days the fetch covers
// completely are written (daysFrom). The paging parameters (limit up to 25,
// nextToken in, next_token out, newest first) are from WHOOP's API reference
// at developer.whoop.com/api, checked 2026-10-08; it documents the v2 paths,
// and this route still calls v1. Check both before switching WHOOP on.

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { importDailyMetrics } from '@/lib/fitness-import/daily-metrics';
import {
  WHOOP_PAGE_LIMIT,
  daysFrom,
  readAllWhoopPages,
  syncWindowStart,
  wholeDaySyncWindow,
  whoopDays,
} from '@/lib/fitness-import/wearable-days';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function whoopFetch(token: string, endpoint: string, params?: Record<string, string>) {
  const url = new URL(`https://api.prod.whoop.com/developer/v1/${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Whoop API ${endpoint}: ${res.status}`);
  return res.json();
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: conn } = await db
    .from('wearable_connections')
    .select('access_token, last_synced_at')
    .eq('user_id', user.id)
    .eq('provider', 'whoop')
    .maybeSingle();

  if (!conn?.access_token) {
    return NextResponse.json({ error: 'Whoop not connected' }, { status: 400 });
  }

  await db.from('wearable_connections')
    .update({ sync_status: 'syncing', sync_error: null })
    .eq('user_id', user.id)
    .eq('provider', 'whoop');

  try {
    const now = new Date();
    const { fetchFrom, firstDay } = wholeDaySyncWindow(syncWindowStart(conn.last_synced_at, now));
    const params = { start: fetchFrom.toISOString(), end: now.toISOString(), limit: String(WHOOP_PAGE_LIMIT) };
    const readAll = (endpoint: string) =>
      readAllWhoopPages((nextToken) => whoopFetch(conn.access_token, endpoint, nextToken ? { ...params, nextToken } : params));

    const [recoveryData, sleepData, workoutData] = await Promise.all([
      readAll('recovery'),
      readAll('activity/sleep'),
      readAll('activity/workout'),
    ]);

    const result = await importDailyMetrics(db, {
      userId: user.id,
      source: 'whoop',
      rows: daysFrom(whoopDays(recoveryData, sleepData, workoutData), firstDay),
      mode: 'replace',
    });

    const { error: statusError } = await db.from('wearable_connections')
      .update({ sync_status: 'idle', sync_error: null, last_synced_at: now.toISOString() })
      .eq('user_id', user.id)
      .eq('provider', 'whoop');
    if (statusError) throw new Error(`Could not record the sync: ${statusError.message}`);

    const { counts } = result;
    return NextResponse.json({ synced: counts.inserted + counts.filled + counts.replaced, ...counts });
  } catch (err) {
    await db.from('wearable_connections')
      .update({ sync_status: 'error', sync_error: err instanceof Error ? err.message : String(err) })
      .eq('user_id', user.id)
      .eq('provider', 'whoop');
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
