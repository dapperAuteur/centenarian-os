// app/api/academy/courses/[id]/lessons/[lessonId]/discussions/[discussionId]/route.ts
// PATCH: edit own post body, or teacher can pin/unpin
// DELETE: delete own post, or teacher can delete any

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isCourseStaff, lessonInCourse } from '@/lib/academy/access';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string; lessonId: string; discussionId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: courseId, lessonId, discussionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // The lesson must belong to the course in the URL, or a teacher of one course
  // could moderate another course's discussions.
  if (!(await lessonInCourse(db, courseId, lessonId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: post } = await db
    .from('lesson_discussions')
    .select('id, user_id, lesson_id')
    .eq('id', discussionId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: course } = await db.from('courses').select('teacher_id, is_published').eq('id', courseId).maybeSingle();
  const isTeacher = isCourseStaff(course, user, process.env.ADMIN_EMAIL);
  const isAuthor = user.id === post.user_id;

  if (!isAuthor && !isTeacher) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Author can edit body
  if (isAuthor && body.body !== undefined) {
    if (!body.body?.trim()) return NextResponse.json({ error: 'Body cannot be empty' }, { status: 400 });
    updates.body = body.body.trim();
  }

  // Teacher can pin/unpin
  if (isTeacher && body.is_pinned !== undefined) {
    updates.is_pinned = !!body.is_pinned;
  }

  const { data, error } = await db
    .from('lesson_discussions')
    .update(updates)
    .eq('id', discussionId)
    .eq('lesson_id', lessonId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: courseId, lessonId, discussionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // The lesson must belong to the course in the URL, or a teacher of one course
  // could moderate another course's discussions.
  if (!(await lessonInCourse(db, courseId, lessonId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: post } = await db
    .from('lesson_discussions')
    .select('id, user_id, lesson_id')
    .eq('id', discussionId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: course } = await db.from('courses').select('teacher_id, is_published').eq('id', courseId).maybeSingle();
  const isTeacher = isCourseStaff(course, user, process.env.ADMIN_EMAIL);
  const isAuthor = user.id === post.user_id;

  if (!isAuthor && !isTeacher) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await db.from('lesson_discussions').delete().eq('id', discussionId).eq('lesson_id', lessonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
