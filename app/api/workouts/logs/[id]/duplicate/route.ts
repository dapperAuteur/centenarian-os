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
    })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Copy exercises
  if (original.workout_log_exercises?.length > 0) {
    const exercises = original.workout_log_exercises.map((ex: { name: string; sets_completed: number | null; reps_completed: number | null; weight_lbs: number | null; duration_sec: number | null; notes: string | null; sort_order: number }) => ({
      log_id: newLog.id,
      name: ex.name,
      sets_completed: ex.sets_completed,
      reps_completed: ex.reps_completed,
      weight_lbs: ex.weight_lbs,
      duration_sec: ex.duration_sec,
      notes: ex.notes,
      sort_order: ex.sort_order,
    }));
    await db.from('workout_log_exercises').insert(exercises);
  }

  return NextResponse.json({ id: newLog.id });
}
