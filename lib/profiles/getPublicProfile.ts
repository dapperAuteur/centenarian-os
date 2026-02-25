// lib/profiles/getPublicProfile.ts
// Shared helper that fetches all public profile data for a given username.
// Used by both the /profiles/[username] page (SSR) and the API route.

import { createClient } from '@supabase/supabase-js';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProfileData {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  role: string;
}

export interface Achievement {
  id: string;
  achievement_type: string;
  ref_id: string | null;
  earned_at: string;
}

export interface Course {
  id: string;
  title: string;
  cover_image_url: string | null;
  category: string | null;
}

export interface TeacherCourse {
  id: string;
  title: string;
  cover_image_url: string | null;
  category: string | null;
  price: number;
  price_type: string;
}

export interface PathCompletion {
  id: string;
  completed_at: string;
  path_id: string;
  learning_paths: { title: string; description: string | null } | null;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
  tags: string[];
  like_count: number;
}

export interface Recipe {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  like_count: number;
}

export interface TravelStats {
  total_miles: number;
  trip_count: number;
  bike_miles: number;
  walk_miles: number;
  co2_saved_kg: number;
}

export interface TeacherInfo {
  bio: string | null;
  specialties: string[];
  published_courses: TeacherCourse[];
}

export interface ProfileResponse {
  profile: ProfileData;
  stats: {
    courses_completed: number;
    paths_completed: number;
    blog_posts: number;
    recipes: number;
    metric_streak: number;
    metrics_logged: number;
  };
  achievements: Achievement[];
  completed_courses: Course[];
  path_completions: PathCompletion[];
  blog_posts: BlogPost[];
  recipes: Recipe[];
  travel: TravelStats | null;
  teacher: TeacherInfo | null;
}

// ─── Main function ───────────────────────────────────────────────────────────

export async function getPublicProfile(username: string): Promise<ProfileResponse | null> {
  const db = getDb();

  // 1. Look up profile by username
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, created_at, role')
    .eq('username', username)
    .maybeSingle();

  if (profileError || !profile) return null;

  const userId = profile.id;

  // 2. Fetch all public data in parallel
  const [
    achievementsRes,
    blogRes,
    recipesRes,
    pathCompletionsRes,
    streakRes,
    blogCountRes,
    recipeCountRes,
    metricsCountRes,
    tripsRes,
  ] = await Promise.all([
    // Achievements (badges)
    db
      .from('user_achievements')
      .select('id, achievement_type, ref_id, earned_at')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false }),

    // Published blog posts (latest 10 for display)
    db
      .from('blog_posts')
      .select('id, title, slug, excerpt, published_at, tags, like_count')
      .eq('user_id', userId)
      .eq('visibility', 'public')
      .order('published_at', { ascending: false })
      .limit(10),

    // Published recipes (latest 10 for display)
    db
      .from('recipes')
      .select('id, title, slug, description, cover_image_url, like_count')
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
      .limit(120),

    // Total blog post count
    db
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('visibility', 'public'),

    // Total recipe count
    db
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('visibility', 'public'),

    // Total distinct days with health metrics
    db
      .from('user_health_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),

    // Trips for travel stats
    db
      .from('trips')
      .select('distance_miles, mode, co2_kg, trip_category')
      .eq('user_id', userId),
  ]);

  // 3. Completed courses (from achievements)
  const courseAchievements = (achievementsRes.data || []).filter(
    (a) => a.achievement_type === 'course_complete' && a.ref_id
  );

  let completedCourses: Course[] = [];
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
  const logDates = (streakRes.data || [])
    .map((r) => r.logged_date as string)
    .sort()
    .reverse();
  let streak = 0;
  if (logDates.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
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

  // 5. Travel stats (only if user has trips)
  const trips = tripsRes.data || [];
  let travel: TravelStats | null = null;
  if (trips.length > 0) {
    const travelTrips = trips.filter((t) => t.trip_category === 'travel');
    travel = {
      total_miles: travelTrips.reduce((sum, t) => sum + (Number(t.distance_miles) || 0), 0),
      trip_count: travelTrips.length,
      bike_miles: travelTrips
        .filter((t) => t.mode === 'bike')
        .reduce((sum, t) => sum + (Number(t.distance_miles) || 0), 0),
      walk_miles: travelTrips
        .filter((t) => t.mode === 'walk')
        .reduce((sum, t) => sum + (Number(t.distance_miles) || 0), 0),
      co2_saved_kg: travelTrips
        .filter((t) => ['bike', 'walk'].includes(t.mode))
        .reduce((sum, t) => sum + (Number(t.co2_kg) || 0), 0),
    };
    // Only include travel if there's meaningful data
    if (travel.total_miles === 0 && travel.trip_count === 0) travel = null;
  }

  // 6. Teacher info (only if user is a teacher)
  let teacher: TeacherInfo | null = null;
  if (profile.role === 'teacher' || profile.role === 'admin') {
    const [teacherProfileRes, teacherCoursesRes] = await Promise.all([
      db
        .from('teacher_profiles')
        .select('bio, specialties')
        .eq('user_id', userId)
        .maybeSingle(),
      db
        .from('courses')
        .select('id, title, cover_image_url, category, price, price_type')
        .eq('teacher_id', userId)
        .eq('is_published', true)
        .order('created_at', { ascending: false }),
    ]);

    const tp = teacherProfileRes.data;
    const courses = teacherCoursesRes.data || [];

    if (tp || courses.length > 0) {
      teacher = {
        bio: tp?.bio || null,
        specialties: tp?.specialties || [],
        published_courses: courses,
      };
    }
  }

  // 7. Compose response
  return {
    profile: profile as ProfileData,
    stats: {
      courses_completed: completedCourses.length,
      paths_completed: (pathCompletionsRes.data || []).length,
      blog_posts: blogCountRes.count ?? (blogRes.data || []).length,
      recipes: recipeCountRes.count ?? (recipesRes.data || []).length,
      metric_streak: streak,
      metrics_logged: metricsCountRes.count ?? 0,
    },
    achievements: achievementsRes.data || [],
    completed_courses: completedCourses,
    path_completions: (pathCompletionsRes.data || []).map((pc) => ({
      ...pc,
      learning_paths: Array.isArray(pc.learning_paths) ? pc.learning_paths[0] ?? null : pc.learning_paths,
    })) as PathCompletion[],
    blog_posts: (blogRes.data || []) as BlogPost[],
    recipes: (recipesRes.data || []) as Recipe[],
    travel,
    teacher,
  };
}
