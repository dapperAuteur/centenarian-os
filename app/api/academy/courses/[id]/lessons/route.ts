// app/api/academy/courses/[id]/lessons/route.ts
// GET: list all lessons for a course (with access gating)
// POST: create a new lesson (teacher only)

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

  const { data: course } = await db
    .from('courses')
    .select('teacher_id, is_published, is_sequential')
    .eq('id', courseId)
    .single();

  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = user?.id === course.teacher_id || user?.email === process.env.ADMIN_EMAIL;

  // Check enrollment
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

  const { data: lessons, error } = await db
    .from('lessons')
    .select('id, title, lesson_type, duration_seconds, order, is_free_preview, module_id, content_url, text_content, quiz_content, audio_chapters, transcript_content, map_content, documents, podcast_links')
    .eq('course_id', courseId)
    .order('order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sequential module locking: determine which lessons are module-locked
  const sequentiallyLocked = new Set<string>();
  if (course.is_sequential && enrolled && user) {
    // Fetch user's completed lessons for this course
    const { data: progress } = await db
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null);
    const completedIds = new Set((progress ?? []).map((p) => p.lesson_id));

    // Get modules sorted by order
    const { data: modules } = await db
      .from('course_modules')
      .select('id, order')
      .eq('course_id', courseId)
      .order('order', { ascending: true });

    if (modules && modules.length > 0) {
      let prevModuleIncomplete = false;
      for (const mod of modules) {
        const moduleLessons = (lessons ?? []).filter((l) => l.module_id === mod.id && !l.is_free_preview);
        if (prevModuleIncomplete) {
          // Lock all non-free lessons in this module
          for (const l of (lessons ?? []).filter((l) => l.module_id === mod.id && !l.is_free_preview)) {
            sequentiallyLocked.add(l.id);
          }
        } else {
          // Check if this module is complete
          const allComplete = moduleLessons.every((l) => completedIds.has(l.id));
          if (!allComplete && moduleLessons.length > 0) {
            prevModuleIncomplete = true;
          }
        }
      }
    }
  }

  // For non-enrolled, non-owner: strip content_url + text_content from gated lessons
  const result = (lessons ?? []).map((lesson) => {
    const isSequentialLocked = sequentiallyLocked.has(lesson.id);
    const canAccess = (isOwner || enrolled || lesson.is_free_preview) && !isSequentialLocked;
    return {
      ...lesson,
      content_url: canAccess ? lesson.content_url : null,
      text_content: canAccess ? lesson.text_content : null,
      quiz_content: canAccess ? lesson.quiz_content : null,
      locked: !canAccess,
      module_locked: isSequentialLocked,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: course } = await db.from('courses').select('teacher_id, price_type').eq('id', courseId).single();
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const isFreeByDefault = body.is_free_preview ?? (course.price_type === 'free');
  const {
    title, lesson_type = 'video', content_url, text_content,
    duration_seconds, order = 0, module_id, quiz_content,
    audio_chapters, transcript_content, map_content, documents, podcast_links,
  } = body;
  const is_free_preview = isFreeByDefault;

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const { data, error } = await db
    .from('lessons')
    .insert({
      course_id: courseId,
      module_id: module_id ?? null,
      title: title.trim(),
      lesson_type,
      content_url: content_url ?? null,
      text_content: text_content ?? null,
      duration_seconds: duration_seconds ?? null,
      order,
      is_free_preview,
      ...(quiz_content ? { quiz_content } : {}),
      ...(audio_chapters ? { audio_chapters } : {}),
      ...(transcript_content ? { transcript_content } : {}),
      ...(map_content ? { map_content } : {}),
      ...(documents ? { documents } : {}),
      ...(podcast_links ? { podcast_links } : {}),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
