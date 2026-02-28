// app/api/academy/courses/[id]/lessons/[lessonId]/discussions/route.ts
// GET: list threaded discussions for a lesson (pinned first, then by date)
// POST: create a new discussion post (requires enrollment or teacher)

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

  // Verify lesson exists in this course
  const { data: lesson } = await db
    .from('lessons')
    .select('id')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single();
  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check access: enrolled or teacher or admin
  let canAccess = false;
  if (user) {
    const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
    const isOwner = user.id === course?.teacher_id || user.email === process.env.ADMIN_EMAIL;
    if (isOwner) {
      canAccess = true;
    } else {
      const { data: enrollment } = await db
        .from('enrollments')
        .select('status')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();
      canAccess = enrollment?.status === 'active';
    }
  }
  if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch all discussion posts for this lesson with author info
  const { data: posts, error } = await db
    .from('lesson_discussions')
    .select('id, lesson_id, user_id, parent_id, body, is_pinned, is_teacher, created_at, updated_at')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch author profiles for all unique user_ids
  const userIds = [...new Set((posts ?? []).map((p) => p.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await db.from('profiles').select('id, display_name, avatar_url').in('id', userIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Build threaded structure: top-level posts with nested replies
  const enriched = (posts ?? []).map((p) => ({
    ...p,
    author: profileMap.get(p.user_id) ?? { display_name: 'Unknown', avatar_url: null },
  }));

  const topLevel = enriched.filter((p) => !p.parent_id);
  const replies = enriched.filter((p) => p.parent_id);

  const threaded = topLevel.map((post) => ({
    ...post,
    replies: replies.filter((r) => r.parent_id === post.id),
  }));

  // Sort: pinned first, then by created_at
  threaded.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return NextResponse.json(threaded);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId, lessonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify lesson exists
  const { data: lesson } = await db
    .from('lessons')
    .select('id')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single();
  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check access: enrolled or teacher or admin
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  const isTeacher = user.id === course?.teacher_id || user.email === process.env.ADMIN_EMAIL;
  if (!isTeacher) {
    const { data: enrollment } = await db
      .from('enrollments')
      .select('status')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();
    if (enrollment?.status !== 'active') {
      return NextResponse.json({ error: 'Enroll to participate in discussions' }, { status: 403 });
    }
  }

  const body = await request.json();
  if (!body.body?.trim()) return NextResponse.json({ error: 'Body is required' }, { status: 400 });

  // If parent_id provided, verify it exists in same lesson
  if (body.parent_id) {
    const { data: parent } = await db
      .from('lesson_discussions')
      .select('id')
      .eq('id', body.parent_id)
      .eq('lesson_id', lessonId)
      .single();
    if (!parent) return NextResponse.json({ error: 'Parent post not found' }, { status: 404 });
  }

  const { data, error } = await db
    .from('lesson_discussions')
    .insert({
      lesson_id: lessonId,
      user_id: user.id,
      parent_id: body.parent_id || null,
      body: body.body.trim(),
      is_teacher: isTeacher,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach author info
  const { data: profile } = await db.from('profiles').select('display_name, avatar_url').eq('id', user.id).single();

  return NextResponse.json({
    ...data,
    author: profile ?? { display_name: 'Unknown', avatar_url: null },
    replies: [],
  }, { status: 201 });
}
