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
  const { template_id, name, date, started_at, finished_at, duration_min, notes, purpose, overall_feeling, warmup_notes, cooldown_notes, exercises = [] } = body;

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
      purpose: Array.isArray(purpose) ? purpose : [],
      overall_feeling: overall_feeling ? Number(overall_feeling) : null,
      warmup_notes: warmup_notes ?? null,
      cooldown_notes: cooldown_notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert exercises
  if (exercises.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = exercises.map((ex: any, i: number) => ({
      log_id: log.id,
      name: ex.name,
      exercise_id: ex.exercise_id || null,
      sets_completed: ex.sets_completed ?? null,
      reps_completed: ex.reps_completed ?? null,
      weight_lbs: ex.weight_lbs ? Number(ex.weight_lbs) : null,
      duration_sec: ex.duration_sec ? Number(ex.duration_sec) : null,
      rest_sec: ex.rest_sec ?? 60,
      sort_order: i,
      notes: ex.notes ?? null,
      equipment_id: ex.equipment_id || null,
      is_circuit: ex.is_circuit ?? false,
      is_negative: ex.is_negative ?? false,
      is_isometric: ex.is_isometric ?? false,
      to_failure: ex.to_failure ?? false,
      is_superset: ex.is_superset ?? false,
      superset_group: ex.superset_group ?? null,
      is_balance: ex.is_balance ?? false,
      is_unilateral: ex.is_unilateral ?? false,
      percent_of_max: ex.percent_of_max ?? null,
      rpe: ex.rpe ?? null,
      tempo: ex.tempo || null,
      distance_miles: ex.distance_miles ?? null,
      hold_sec: ex.hold_sec ?? null,
      phase: ex.phase || null,
      side: ex.side || null,
      feeling: ex.feeling ? Number(ex.feeling) : null,
      is_bodyweight: ex.is_bodyweight ?? false,
      is_timed: ex.is_timed ?? false,
      per_side: ex.per_side ?? false,
    }));

    await db.from('workout_log_exercises').insert(rows);

    // Increment use_count on referenced exercises
    const exerciseIds = rows
      .map((r: { exercise_id: string | null }) => r.exercise_id)
      .filter(Boolean) as string[];
    if (exerciseIds.length > 0) {
      const uniqueIds = [...new Set(exerciseIds)];
      for (const eid of uniqueIds) {
        const { data: exRow } = await db.from('exercises').select('use_count').eq('id', eid).maybeSingle();
        if (exRow) {
          await db.from('exercises').update({ use_count: (exRow.use_count || 0) + 1 }).eq('id', eid);
        }
      }
    }
  }

  const { data: full } = await db
    .from('workout_logs')
    .select('*, workout_log_exercises(*)')
    .eq('id', log.id)
    .single();

  return NextResponse.json(full, { status: 201 });
}
