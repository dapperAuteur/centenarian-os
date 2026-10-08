// app/api/wearables/garmin/sync/route.ts
// POST: sync Garmin data for the authenticated user.
//
// Garmin is marked "Coming Soon" in Settings and needs Garmin developer
// credentials, so this route is not reachable from the app today. It is kept
// correct so it works the day the connection is switched on:
//   - rows are written with source 'garmin' (the same row a Garmin CSV import
//     uses), keyed on Garmin's calendarDate, through importDailyMetrics:
//     a value Garmin sends wins, a field it leaves out is never erased, and a
//     day already stored is never added twice;
//   - a failed write marks the connection 'error' with sync_error, instead of
//     reporting a sync that wrote nothing (the old upsert targeted a key that
//     migration 080 removed, and its error was never read);
//   - each sync asks only for what changed: from the last sync minus 2 days,
//     never more than 30 days back.

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { importDailyMetrics } from '@/lib/fitness-import/daily-metrics';
import { garminDays, splitRange, syncWindowStart } from '@/lib/fitness-import/wearable-days';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// FALLBACK, not verified: the longest upload-time range one Garmin Health API
// pull request accepts. Taken as 24 hours; check Garmin's Health API reference
// before enabling the connection. Shorter ranges only cost extra requests.
const GARMIN_MAX_RANGE_SECONDS = 86_400;

async function garminFetch(token: string, endpoint: string, params?: Record<string, string>) {
  const url = new URL(`https://apis.garmin.com/wellness-api/rest/${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Garmin API ${endpoint}: ${res.status}`);
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
    .eq('provider', 'garmin')
    .maybeSingle();

  if (!conn?.access_token) {
    return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 });
  }

  await db.from('wearable_connections')
    .update({ sync_status: 'syncing', sync_error: null })
    .eq('user_id', user.id)
    .eq('provider', 'garmin');

  try {
    const now = new Date();
    const startSeconds = Math.floor(syncWindowStart(conn.last_synced_at, now).getTime() / 1000);
    const endSeconds = Math.floor(now.getTime() / 1000);

    const dailies: unknown[] = [];
    const sleeps: unknown[] = [];
    for (const [from, to] of splitRange(startSeconds, endSeconds, GARMIN_MAX_RANGE_SECONDS)) {
      const params = { uploadStartTimeInSeconds: String(from), uploadEndTimeInSeconds: String(to) };
      const [d, s] = await Promise.all([
        garminFetch(conn.access_token, 'dailies', params),
        garminFetch(conn.access_token, 'sleeps', params),
      ]);
      if (Array.isArray(d)) dailies.push(...d);
      if (Array.isArray(s)) sleeps.push(...s);
    }

    const result = await importDailyMetrics(db, {
      userId: user.id,
      source: 'garmin',
      rows: garminDays(dailies, sleeps),
      mode: 'replace',
    });

    const { error: statusError } = await db.from('wearable_connections')
      .update({ sync_status: 'idle', sync_error: null, last_synced_at: now.toISOString() })
      .eq('user_id', user.id)
      .eq('provider', 'garmin');
    if (statusError) throw new Error(`Could not record the sync: ${statusError.message}`);

    const { counts } = result;
    return NextResponse.json({
      synced: counts.inserted + counts.filled + counts.replaced,
      ...counts,
    });
  } catch (err) {
    await db.from('wearable_connections')
      .update({ sync_status: 'error', sync_error: err instanceof Error ? err.message : String(err) })
      .eq('user_id', user.id)
      .eq('provider', 'garmin');
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
