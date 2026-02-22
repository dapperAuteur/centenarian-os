// app/api/profiles/[username]/route.ts
// GET — public profile data: user info, achievements, blog posts, recipes,
//        completed courses and learning paths, metric streak count.
// No auth required — this is a fully public endpoint.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type Params = { params: Promise<{ username: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { username } = await params;
  const db = getDb();

  // 1. Look up profile by username
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, created_at')
    .eq('username', username)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const userId = profile.id;

  // 2. Fetch all public data in parallel
  const [
    achievementsRes,
    blogRes,
    recipesRes,
    pathCompletionsRes,
    streakRes,
  ] = await Promise.all([
    // Achievements (badges)
    db
      .from('user_achievements')
      .select('id, achievement_type, ref_id, earned_at')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false }),

    // Published blog posts
    db
      .from('blog_posts')
      .select('id, title, slug, excerpt, published_at, tags, reading_time_minutes, like_count')
      .eq('user_id', userId)
      .eq('visibility', 'public')
      .order('published_at', { ascending: false })
      .limit(10),

    // Published recipes
    db
      .from('recipes')
      .select('id, title, slug, description, cover_image_url, tags, like_count')
      .eq('user_id', userId)
      .eq('visibility', 'public')
      .order('published_at', { ascending: false })
      .limit(10),

    // Learning path completions with path details
    db
      .from('learning_path_completions')
      .select('id, completed_at, path_id, learning_paths(title, description)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false }),

    // Metric logging streak — count consecutive logged days up to today
    db
      .from('user_health_metrics')
      .select('logged_date')
      .eq('user_id', userId)
      .order('logged_date', { ascending: false })
      .limit(120), // enough to cover a 90-day streak check
  ]);

  // 3. Completed courses (from achievements)
  const courseAchievements = (achievementsRes.data || [])
    .filter((a) => a.achievement_type === 'course_complete' && a.ref_id);

  let completedCourses: { id: string; title: string; cover_image_url: string | null; category: string | null }[] = [];
  if (courseAchievements.length > 0) {
    const courseIds = courseAchievements.map((a) => a.ref_id as string);
    const { data: courses } = await db
      .from('courses')
      .select('id, title, cover_image_url, category')
      .in('id', courseIds)
      .eq('is_published', true);
    completedCourses = courses || [];
  }

  // 4. Calculate metric streak (consecutive days ending today or yesterday)
  const logDates = (streakRes.data || []).map((r) => r.logged_date as string).sort().reverse();
  let streak = 0;
  if (logDates.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    // Only count streak if they logged today or yesterday (not stale)
    if (logDates[0] === today || logDates[0] === yesterday) {
      let expected = logDates[0];
      for (const date of logDates) {
        if (date === expected) {
          streak++;
          const d = new Date(expected);
          d.setDate(d.getDate() - 1);
          expected = d.toISOString().split('T')[0];
        } else {
          break;
        }
      }
    }
  }

  // 5. Compose response
  return NextResponse.json({
    profile,
    stats: {
      courses_completed: completedCourses.length,
      paths_completed: (pathCompletionsRes.data || []).length,
      blog_posts: (blogRes.data || []).length,
      recipes: (recipesRes.data || []).length,
      metric_streak: streak,
    },
    achievements: achievementsRes.data || [],
    completed_courses: completedCourses,
    path_completions: pathCompletionsRes.data || [],
    blog_posts: blogRes.data || [],
    recipes: recipesRes.data || [],
  });
}
