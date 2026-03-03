// app/api/health-metrics/route.ts
// GET    — fetch today's (or a specific date's) log entry for the authed user
// POST   — upsert a daily metric log entry
// PATCH  — update specific fields on an existing row by id
// DELETE — delete row(s) by id, or bulk-delete by source + date range

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
  'stress_score', 'recovery_score', 'weight_lbs',
  'body_fat_pct', 'muscle_mass_lbs', 'bmi', 'notes',
]);

const LOCKED_BODY_METRICS = ['weight_lbs', 'body_fat_pct', 'muscle_mass_lbs', 'bmi'];

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
    .eq('source', 'manual')
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

  // Check permission for any locked body metrics the user is trying to log
  const admin = serviceClient();
  for (const metricKey of LOCKED_BODY_METRICS) {
    if (body[metricKey] !== undefined && body[metricKey] !== null) {
      const { data: perm } = await admin
        .from('user_metric_permissions')
        .select('is_enabled, acknowledged_disclaimer')
        .eq('user_id', user.id)
        .eq('metric_key', metricKey)
        .maybeSingle();

      if (!perm || !perm.is_enabled || !perm.acknowledged_disclaimer) {
        return NextResponse.json(
          { error: `${metricKey} tracking is locked. Please unlock it first.` },
          { status: 403 }
        );
      }
    }
  }

  // Build payload — only allow known writable columns
  const payload: Record<string, unknown> = { logged_date, user_id: user.id, source: 'manual' };
  for (const [k, v] of Object.entries(body)) {
    if (WRITABLE_COLUMNS.has(k)) payload[k] = v;
  }

  const { data, error } = await supabase
    .from('user_health_metrics')
    .upsert(payload, { onConflict: 'user_id,logged_date,source' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
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

  const id = body.id;
  if (typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing row id' }, { status: 400 });
  }

  // Build update payload — only allow known writable columns
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (WRITABLE_COLUMNS.has(k)) updates[k] = v;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // RLS ensures only the user's own rows can be updated
  const { data, error } = await supabase
    .from('user_health_metrics')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Row not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const id = params.get('id');
  const source = params.get('source');
  const from = params.get('from');
  const to = params.get('to');

  // Single row delete by id
  if (id) {
    const { error } = await supabase
      .from('user_health_metrics')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: 1 });
  }

  // Bulk delete by source (optionally scoped to date range)
  if (source) {
    let query = supabase
      .from('user_health_metrics')
      .delete()
      .eq('user_id', user.id)
      .eq('source', source);

    if (from) query = query.gte('logged_date', from);
    if (to) query = query.lte('logged_date', to);

    const { data: deleted, error } = await query.select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: deleted?.length ?? 0 });
  }

  return NextResponse.json({ error: 'Provide id or source param' }, { status: 400 });
}
