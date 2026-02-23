// app/api/wearables/garmin/sync/route.ts
// POST: sync Garmin data for the authenticated user

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

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
    .select('access_token')
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
    const since = new Date();
    since.setDate(since.getDate() - 30);
    // Garmin uses epoch seconds for date ranges
    const startTimeInSeconds = Math.floor(since.getTime() / 1000);
    const endTimeInSeconds = Math.floor(Date.now() / 1000);
    const params = {
      uploadStartTimeInSeconds: String(startTimeInSeconds),
      uploadEndTimeInSeconds: String(endTimeInSeconds),
    };

    const [dailies, sleeps] = await Promise.all([
      garminFetch(conn.access_token, 'dailies', params),
      garminFetch(conn.access_token, 'sleeps', params),
    ]);

    const dayMap = new Map<string, Record<string, unknown>>();
    const getDay = (epochSeconds: number) => {
      const date = new Date(epochSeconds * 1000).toISOString().split('T')[0];
      if (!dayMap.has(date)) dayMap.set(date, { user_id: user.id, logged_date: date });
      return dayMap.get(date)!;
    };

    for (const daily of dailies ?? []) {
      const d = getDay(daily.startTimeInSeconds || daily.calendarDate);
      if (daily.steps != null) d.steps = daily.steps;
      if (daily.activeKilocalories != null) d.active_calories = daily.activeKilocalories;
      if (daily.highlyActiveSeconds != null) d.activity_min = Math.round(daily.highlyActiveSeconds / 60);
      if (daily.restingHeartRateInBeatsPerMinute != null) d.resting_hr = daily.restingHeartRateInBeatsPerMinute;
      if (daily.stressQualifier) d.stress_score = daily.averageStressLevel || null;
    }

    for (const sleep of sleeps ?? []) {
      const d = getDay(sleep.startTimeInSeconds);
      if (sleep.durationInSeconds != null) {
        d.sleep_hours = Math.round((sleep.durationInSeconds / 3600) * 10) / 10;
      }
      if (sleep.overallSleepScore?.value != null) d.sleep_score = sleep.overallSleepScore.value;
    }

    const payloads = [...dayMap.values()].filter((d) => Object.keys(d).length > 2);

    if (payloads.length > 0) {
      await db.from('user_health_metrics')
        .upsert(payloads, { onConflict: 'user_id,logged_date' });
    }

    await db.from('wearable_connections')
      .update({ sync_status: 'idle', last_synced_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('provider', 'garmin');

    return NextResponse.json({ synced: payloads.length });
  } catch (err) {
    await db.from('wearable_connections')
      .update({ sync_status: 'error', sync_error: String(err) })
      .eq('user_id', user.id)
      .eq('provider', 'garmin');
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
