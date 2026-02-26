// app/api/workouts/logs/route.ts
// GET: list workout log history
// POST: log a workout (optionally from template)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 50), 100);
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? 0);

  const { data, error } = await db
    .from('workout_logs')
    .select('*, workout_log_exercises(*)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { template_id, name, date, started_at, finished_at, duration_min, notes, exercises = [] } = body;

  const db = getDb();

  // If from template, increment use_count and use template name if not provided
  let logName = name;
  if (template_id) {
    const { data: tmpl } = await db
      .from('workout_templates')
      .select('name, use_count')
      .eq('id', template_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (tmpl) {
      if (!logName) logName = tmpl.name;
      await db
        .from('workout_templates')
        .update({ use_count: tmpl.use_count + 1 })
        .eq('id', template_id);
    }
  }

  if (!logName?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data: log, error } = await db
    .from('workout_logs')
    .insert({
      user_id: user.id,
      template_id: template_id ?? null,
      name: logName.trim(),
      date: date ?? new Date().toISOString().split('T')[0],
      started_at: started_at ?? null,
      finished_at: finished_at ?? null,
      duration_min: duration_min ? Number(duration_min) : null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert exercises
  if (exercises.length > 0) {
    const rows = exercises.map((ex: { name: string; sets_completed?: number; reps_completed?: number; weight_lbs?: number; duration_sec?: number; notes?: string }, i: number) => ({
      log_id: log.id,
      name: ex.name,
      sets_completed: ex.sets_completed ?? null,
      reps_completed: ex.reps_completed ?? null,
      weight_lbs: ex.weight_lbs ? Number(ex.weight_lbs) : null,
      duration_sec: ex.duration_sec ? Number(ex.duration_sec) : null,
      sort_order: i,
      notes: ex.notes ?? null,
    }));

    await db.from('workout_log_exercises').insert(rows);
  }

  const { data: full } = await db
    .from('workout_logs')
    .select('*, workout_log_exercises(*)')
    .eq('id', log.id)
    .single();

  return NextResponse.json(full, { status: 201 });
}
