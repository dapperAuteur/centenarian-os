// app/api/academy/courses/[id]/assignments/route.ts
// GET: list assignments for a course (enrolled students + teacher)
// POST: create assignment (teacher only)

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

  const db = getDb();
  const url = new URL(_req.url);
  const scopeFilter = url.searchParams.get('scope');
  const moduleIdFilter = url.searchParams.get('module_id');
  const lessonIdFilter = url.searchParams.get('lesson_id');

  const { data: course } = await db
    .from('courses')
    .select('teacher_id, price_type, price')
    .eq('id', courseId)
    .maybeSingle();

  // Match the lesson-detail route's free-preview / free-course access
  // model. Unauth viewers on a free-preview lesson or free course get an
  // empty list (200) rather than a noisy 401 in the lesson side panel.
  if (!user) {
    const isFreeCourse = course?.price_type === 'free' || Number(course?.price) === 0;

    let lessonIsFreePreview = false;
    if (lessonIdFilter) {
      const { data: lesson } = await db
        .from('lessons')
        .select('is_free_preview')
        .eq('id', lessonIdFilter)
        .eq('course_id', courseId)
        .maybeSingle();
      lessonIsFreePreview = !!lesson?.is_free_preview;
    }

    if (!isFreeCourse && !lessonIsFreePreview) {
      return NextResponse.json([]);
    }
  } else {
    const isOwner = user.id === course?.teacher_id || user.email === process.env.ADMIN_EMAIL;
    if (!isOwner) {
      const { data: enrollment } = await db
        .from('enrollments')
        .select('status')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();
      if (enrollment?.status !== 'active') {
        return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
      }
    }
  }

  let query = db
    .from('assignments')
    .select('id, title, description, due_date, lesson_id, module_id, scope, requires_metrics, created_at')
    .eq('course_id', courseId)
    .order('created_at', { ascending: true });

  if (scopeFilter) query = query.eq('scope', scopeFilter);
  if (moduleIdFilter) query = query.eq('module_id', moduleIdFilter);
  if (lessonIdFilter) query = query.eq('lesson_id', lessonIdFilter);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  if (!course || (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { title, description, due_date, lesson_id, module_id, scope = 'course', requires_metrics } = await request.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  if (!['course', 'module', 'lesson'].includes(scope)) {
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
  }

  // Optional metric-prefill config. Shape: { metrics: string[], days: number }.
  let requiresMetrics: { metrics: string[]; days: number } | null = null;
  if (requires_metrics != null) {
    const m = requires_metrics as { metrics?: unknown; days?: unknown };
    const metrics = Array.isArray(m.metrics) ? m.metrics.filter((x): x is string => typeof x === 'string') : [];
    const days = [7, 30, 90].includes(Number(m.days)) ? Number(m.days) : 7;
    if (metrics.length > 0) requiresMetrics = { metrics, days };
  }

  if (scope === 'module') {
    if (!module_id) return NextResponse.json({ error: 'module_id required for module scope' }, { status: 400 });
    const { data: mod } = await db.from('course_modules').select('id').eq('id', module_id).eq('course_id', courseId).maybeSingle();
    if (!mod) return NextResponse.json({ error: 'Module not found in this course' }, { status: 400 });
  }

  if (scope === 'lesson') {
    if (!lesson_id) return NextResponse.json({ error: 'lesson_id required for lesson scope' }, { status: 400 });
    const { data: les } = await db.from('lessons').select('id').eq('id', lesson_id).eq('course_id', courseId).maybeSingle();
    if (!les) return NextResponse.json({ error: 'Lesson not found in this course' }, { status: 400 });
  }

  const { data, error } = await db
    .from('assignments')
    .insert({
      course_id: courseId,
      title: title.trim(),
      description: description ?? null,
      due_date: due_date ?? null,
      scope,
      module_id: scope === 'module' ? module_id : null,
      lesson_id: scope === 'lesson' ? lesson_id : null,
      requires_metrics: requiresMetrics,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
