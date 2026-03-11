// app/api/academy/courses/[id]/lessons/[lessonId]/route.ts
// GET: single lesson (with access gating)
// PATCH: update lesson (teacher only)
// DELETE: delete lesson (teacher only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string; lessonId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: courseId, lessonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = getDb();

  const { data: lesson, error } = await db
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single();

  if (error || !lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: course } = await db.from('courses').select('teacher_id, is_sequential, price_type, price').eq('id', courseId).single();
  const isOwner = user?.id === course?.teacher_id || user?.email === process.env.ADMIN_EMAIL;
  const isFreeCourse = course?.price_type === 'free' || Number(course?.price) === 0;

  let enrolled = false;
  if (user && !isOwner) {
    const { data } = await db
      .from('enrollments')
      .select('status')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();
    enrolled = data?.status === 'active';
  }

  const canAccess = isOwner || enrolled || lesson.is_free_preview || isFreeCourse;
  if (!canAccess) {
    if (!user) {
      return NextResponse.json({ error: 'Login required to access this lesson', locked: true, login_required: true }, { status: 403 });
    }
    return NextResponse.json({ error: 'Enroll to access this lesson', locked: true }, { status: 403 });
  }

  // Sequential module locking check
  if (course?.is_sequential && enrolled && user && !isOwner && !lesson.is_free_preview && lesson.module_id) {
    const { data: modules } = await db
      .from('course_modules')
      .select('id, order')
      .eq('course_id', courseId)
      .order('order', { ascending: true });

    const lessonModule = modules?.find((m) => m.id === lesson.module_id);
    if (lessonModule && modules) {
      const priorModules = modules.filter((m) => m.order < lessonModule.order);
      if (priorModules.length > 0) {
        // Get all non-free lessons in prior modules
        const { data: priorLessons } = await db
          .from('lessons')
          .select('id, is_free_preview, module_id')
          .eq('course_id', courseId)
          .in('module_id', priorModules.map((m) => m.id));
        const requiredIds = (priorLessons ?? []).filter((l) => !l.is_free_preview).map((l) => l.id);

        if (requiredIds.length > 0) {
          const { data: progress } = await db
            .from('lesson_progress')
            .select('lesson_id')
            .eq('user_id', user.id)
            .in('lesson_id', requiredIds)
            .not('completed_at', 'is', null);
          const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));
          const allPriorComplete = requiredIds.every((id) => completedIds.has(id));
          if (!allPriorComplete) {
            return NextResponse.json({ error: 'Complete previous modules first', locked: true, module_locked: true }, { status: 403 });
          }
        }
      }
    }
  }

  return NextResponse.json(lesson);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: courseId, lessonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  if (!course || (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const allowed = ['title', 'lesson_type', 'content_url', 'text_content', 'content_format', 'duration_seconds', 'order', 'is_free_preview', 'module_id', 'quiz_content', 'audio_chapters', 'transcript_content', 'map_content', 'documents', 'podcast_links'];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const { data, error } = await db
    .from('lessons')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: courseId, lessonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  if (!course || (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await db.from('lessons').delete().eq('id', lessonId).eq('course_id', courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
