import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Check if already liked
  const { data: existing } = await supabase
    .from('exercise_likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('exercise_id', id)
    .maybeSingle();

  if (existing) {
    // Unlike
    await supabase
      .from('exercise_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('exercise_id', id);
  } else {
    // Like
    await supabase
      .from('exercise_likes')
      .insert({ user_id: user.id, exercise_id: id });
  }

  // Return updated count
  const { data: exercise } = await supabase
    .from('exercises')
    .select('like_count')
    .eq('id', id)
    .maybeSingle();

  return NextResponse.json({
    liked: !existing,
    like_count: exercise?.like_count ?? 0,
  });
}
