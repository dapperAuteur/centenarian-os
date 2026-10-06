// app/api/workouts/route.ts
// GET: list workout templates with exercises
// POST: create workout template with exercises

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { checkReferences, invalidReferenceMessage, ownedIds } from '@/lib/auth/ownership';

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
  const { name, description, category, category_id, estimated_duration_min, purpose, exercises = [] } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const db = getDb();
  // The category must be the caller's own or a global one; each exercise and
  // piece of equipment is kept only when the caller may reference it (their
  // own, or public), as in POST /api/workouts/logs.
  const exerciseList: unknown[] = Array.isArray(exercises) ? exercises : [];
  const idsOf = (key: 'exercise_id' | 'equipment_id') =>
    exerciseList.map((ex) => (ex && typeof ex === 'object' ? (ex as Record<string, unknown>)[key] : null));
  const [categoryRefs, exerciseRefs, equipmentRefs] = await Promise.all([
    checkReferences(db, user.id, [{ field: 'category_id', table: 'workout_categories', id: category_id, allowPublic: true }]),
    ownedIds(db, user.id, 'exercises', idsOf('exercise_id'), { allowPublic: true }),
    ownedIds(db, user.id, 'equipment', idsOf('equipment_id'), { allowPublic: true }),
  ]);
  if (categoryRefs.failed || exerciseRefs.failed || equipmentRefs.failed) {
    return NextResponse.json({ error: 'Could not save the workout' }, { status: 500 });
  }
  if (!categoryRefs.ok) return NextResponse.json({ error: invalidReferenceMessage(categoryRefs.invalid) }, { status: 400 });

  const { data: template, error } = await db
    .from('workout_templates')
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description ?? null,
      category: category ?? null,
      category_id: category_id || null,
      estimated_duration_min: estimated_duration_min ? Number(estimated_duration_min) : null,
      purpose: Array.isArray(purpose) ? purpose : [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert exercises
  if (exerciseList.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = exerciseList.map((ex: any, i: number) => ({
      template_id: template.id,
      name: ex.name,
      exercise_id: exerciseRefs.has(ex.exercise_id) ? ex.exercise_id : null,
      sets: ex.sets ?? null,
      reps: ex.reps ?? null,
      weight_lbs: ex.weight_lbs ? Number(ex.weight_lbs) : null,
      duration_sec: ex.duration_sec ? Number(ex.duration_sec) : null,
      rest_sec: ex.rest_sec ?? 60,
      sort_order: i,
      notes: ex.notes ?? null,
      equipment_id: equipmentRefs.has(ex.equipment_id) ? ex.equipment_id : null,
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
      is_bodyweight: ex.is_bodyweight ?? false,
      is_timed: ex.is_timed ?? false,
      per_side: ex.per_side ?? false,
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
