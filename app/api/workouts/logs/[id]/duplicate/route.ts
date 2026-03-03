// app/api/workouts/logs/[id]/duplicate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: original, error: fetchErr } = await db
    .from('workout_logs')
    .select('*, workout_log_exercises(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: newLog, error: insertErr } = await db
    .from('workout_logs')
    .insert({
      user_id: user.id,
      name: original.name,
      date: new Date().toISOString().split('T')[0],
      template_id: original.template_id,
      duration_min: original.duration_min,
      notes: original.notes,
      purpose: original.purpose ?? [],
      overall_feeling: original.overall_feeling ?? null,
      warmup_notes: original.warmup_notes ?? null,
      cooldown_notes: original.cooldown_notes ?? null,
    })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Copy exercises
  if (original.workout_log_exercises?.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercises = original.workout_log_exercises.map((ex: any) => ({
      log_id: newLog.id,
      name: ex.name,
      exercise_id: ex.exercise_id ?? null,
      sets_completed: ex.sets_completed,
      reps_completed: ex.reps_completed,
      weight_lbs: ex.weight_lbs,
      duration_sec: ex.duration_sec,
      rest_sec: ex.rest_sec ?? 60,
      notes: ex.notes,
      sort_order: ex.sort_order,
      equipment_id: ex.equipment_id ?? null,
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
      tempo: ex.tempo ?? null,
      distance_miles: ex.distance_miles ?? null,
      hold_sec: ex.hold_sec ?? null,
      phase: ex.phase ?? null,
      side: ex.side ?? null,
      feeling: ex.feeling ?? null,
    }));
    await db.from('workout_log_exercises').insert(exercises);
  }

  return NextResponse.json({ id: newLog.id });
}
