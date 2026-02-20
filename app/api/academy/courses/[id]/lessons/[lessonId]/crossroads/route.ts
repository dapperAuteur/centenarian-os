// app/api/academy/courses/[id]/lessons/[lessonId]/crossroads/route.ts
// GET: CYOA crossroads options for a lesson.
//   Returns: linear next, 2 semantic neighbors, 1 random, + course map (handled client-side).

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

  // Verify access (enrolled or free preview)
  const { data: lesson } = await db
    .from('lessons')
    .select('id, title, order, course_id')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single();

  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (user) {
    const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
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

  // Get all lessons in the course for random + linear
  const { data: allLessons } = await db
    .from('lessons')
    .select('id, title, order')
    .eq('course_id', courseId)
    .neq('id', lessonId)
    .order('order', { ascending: true });

  const others = allLessons ?? [];
  const options: { lesson_id: string; lesson_title: string; path_type: string; label: string }[] = [];

  // 1. Linear next
  const nextLesson = others.find((l) => l.order > lesson.order);
  if (nextLesson) {
    options.push({ lesson_id: nextLesson.id, lesson_title: nextLesson.title, path_type: 'linear', label: 'Continue Forward' });
  }

  // 2. Semantic neighbors via pgvector
  const { data: embedding } = await db
    .from('lesson_embeddings')
    .select('embedding')
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (embedding?.embedding) {
    const { data: semantic } = await db.rpc('match_lessons', {
      query_embedding: embedding.embedding,
      course_id_filter: courseId,
      exclude_lesson_id: lessonId,
      match_count: 2,
    });

    (semantic ?? []).forEach((s: { id: string; title: string }, i: number) => {
      options.push({
        lesson_id: s.id,
        lesson_title: s.title,
        path_type: 'semantic',
        label: i === 0 ? 'Related Path A' : 'Related Path B',
      });
    });
  }

  // 3. Random lesson (not already in options)
  const usedIds = new Set([lessonId, ...options.map((o) => o.lesson_id)]);
  const available = others.filter((l) => !usedIds.has(l.id));
  if (available.length > 0) {
    const random = available[Math.floor(Math.random() * available.length)];
    options.push({ lesson_id: random.id, lesson_title: random.title, path_type: 'random', label: 'Unexpected Path' });
  }

  return NextResponse.json(options);
}
