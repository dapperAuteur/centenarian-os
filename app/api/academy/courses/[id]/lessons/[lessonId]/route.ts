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

  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  const isOwner = user?.id === course?.teacher_id || user?.email === process.env.ADMIN_EMAIL;

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

  const canAccess = isOwner || enrolled || lesson.is_free_preview;
  if (!canAccess) {
    return NextResponse.json({ error: 'Enroll to access this lesson', locked: true }, { status: 403 });
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
  const allowed = ['title', 'lesson_type', 'content_url', 'text_content', 'duration_seconds', 'order', 'is_free_preview', 'module_id'];
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
