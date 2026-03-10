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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  // Fetch the public template with exercises
  const { data: original, error: fetchErr } = await db
    .from('workout_templates')
    .select('*, workout_template_exercises(*)')
    .eq('id', id)
    .eq('visibility', 'public')
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: 'Not found or not public' }, { status: 404 });

  // Check for name collision
  const { data: existingCopy } = await db
    .from('workout_templates')
    .select('id')
    .eq('user_id', user.id)
    .ilike('name', original.name)
    .maybeSingle();

  const copyName = existingCopy ? `${original.name} (Copy)` : original.name;

  // Create template copy
  const { data: copy, error: insertErr } = await db
    .from('workout_templates')
    .insert({
      user_id: user.id,
      name: copyName,
      description: original.description,
      category: original.category,
      estimated_duration_min: original.estimated_duration_min,
      purpose: original.purpose,
      use_count: 0,
      visibility: 'private',
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Copy exercises
  const exercises = original.workout_template_exercises || [];
  if (exercises.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = exercises.map((ex: any) => ({
      template_id: copy.id,
      name: ex.name,
      exercise_id: ex.exercise_id,
      sets: ex.sets,
      reps: ex.reps,
      weight_lbs: ex.weight_lbs,
      duration_sec: ex.duration_sec,
      rest_sec: ex.rest_sec ?? 60,
      sort_order: ex.sort_order,
      notes: ex.notes,
      equipment_id: ex.equipment_id,
      is_circuit: ex.is_circuit ?? false,
      is_negative: ex.is_negative ?? false,
      is_isometric: ex.is_isometric ?? false,
      to_failure: ex.to_failure ?? false,
      is_superset: ex.is_superset ?? false,
      superset_group: ex.superset_group,
      is_balance: ex.is_balance ?? false,
      is_unilateral: ex.is_unilateral ?? false,
      percent_of_max: ex.percent_of_max,
      rpe: ex.rpe,
      tempo: ex.tempo,
      distance_miles: ex.distance_miles,
      hold_sec: ex.hold_sec,
      phase: ex.phase,
      is_bodyweight: ex.is_bodyweight ?? false,
      is_timed: ex.is_timed ?? false,
      per_side: ex.per_side ?? false,
    }));
    await db.from('workout_template_exercises').insert(rows);
  }

  // Increment copy_count on original
  await db
    .from('workout_templates')
    .update({ copy_count: (original.copy_count ?? 0) + 1 })
    .eq('id', id);

  return NextResponse.json({ template: copy }, { status: 201 });
}
