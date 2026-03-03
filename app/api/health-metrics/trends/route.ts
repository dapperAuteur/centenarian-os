// app/api/health-metrics/trends/route.ts
// GET — returns time-series data, stats, personal records for the trends page

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const ALL_METRICS = [
  'resting_hr', 'steps', 'sleep_hours', 'activity_min',
  'sleep_score', 'hrv_ms', 'spo2_pct', 'active_calories',
  'stress_score', 'recovery_score', 'weight_lbs',
  'body_fat_pct', 'muscle_mass_lbs', 'bmi',
] as const;

type Metric = typeof ALL_METRICS[number];

// Metrics where a LOWER value is better (for trend color coding)
const LOWER_IS_BETTER = new Set(['resting_hr', 'stress_score', 'body_fat_pct', 'bmi']);
// Metrics where HIGHER is the personal record
const HIGHER_IS_PR = new Set([
  'steps', 'sleep_hours', 'activity_min', 'sleep_score',
  'hrv_ms', 'active_calories', 'recovery_score', 'muscle_mass_lbs',
]);

interface MetricRow {
  logged_date: string;
  source: string;
  [key: string]: string | number | null;
}

interface MetricStat {
  metric: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  latest: number | null;
  trend: 'up' | 'down' | 'flat';
  trend_pct: number;
  count: number;
}

interface PersonalRecord {
  metric: string;
  value: number;
  date: string;
  type: 'highest' | 'lowest';
}

function avgOf(vals: number[]): number | null {
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

function computeStats(rows: MetricRow[], metric: Metric): MetricStat {
  const vals = rows
    .map((r) => ({ v: r[metric], d: r.logged_date }))
    .filter((x): x is { v: number; d: string } => typeof x.v === 'number');

  if (vals.length === 0) {
    return { metric, avg: null, min: null, max: null, latest: null, trend: 'flat', trend_pct: 0, count: 0 };
  }

  const numbers = vals.map((x) => x.v);
  const avg = avgOf(numbers);
  const min = Math.round(Math.min(...numbers) * 10) / 10;
  const max = Math.round(Math.max(...numbers) * 10) / 10;

  // Latest = most recent non-null value
  const sorted = [...vals].sort((a, b) => b.d.localeCompare(a.d));
  const latest = Math.round(sorted[0].v * 10) / 10;

  // Trend: compare last 7 data points avg vs prior 7
  let trend: 'up' | 'down' | 'flat' = 'flat';
  let trend_pct = 0;
  if (sorted.length >= 4) {
    const half = Math.floor(sorted.length / 2);
    const recentAvg = avgOf(sorted.slice(0, Math.min(half, 7)).map((x) => x.v));
    const priorAvg = avgOf(sorted.slice(half, half + Math.min(half, 7)).map((x) => x.v));
    if (recentAvg != null && priorAvg != null && priorAvg !== 0) {
      trend_pct = Math.round(((recentAvg - priorAvg) / Math.abs(priorAvg)) * 1000) / 10;
      trend = trend_pct > 1 ? 'up' : trend_pct < -1 ? 'down' : 'flat';
    }
  }

  return { metric, avg, min, max, latest, trend, trend_pct, count: vals.length };
}

function computeRecords(rows: MetricRow[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];

  for (const metric of ALL_METRICS) {
    const vals = rows
      .map((r) => ({ v: r[metric], d: r.logged_date }))
      .filter((x): x is { v: number; d: string } => typeof x.v === 'number');

    if (vals.length < 3) continue;

    if (HIGHER_IS_PR.has(metric)) {
      const best = vals.reduce((a, b) => (b.v > a.v ? b : a));
      records.push({ metric, value: Math.round(best.v * 10) / 10, date: best.d, type: 'highest' });
    } else if (LOWER_IS_BETTER.has(metric)) {
      const best = vals.reduce((a, b) => (b.v < a.v ? b : a));
      records.push({ metric, value: Math.round(best.v * 10) / 10, date: best.d, type: 'lowest' });
    }
  }

  return records;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const today = new Date().toISOString().split('T')[0];
  const defaultFrom = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const from = params.get('from') || defaultFrom;
  const to = params.get('to') || today;
  const source = params.get('source') || null;

  // Build query
  const selectCols = 'id, ' + ALL_METRICS.join(', ') + ', logged_date, source';
  let query = supabase
    .from('user_health_metrics')
    .select(selectCols)
    .eq('user_id', user.id)
    .gte('logged_date', from)
    .lte('logged_date', to)
    .order('logged_date', { ascending: true });

  if (source) query = query.eq('source', source);

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allRows = (rows || []) as unknown as MetricRow[];

  // Get distinct sources
  const sourceSet = new Set(allRows.map((r) => r.source));
  const sources = Array.from(sourceSet).sort();

  // For stats and records, use manual/merged rows if no source filter
  const statsRows = source ? allRows : allRows.filter((r) => r.source === 'manual');
  const stats = ALL_METRICS.map((m) => computeStats(statsRows, m));

  // Personal records from ALL manual data (not just the range)
  const { data: allTimeRows } = await supabase
    .from('user_health_metrics')
    .select(selectCols)
    .eq('user_id', user.id)
    .eq('source', 'manual')
    .order('logged_date', { ascending: true });

  const records = computeRecords((allTimeRows || []) as unknown as MetricRow[]);

  // Data range info
  const datesWithData = new Set(allRows.map((r) => r.logged_date));
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const totalDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1);

  return NextResponse.json({
    rows: allRows,
    stats,
    records,
    data_range: {
      first_date: from,
      last_date: to,
      total_days: totalDays,
      days_with_data: datesWithData.size,
    },
    sources,
  });
}
