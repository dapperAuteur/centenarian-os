import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ alias: string }> },
) {
  const { alias } = await params;
  const db = getDb();

  // Look up user by public_alias
  const { data: profile } = await db
    .from('profiles')
    .select('id, likes_public')
    .eq('public_alias', alias)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!profile.likes_public) {
    return NextResponse.json({ error: 'This user\'s likes are private' }, { status: 403 });
  }

  const [{ data: exerciseLikes }, { data: workoutLikes }] = await Promise.all([
    db
      .from('exercise_likes')
      .select('exercise_id, created_at, exercises(id, name, like_count, done_count)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false }),
    db
      .from('workout_likes')
      .select('template_id, created_at, workout_templates(id, name, category, like_count, done_count)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    alias,
    exercise_likes: exerciseLikes ?? [],
    workout_likes: workoutLikes ?? [],
  });
}
