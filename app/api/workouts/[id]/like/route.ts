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

  const { data: existing } = await supabase
    .from('workout_likes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('template_id', id)
    .maybeSingle();

  if (existing) {
    await supabase.from('workout_likes').delete().eq('user_id', user.id).eq('template_id', id);
  } else {
    await supabase.from('workout_likes').insert({ user_id: user.id, template_id: id });
  }

  const { data: template } = await supabase
    .from('workout_templates')
    .select('like_count')
    .eq('id', id)
    .maybeSingle();

  return NextResponse.json({
    liked: !existing,
    like_count: template?.like_count ?? 0,
  });
}
