// app/api/academy/my-courses/route.ts
// GET: Returns all courses the authenticated user is actively enrolled in,
//      with lesson count + completed lesson count for a progress percentage.

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // 1. Get all active enrollments with course data
  const { data: enrollments, error: enrollErr } = await db
    .from('enrollments')
    .select(`
      course_id,
      enrolled_at,
      courses (
        id, title, description, cover_image_url, category,
        navigation_mode, is_published,
        profiles (username, display_name)
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (enrollErr) return NextResponse.json({ error: enrollErr.message }, { status: 500 });
  if (!enrollments?.length) return NextResponse.json([]);

  const courseIds = enrollments.map((e) => e.course_id);

  // 2. Get total lesson counts per course
  const { data: lessons } = await db
    .from('lessons')
    .select('id, course_id')
    .in('course_id', courseIds);

  // 3. Get completed lessons for this user across those courses
  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: progress } = await db
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', user.id)
    .in('lesson_id', lessonIds)
    .not('completed_at', 'is', null);

  const completedSet = new Set((progress ?? []).map((p) => p.lesson_id));

  // 4. Build per-course totals
  const totalByCourse: Record<string, number> = {};
  const completedByLesson: Record<string, Set<string>> = {};
  for (const lesson of lessons ?? []) {
    totalByCourse[lesson.course_id] = (totalByCourse[lesson.course_id] ?? 0) + 1;
    if (completedSet.has(lesson.id)) {
      if (!completedByLesson[lesson.course_id]) completedByLesson[lesson.course_id] = new Set();
      completedByLesson[lesson.course_id].add(lesson.id);
    }
  }

  const result = enrollments.map((e) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const course = e.courses as any;
    const total = totalByCourse[e.course_id] ?? 0;
    const completed = completedByLesson[e.course_id]?.size ?? 0;
    return {
      ...course,
      enrolled_at: e.enrolled_at,
      lesson_count: total,
      completed_count: completed,
      progress_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  return NextResponse.json(result);
}
