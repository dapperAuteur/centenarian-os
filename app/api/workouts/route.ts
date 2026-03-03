// app/api/workouts/route.ts
// GET: list workout templates with exercises
// POST: create workout template with exercises

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('workout_templates')
    .select('*, workout_template_exercises(*)')
    .eq('user_id', user.id)
    .order('use_count', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sort exercises within each template
  const templates = (data ?? []).map((t) => ({
    ...t,
    workout_template_exercises: (t.workout_template_exercises ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  }));

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, description, category, estimated_duration_min, purpose, exercises = [] } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const db = getDb();
  const { data: template, error } = await db
    .from('workout_templates')
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description ?? null,
      category: category ?? null,
      estimated_duration_min: estimated_duration_min ? Number(estimated_duration_min) : null,
      purpose: Array.isArray(purpose) ? purpose : [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert exercises
  if (exercises.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = exercises.map((ex: any, i: number) => ({
      template_id: template.id,
      name: ex.name,
      exercise_id: ex.exercise_id || null,
      sets: ex.sets ?? null,
      reps: ex.reps ?? null,
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
    }));

    await db.from('workout_template_exercises').insert(rows);
  }

  // Return with exercises
  const { data: full } = await db
    .from('workout_templates')
    .select('*, workout_template_exercises(*)')
    .eq('id', template.id)
    .single();

  return NextResponse.json(full, { status: 201 });
}
