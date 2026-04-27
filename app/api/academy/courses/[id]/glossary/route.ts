// app/api/academy/courses/[id]/glossary/route.ts
// GET: list glossary terms for a course (optionally filtered by lesson_id)
// POST: create a glossary term (teacher only)

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

export async function GET(req: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const db = getDb();
  const lessonId = req.nextUrl.searchParams.get('lesson_id');

  // Mirror the lesson-detail route's free-preview / free-course access
  // model so this side-fetch doesn't 401 on the same surface the lesson
  // page already permits unauthenticated viewers to see.
  if (!user) {
    const { data: course } = await db
      .from('courses')
      .select('price_type, price')
      .eq('id', courseId)
      .maybeSingle();
    const isFreeCourse = course?.price_type === 'free' || Number(course?.price) === 0;

    let lessonIsFreePreview = false;
    if (lessonId) {
      const { data: lesson } = await db
        .from('lessons')
        .select('is_free_preview')
        .eq('id', lessonId)
        .eq('course_id', courseId)
        .maybeSingle();
      lessonIsFreePreview = !!lesson?.is_free_preview;
    }

    if (!isFreeCourse && !lessonIsFreePreview) {
      return NextResponse.json([]);
    }
  }

  let query = db
    .from('course_glossary_terms')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order')
    .order('term');

  if (lessonId) {
    query = query.eq('lesson_id', lessonId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Check teacher or admin
  const { data: course } = await db
    .from('courses')
    .select('teacher_id')
    .eq('id', courseId)
    .maybeSingle();

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const isAdmin = user.email === process.env.ADMIN_EMAIL;
  if (course.teacher_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { term, phonetic, definition, definition_format, sort_order, lesson_id } = body;

  if (!term?.trim()) {
    return NextResponse.json({ error: 'Term is required' }, { status: 400 });
  }

  const { data, error } = await db
    .from('course_glossary_terms')
    .insert({
      course_id: courseId,
      term: term.trim(),
      phonetic: phonetic?.trim() || null,
      definition: definition || null,
      definition_format: definition_format || 'markdown',
      sort_order: sort_order ?? 0,
      lesson_id: lesson_id || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Term "${term.trim()}" already exists in this course` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
