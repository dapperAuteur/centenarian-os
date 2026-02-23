// app/api/wearables/oura/sync/route.ts
// POST: sync Oura data for the authenticated user

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

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
    .select('access_token')
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
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const startDate = since.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    const params = { start_date: startDate, end_date: endDate };

    const [sleepData, activityData, readinessData] = await Promise.all([
      ouraFetch(conn.access_token, 'daily_sleep', params),
      ouraFetch(conn.access_token, 'daily_activity', params),
      ouraFetch(conn.access_token, 'daily_readiness', params),
    ]);

    // Build per-day map
    const dayMap = new Map<string, Record<string, unknown>>();
    const getDay = (date: string) => {
      if (!dayMap.has(date)) dayMap.set(date, { user_id: user.id, logged_date: date });
      return dayMap.get(date)!;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of sleepData.data ?? []) {
      const d = getDay(s.day);
      if (s.contributors?.total_sleep) d.sleep_score = s.score;
      if (s.contributors?.deep_sleep != null) {
        // total_sleep_duration is in seconds
        d.sleep_hours = Math.round((s.total_sleep_duration || 0) / 3600 * 10) / 10;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of activityData.data ?? []) {
      const d = getDay(a.day);
      d.steps = a.steps;
      d.active_calories = a.active_calories;
      if (a.equivalent_walking_distance) {
        d.activity_min = Math.round((a.high_activity_time || 0) / 60);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of readinessData.data ?? []) {
      const d = getDay(r.day);
      d.recovery_score = r.score;
      if (r.temperature_deviation != null) {
        // Readiness data may include resting HR
      }
    }

    const payloads = [...dayMap.values()].filter((d) => Object.keys(d).length > 2);

    if (payloads.length > 0) {
      await db.from('user_health_metrics')
        .upsert(payloads, { onConflict: 'user_id,logged_date' });
    }

    await db.from('wearable_connections')
      .update({ sync_status: 'idle', last_synced_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('provider', 'oura');

    return NextResponse.json({ synced: payloads.length });
  } catch (err) {
    await db.from('wearable_connections')
      .update({ sync_status: 'error', sync_error: String(err) })
      .eq('user_id', user.id)
      .eq('provider', 'oura');
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
