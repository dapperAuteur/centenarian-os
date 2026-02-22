// app/api/health-metrics/route.ts
// GET  — fetch today's (or a specific date's) log entry for the authed user
// POST — upsert a daily metric log entry

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Columns the user is allowed to write (excludes id, user_id, created_at, updated_at)
const WRITABLE_COLUMNS = new Set([
  'resting_hr', 'steps', 'sleep_hours', 'activity_min',
  'sleep_score', 'hrv_ms', 'spo2_pct', 'active_calories',
  'stress_score', 'recovery_score', 'weight_lbs', 'notes',
]);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get('date') ||
    new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('user_health_metrics')
    .select('*')
    .eq('user_id', user.id)
    .eq('logged_date', date)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const logged_date: string =
    typeof body.logged_date === 'string'
      ? body.logged_date
      : new Date().toISOString().split('T')[0];

  // If the user is trying to log weight_lbs, verify they have an active unlock
  if (body.weight_lbs !== undefined && body.weight_lbs !== null) {
    const admin = serviceClient();
    const { data: perm } = await admin
      .from('user_metric_permissions')
      .select('is_enabled, acknowledged_disclaimer')
      .eq('user_id', user.id)
      .eq('metric_key', 'weight_lbs')
      .maybeSingle();

    if (!perm || !perm.is_enabled || !perm.acknowledged_disclaimer) {
      return NextResponse.json(
        { error: 'Body weight tracking is locked. Please unlock it first.' },
        { status: 403 }
      );
    }
  }

  // Build payload — only allow known writable columns
  const payload: Record<string, unknown> = { logged_date, user_id: user.id };
  for (const [k, v] of Object.entries(body)) {
    if (WRITABLE_COLUMNS.has(k)) payload[k] = v;
  }

  const { data, error } = await supabase
    .from('user_health_metrics')
    .upsert(payload, { onConflict: 'user_id,logged_date' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
