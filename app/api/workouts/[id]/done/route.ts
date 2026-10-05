import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { checkOwned, ownedIds } from '@/lib/auth/ownership';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const DEDUP_WINDOW_MINUTES = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Only the caller's own workouts, or public ones, can be marked done (the
  // workout_templates rule in lib/auth/ownership: visibility = 'public',
  // migration 117). An unknown id and someone else's private workout get the
  // same 404, and neither writes a completion, reads the workout's exercises
  // or bumps a counter.
  const access = await checkOwned(supabase, user.id, 'workout_templates', id, { allowPublic: true });
  if (access.failed) return NextResponse.json({ error: 'Could not record completion' }, { status: 500 });
  if (!access.allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check for recent completions within dedup window
  const windowStart = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: recent } = await supabase
    .from('workout_completions')
    .select('id')
    .eq('user_id', user.id)
    .eq('template_id', id)
    .gte('completed_at', windowStart);

  if (recent && recent.length > 0 && !body.confirmed) {
    return NextResponse.json({
      confirm_needed: true,
      recent_count: recent.length,
      window_minutes: DEDUP_WINDOW_MINUTES,
    });
  }

  const db = getDb();

  // Insert workout completion
  const { error } = await supabase
    .from('workout_completions')
    .insert({ user_id: user.id, template_id: id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-complete each exercise in this workout once
  const { data: templateExercises } = await db
    .from('workout_template_exercises')
    .select('exercise_id')
    .eq('template_id', id)
    .not('exercise_id', 'is', null);

  if (templateExercises && templateExercises.length > 0) {
    // A public workout can include exercises its author kept private. Those
    // are skipped: a completion bumps the exercise's done_count, and the
    // caller may only do that for an exercise they could mark done directly
    // (their own, or public and active).
    const exerciseIds = templateExercises.map((te: { exercise_id: string }) => te.exercise_id);
    const visible = await ownedIds(db, user.id, 'exercises', exerciseIds, { allowPublic: true });
    const exerciseCompletions = exerciseIds
      .filter((exerciseId: string) => visible.has(exerciseId))
      .map((exerciseId: string) => ({ user_id: user.id, exercise_id: exerciseId }));
    if (exerciseCompletions.length > 0) {
      await db.from('exercise_completions').insert(exerciseCompletions);
    }
  }

  // Return updated count
  const { data: template } = await supabase
    .from('workout_templates')
    .select('done_count')
    .eq('id', id)
    .maybeSingle();

  return NextResponse.json({
    done: true,
    done_count: template?.done_count ?? 0,
  });
}
