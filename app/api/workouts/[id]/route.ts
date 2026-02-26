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
  const allowed = ['name', 'description', 'category', 'estimated_duration_min'];
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
      const rows = body.exercises.map((ex: { name: string; sets?: number; reps?: number; weight_lbs?: number; duration_sec?: number; rest_sec?: number; notes?: string }, i: number) => ({
        template_id: id,
        name: ex.name,
        sets: ex.sets ?? null,
        reps: ex.reps ?? null,
        weight_lbs: ex.weight_lbs ? Number(ex.weight_lbs) : null,
        duration_sec: ex.duration_sec ? Number(ex.duration_sec) : null,
        rest_sec: ex.rest_sec ?? 60,
        sort_order: i,
        notes: ex.notes ?? null,
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
