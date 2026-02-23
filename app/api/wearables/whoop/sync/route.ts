// app/api/wearables/whoop/sync/route.ts
// POST: sync Whoop data for the authenticated user

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

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
    .select('access_token')
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
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const startDate = since.toISOString();
    const endDate = new Date().toISOString();
    const params = { start: startDate, end: endDate };

    const [recoveryData, sleepData, workoutData] = await Promise.all([
      whoopFetch(conn.access_token, 'recovery', params),
      whoopFetch(conn.access_token, 'activity/sleep', params),
      whoopFetch(conn.access_token, 'activity/workout', params),
    ]);

    // Build per-day map
    const dayMap = new Map<string, Record<string, unknown>>();
    const getDay = (dateStr: string) => {
      const date = dateStr.split('T')[0];
      if (!dayMap.has(date)) dayMap.set(date, { user_id: user.id, logged_date: date });
      return dayMap.get(date)!;
    };

    for (const r of recoveryData.records ?? []) {
      const d = getDay(r.created_at || r.updated_at);
      if (r.score?.recovery_score != null) d.recovery_score = Math.round(r.score.recovery_score);
      if (r.score?.resting_heart_rate != null) d.resting_hr = Math.round(r.score.resting_heart_rate);
      if (r.score?.hrv_rmssd_milli != null) d.hrv_ms = Math.round(r.score.hrv_rmssd_milli);
      if (r.score?.spo2_percentage != null) d.spo2_pct = r.score.spo2_percentage;
    }

    for (const s of sleepData.records ?? []) {
      const d = getDay(s.start || s.created_at);
      if (s.score?.sleep_performance_percentage != null) d.sleep_score = Math.round(s.score.sleep_performance_percentage);
      if (s.score?.stage_summary?.total_in_bed_time_milli != null) {
        d.sleep_hours = Math.round((s.score.stage_summary.total_in_bed_time_milli / 3600000) * 10) / 10;
      }
    }

    for (const w of workoutData.records ?? []) {
      const d = getDay(w.start || w.created_at);
      if (w.score?.kilojoule != null) {
        d.active_calories = Math.round(w.score.kilojoule * 0.239006); // kJ to kcal
      }
      if (w.score?.distance_meter != null) {
        d.steps = (d.steps as number || 0) + Math.round(w.score.distance_meter / 0.762); // rough step estimate
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
      .eq('provider', 'whoop');

    return NextResponse.json({ synced: payloads.length });
  } catch (err) {
    await db.from('wearable_connections')
      .update({ sync_status: 'error', sync_error: String(err) })
      .eq('user_id', user.id)
      .eq('provider', 'whoop');
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
