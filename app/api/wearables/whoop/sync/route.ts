// app/api/wearables/whoop/sync/route.ts
// POST: sync WHOOP data for the authenticated user.
//
// WHOOP has no card on the Wearables settings page, so nothing in the app
// calls this route today. Its write path matches the Garmin sync: source
// 'whoop', the provider's own day, importDailyMetrics (a value WHOOP sends
// wins, a field it leaves out is never erased, no day is added twice), a
// failed write marks the connection 'error', and each sync reaches back to the
// last sync minus 2 days (30 days at most).

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { importDailyMetrics } from '@/lib/fitness-import/daily-metrics';
import { whoopDays, syncWindowStart } from '@/lib/fitness-import/wearable-days';

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
    const params = { start: syncWindowStart(conn.last_synced_at, now).toISOString(), end: now.toISOString() };

    const [recoveryData, sleepData, workoutData] = await Promise.all([
      whoopFetch(conn.access_token, 'recovery', params),
      whoopFetch(conn.access_token, 'activity/sleep', params),
      whoopFetch(conn.access_token, 'activity/workout', params),
    ]);

    const result = await importDailyMetrics(db, {
      userId: user.id,
      source: 'whoop',
      rows: whoopDays(recoveryData, sleepData, workoutData),
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
