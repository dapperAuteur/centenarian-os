// app/api/health-metrics/export/route.ts
// GET: export health metrics as CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');

  let query = supabase
    .from('user_health_metrics')
    .select('*')
    .order('logged_date', { ascending: true });

  if (from) query = query.gte('logged_date', from);
  if (to) query = query.lte('logged_date', to);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r) => [
    r.logged_date || '',
    String(r.resting_hr ?? ''),
    String(r.steps ?? ''),
    String(r.sleep_hours ?? ''),
    String(r.activity_min ?? ''),
    String(r.sleep_score ?? ''),
    String(r.hrv_ms ?? ''),
    String(r.spo2_pct ?? ''),
    String(r.active_calories ?? ''),
    String(r.stress_score ?? ''),
    String(r.recovery_score ?? ''),
    String(r.weight_lbs ?? ''),
    String(r.body_fat_pct ?? ''),
    String(r.muscle_mass_lbs ?? ''),
    String(r.bmi ?? ''),
    r.notes || '',
  ]);

  return buildCsvResponse(
    ['Date', 'Resting HR', 'Steps', 'Sleep Hours', 'Activity Min', 'Sleep Score', 'HRV ms', 'SpO2 %', 'Active Calories', 'Stress Score', 'Recovery Score', 'Weight lbs', 'Body Fat %', 'Muscle Mass lbs', 'BMI', 'Notes'],
    rows,
    'centenarianos-health-metrics-export.csv',
  );
}
