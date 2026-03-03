// app/api/health-metrics/summary/route.ts
// GET — returns 7-day and 30-day averages for the authed user's logged metrics

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const METRIC_COLUMNS = [
  'resting_hr', 'steps', 'sleep_hours', 'activity_min',
  'sleep_score', 'hrv_ms', 'spo2_pct', 'active_calories',
  'stress_score', 'recovery_score', 'weight_lbs',
  'body_fat_pct', 'muscle_mass_lbs', 'bmi',
] as const;

type MetricKey = typeof METRIC_COLUMNS[number];

interface SummaryRow {
  logged_date: string;
  [key: string]: number | string | null;
}

function average(rows: SummaryRow[], key: MetricKey): number | null {
  const vals = rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === 'number' && v !== null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = parseInt(request.nextUrl.searchParams.get('days') || '7', 10);
  const validDays = [7, 30, 90].includes(days) ? days : 7;

  const since = new Date();
  since.setDate(since.getDate() - validDays);
  const sinceStr = since.toISOString().split('T')[0];

  const { data: rows, error } = await supabase
    .from('user_health_metrics')
    .select(METRIC_COLUMNS.join(', ') + ', logged_date')
    .eq('user_id', user.id)
    .eq('source', 'manual')
    .gte('logged_date', sinceStr)
    .order('logged_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary: Record<string, number | null> = {};
  for (const key of METRIC_COLUMNS) {
    summary[key] = average((rows || []) as unknown as SummaryRow[], key);
  }

  return NextResponse.json({
    days: validDays,
    log_count: (rows || []).length,
    averages: summary,
    rows: rows || [],
  });
}
