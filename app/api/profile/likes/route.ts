import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: exerciseLikes }, { data: workoutLikes }] = await Promise.all([
    supabase
      .from('exercise_likes')
      .select('exercise_id, created_at, exercises(id, name, video_url, like_count, done_count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('workout_likes')
      .select('template_id, created_at, workout_templates(id, name, category, like_count, done_count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    exercise_likes: exerciseLikes ?? [],
    workout_likes: workoutLikes ?? [],
  });
}
