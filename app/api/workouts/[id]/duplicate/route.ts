// app/api/workouts/[id]/duplicate/route.ts
// POST: duplicate a workout template

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
    .from('workout_templates')
    .select('*, workout_template_exercises(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: newTemplate, error: insertErr } = await db
    .from('workout_templates')
    .insert({
      user_id: user.id,
      name: `${original.name} (Copy)`,
      description: original.description ?? null,
      category: original.category ?? null,
      estimated_duration_min: original.estimated_duration_min ?? null,
      purpose: original.purpose ?? [],
      use_count: 0,
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Copy exercises
  if (original.workout_template_exercises?.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercises = original.workout_template_exercises.map((ex: any) => ({
      template_id: newTemplate.id,
      name: ex.name,
      exercise_id: ex.exercise_id ?? null,
      sets: ex.sets ?? null,
      reps: ex.reps ?? null,
      weight_lbs: ex.weight_lbs ?? null,
      duration_sec: ex.duration_sec ?? null,
      rest_sec: ex.rest_sec ?? 60,
      sort_order: ex.sort_order ?? 0,
      notes: ex.notes ?? null,
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
      is_bodyweight: ex.is_bodyweight ?? false,
      is_timed: ex.is_timed ?? false,
      per_side: ex.per_side ?? false,
    }));
    await db.from('workout_template_exercises').insert(exercises);
  }

  // Return full template with exercises
  const { data: full } = await db
    .from('workout_templates')
    .select('*, workout_template_exercises(*)')
    .eq('id', newTemplate.id)
    .single();

  return NextResponse.json({ template: full }, { status: 201 });
}
