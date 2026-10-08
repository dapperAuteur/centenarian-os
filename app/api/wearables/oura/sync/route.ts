// app/api/wearables/oura/sync/route.ts
// POST: sync Oura data for the authenticated user.
//
// Oura has no card on the Wearables settings page, so nothing in the app
// calls this route today. Its write path matches the Garmin sync: source
// 'oura', the provider's own day, importDailyMetrics (a value Oura sends
// wins, a field it leaves out is never erased, no day is added twice), a
// failed write marks the connection 'error', and each sync reaches back to the
// last sync minus 2 days (30 days at most).

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { importDailyMetrics } from '@/lib/fitness-import/daily-metrics';
import { ouraDays, syncWindowStart } from '@/lib/fitness-import/wearable-days';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function ouraFetch(token: string, endpoint: string, params: Record<string, string>) {
  const url = new URL(`https://api.ouraring.com/v2/usercollection/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Oura API ${endpoint}: ${res.status}`);
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
    .eq('provider', 'oura')
    .maybeSingle();

  if (!conn?.access_token) {
    return NextResponse.json({ error: 'Oura not connected' }, { status: 400 });
  }

  await db.from('wearable_connections')
    .update({ sync_status: 'syncing', sync_error: null })
    .eq('user_id', user.id)
    .eq('provider', 'oura');

  try {
    const now = new Date();
    // Oura takes whole days: start on the window's day, end today.
    const startDate = syncWindowStart(conn.last_synced_at, now).toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    const params = { start_date: startDate, end_date: endDate };

    const [sleepData, activityData, readinessData] = await Promise.all([
      ouraFetch(conn.access_token, 'daily_sleep', params),
      ouraFetch(conn.access_token, 'daily_activity', params),
      ouraFetch(conn.access_token, 'daily_readiness', params),
    ]);

    const result = await importDailyMetrics(db, {
      userId: user.id,
      source: 'oura',
      rows: ouraDays(sleepData, activityData, readinessData),
      mode: 'replace',
    });

    const { error: statusError } = await db.from('wearable_connections')
      .update({ sync_status: 'idle', sync_error: null, last_synced_at: now.toISOString() })
      .eq('user_id', user.id)
      .eq('provider', 'oura');
    if (statusError) throw new Error(`Could not record the sync: ${statusError.message}`);

    const { counts } = result;
    return NextResponse.json({ synced: counts.inserted + counts.filled + counts.replaced, ...counts });
  } catch (err) {
    await db.from('wearable_connections')
      .update({ sync_status: 'error', sync_error: err instanceof Error ? err.message : String(err) })
      .eq('user_id', user.id)
      .eq('provider', 'oura');
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
