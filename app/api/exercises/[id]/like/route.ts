import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadReferencedRow, type AccessRow } from '@/lib/activity-links/ownership';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Only the caller's own exercises, or public and active ones, can be liked
  // (the 'exercise' rule in lib/activity-links/ownership). An unknown id and
  // someone else's private exercise get the same 404, and neither writes a
  // like or bumps a counter.
  const access = await loadReferencedRow(
    async (table, columns, exerciseId) => {
      const { data, error } = await supabase.from(table).select(columns).eq('id', exerciseId).maybeSingle();
      return { row: (data as AccessRow | null) ?? null, failed: !!error };
    },
    'exercise',
    id,
    user.id,
  );
  if (access.failed) return NextResponse.json({ error: 'Could not update like' }, { status: 500 });
  if (!access.allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
