import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  // Check for recent completions within the dedup window
  const windowStart = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: recent, error: recentErr } = await supabase
    .from('exercise_completions')
    .select('id')
    .eq('user_id', user.id)
    .eq('exercise_id', id)
    .gte('completed_at', windowStart);

  if (recentErr) return NextResponse.json({ error: recentErr.message }, { status: 500 });

  // If recent completions exist and user hasn't confirmed, ask for confirmation
  if (recent && recent.length > 0 && !body.confirmed) {
    return NextResponse.json({
      confirm_needed: true,
      recent_count: recent.length,
      window_minutes: DEDUP_WINDOW_MINUTES,
    });
  }

  // Insert completion
  const { error } = await supabase
    .from('exercise_completions')
    .insert({ user_id: user.id, exercise_id: id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return updated count
  const { data: exercise } = await supabase
    .from('exercises')
    .select('done_count')
    .eq('id', id)
    .maybeSingle();

  return NextResponse.json({
    done: true,
    done_count: exercise?.done_count ?? 0,
  });
}
