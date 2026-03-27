// app/api/workouts/[id]/route.ts
// PATCH: update workout template + exercises  |  DELETE: remove template

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await request.json();

  // Update template fields
  const allowed = ['name', 'description', 'category', 'category_id', 'estimated_duration_min', 'purpose', 'visibility'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await db
      .from('workout_templates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace exercises if provided
  if (body.exercises) {
    await db.from('workout_template_exercises').delete().eq('template_id', id);

    if (body.exercises.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = body.exercises.map((ex: any, i: number) => ({
        template_id: id,
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
        is_bodyweight: ex.is_bodyweight ?? false,
        is_timed: ex.is_timed ?? false,
        per_side: ex.per_side ?? false,
      }));

      await db.from('workout_template_exercises').insert(rows);
    }
  }

  const { data } = await db
    .from('workout_templates')
    .select('*, workout_template_exercises(*)')
    .eq('id', id)
    .single();

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { error } = await db
    .from('workout_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
