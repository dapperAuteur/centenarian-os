// app/api/academy/courses/[id]/cohort/route.ts
//
// GET — cohort heatmap data for one course. Returns the shape needed
// to render students × lessons as a grid, plus summary stats.
//
// Access: teacher who owns the course, or admin.
//
// Performance: current implementation is a single round trip for each
// of enrollments / lessons / progress / profiles. Acceptable up to
// ~200 students per course; scale later if needed with a view or RPC.
//
// Plan 36.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // 1. Verify teacher ownership (or admin bypass).
  const { data: course } = await db
    .from('courses')
    .select('teacher_id, title')
    .eq('id', courseId)
    .maybeSingle();
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Enrollments + lessons + progress in parallel.
  const [enrollmentsRes, lessonsRes] = await Promise.all([
    db
      .from('enrollments')
      .select('user_id, enrolled_at, status, attempt_number, last_content_seen_at')
      .eq('course_id', courseId)
      .order('enrolled_at', { ascending: true }),
    db
      .from('lessons')
      .select('id, title, order, lesson_type')
      .eq('course_id', courseId)
      .order('order', { ascending: true }),
  ]);

  if (enrollmentsRes.error) return NextResponse.json({ error: enrollmentsRes.error.message }, { status: 500 });
  if (lessonsRes.error) return NextResponse.json({ error: lessonsRes.error.message }, { status: 500 });

  const enrollments = enrollmentsRes.data ?? [];
  const lessons = lessonsRes.data ?? [];

  if (enrollments.length === 0) {
    return NextResponse.json({
      course: { id: courseId, title: course.title ?? null },
      students: [],
      lessons,
      progress: [],
      summary: {
        enrolled_count: 0,
        active_count: 0,
        avg_completion_pct: 0,
        median_time_to_complete_days: null,
        most_stuck_lesson_id: null,
      },
    });
  }

  const userIds = enrollments.map((e) => e.user_id);
  const lessonIds = lessons.map((l) => l.id);

  // 3. Fetch progress rows + student display info together.
  const [progressRes, profilesRes] = await Promise.all([
    lessonIds.length > 0
      ? db
          .from('lesson_progress')
          .select('user_id, lesson_id, completed_at, quiz_score, watch_seconds')
          .in('user_id', userIds)
          .in('lesson_id', lessonIds)
      : Promise.resolve({ data: [], error: null }),
    db
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds),
  ]);

  if (progressRes.error) return NextResponse.json({ error: progressRes.error.message }, { status: 500 });
  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  // Build the students array preserving enrollment order.
  const students = enrollments.map((e) => {
    const p = profileMap.get(e.user_id);
    return {
      user_id: e.user_id,
      display_name: p?.display_name ?? p?.username ?? 'Anonymous',
      username: p?.username ?? null,
      enrolled_at: e.enrolled_at,
      status: e.status as 'active' | 'cancelled',
      attempt_number: (e as { attempt_number?: number }).attempt_number ?? 1,
      last_content_seen_at: (e as { last_content_seen_at?: string | null }).last_content_seen_at ?? null,
    };
  });

  // 4. Build progress rows with derived `state`. "in_progress" means
  //    the student has lesson_progress but completed_at is null —
  //    approximates "they've started watching/reading." "not_started"
  //    means no row at all.
  const progressMap = new Map<string, {
    user_id: string;
    lesson_id: string;
    state: 'not_started' | 'in_progress' | 'completed';
    completed_at: string | null;
    quiz_score: number | null;
  }>();

  for (const row of progressRes.data ?? []) {
    const key = `${row.user_id}::${row.lesson_id}`;
    progressMap.set(key, {
      user_id: row.user_id,
      lesson_id: row.lesson_id,
      state: row.completed_at ? 'completed' : 'in_progress',
      completed_at: row.completed_at ?? null,
      quiz_score: (row as { quiz_score?: number | null }).quiz_score ?? null,
    });
  }

  // Emit a full grid (student × lesson). Keeps the client renderer
  // simple — no missing-cell handling — and adds ≤ 200×20 = 4,000 rows
  // which is cheap.
  const progress: Array<{
    user_id: string;
    lesson_id: string;
    state: 'not_started' | 'in_progress' | 'completed';
    completed_at: string | null;
    quiz_score: number | null;
  }> = [];
  for (const student of students) {
    for (const lesson of lessons) {
      const key = `${student.user_id}::${lesson.id}`;
      progress.push(progressMap.get(key) ?? {
        user_id: student.user_id,
        lesson_id: lesson.id,
        state: 'not_started',
        completed_at: null,
        quiz_score: null,
      });
    }
  }

  // 5. Summary stats.
  const activeCount = students.filter((s) => s.status === 'active').length;
  const completedPerStudent: number[] = students.map((s) => {
    let n = 0;
    for (const lesson of lessons) {
      if (progressMap.get(`${s.user_id}::${lesson.id}`)?.state === 'completed') n++;
    }
    return n;
  });
  const avgCompletionPct = students.length > 0 && lessons.length > 0
    ? Math.round((completedPerStudent.reduce((a, b) => a + b, 0) / (students.length * lessons.length)) * 100)
    : 0;

  // Time-to-complete = days between enrolled_at and the student's last
  // completed lesson, for students who finished every lesson. Median.
  const timesToComplete: number[] = [];
  for (let i = 0; i < students.length; i++) {
    if (completedPerStudent[i] !== lessons.length || lessons.length === 0) continue;
    const enrolled = new Date(students[i].enrolled_at).getTime();
    let last = enrolled;
    for (const lesson of lessons) {
      const p = progressMap.get(`${students[i].user_id}::${lesson.id}`);
      if (p?.completed_at) {
        const t = new Date(p.completed_at).getTime();
        if (t > last) last = t;
      }
    }
    const days = Math.max(0, Math.round((last - enrolled) / (1000 * 60 * 60 * 24)));
    timesToComplete.push(days);
  }
  let medianDays: number | null = null;
  if (timesToComplete.length > 0) {
    timesToComplete.sort((a, b) => a - b);
    const mid = Math.floor(timesToComplete.length / 2);
    medianDays = timesToComplete.length % 2 === 1
      ? timesToComplete[mid]
      : Math.round((timesToComplete[mid - 1] + timesToComplete[mid]) / 2);
  }

  // Most-stuck lesson: the lesson where the fewest students have
  // `completed` state. Ties broken by earliest order.
  let mostStuckLessonId: string | null = null;
  if (lessons.length > 0 && students.length > 0) {
    let minCompletions = Infinity;
    for (const lesson of lessons) {
      let c = 0;
      for (const student of students) {
        if (progressMap.get(`${student.user_id}::${lesson.id}`)?.state === 'completed') c++;
      }
      if (c < minCompletions) {
        minCompletions = c;
        mostStuckLessonId = lesson.id;
      }
    }
  }

  return NextResponse.json({
    course: { id: courseId, title: course.title ?? null },
    students,
    lessons,
    progress,
    summary: {
      enrolled_count: students.length,
      active_count: activeCount,
      avg_completion_pct: avgCompletionPct,
      median_time_to_complete_days: medianDays,
      most_stuck_lesson_id: mostStuckLessonId,
    },
  });
}
