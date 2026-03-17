import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();

  // Top exercises by engagement
  const { data: topExercises } = await db
    .from('exercises')
    .select('id, name, like_count, copy_count, done_count, visibility')
    .eq('visibility', 'public')
    .eq('is_active', true)
    .order('like_count', { ascending: false })
    .limit(20);

  // Top workouts by engagement
  const { data: topWorkouts } = await db
    .from('workout_templates')
    .select('id, name, like_count, copy_count, done_count, visibility')
    .eq('visibility', 'public')
    .order('like_count', { ascending: false })
    .limit(20);

  // Share stats by platform
  const { data: shares } = await db
    .from('content_shares')
    .select('content_type, platform, user_alias, shared_at')
    .order('shared_at', { ascending: false })
    .limit(100);

  // Aggregate share counts by platform
  const platformCounts: Record<string, number> = {};
  for (const s of shares ?? []) {
    const p = s.platform || 'link';
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  }

  // Total counts
  const { count: totalPublicExercises } = await db
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('visibility', 'public')
    .eq('is_active', true);

  const { count: totalPublicWorkouts } = await db
    .from('workout_templates')
    .select('id', { count: 'exact', head: true })
    .eq('visibility', 'public');

  const { count: totalShares } = await db
    .from('content_shares')
    .select('id', { count: 'exact', head: true });

  return NextResponse.json({
    top_exercises: topExercises ?? [],
    top_workouts: topWorkouts ?? [],
    recent_shares: shares ?? [],
    share_platforms: platformCounts,
    totals: {
      public_exercises: totalPublicExercises ?? 0,
      public_workouts: totalPublicWorkouts ?? 0,
      total_shares: totalShares ?? 0,
    },
  });
}
