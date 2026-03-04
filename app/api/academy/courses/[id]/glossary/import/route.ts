// app/api/academy/courses/[id]/glossary/import/route.ts
// POST: bulk import glossary terms from CSV rows (teacher only, upsert by term)

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

  const { rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }

  // Build lesson title → id map for resolving lesson_title column
  const { data: lessons } = await db
    .from('lessons')
    .select('id, title')
    .eq('course_id', courseId);

  const lessonMap = new Map<string, string>();
  for (const l of lessons ?? []) {
    lessonMap.set(l.title.toLowerCase().trim(), l.id);
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < Math.min(rows.length, 500); i++) {
    const row = rows[i];
    const term = row.term?.trim();
    if (!term) {
      skipped++;
      continue;
    }

    const phonetic = row.phonetic?.trim() || null;
    const definition = row.definition?.trim() || null;
    const definitionFormat = row.definition_format?.trim() || 'markdown';
    const lessonTitle = row.lesson_title?.trim();

    let lessonId: string | null = null;
    if (lessonTitle) {
      lessonId = lessonMap.get(lessonTitle.toLowerCase()) ?? null;
      if (!lessonId) {
        errors.push(`Row ${i + 1}: lesson "${lessonTitle}" not found, term added as course-wide`);
      }
    }

    const { error } = await db
      .from('course_glossary_terms')
      .upsert(
        {
          course_id: courseId,
          term,
          phonetic,
          definition,
          definition_format: definitionFormat === 'tiptap' ? 'tiptap' : 'markdown',
          lesson_id: lessonId,
          sort_order: i,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'course_id,term' },
      );

    if (error) {
      errors.push(`Row ${i + 1} ("${term}"): ${error.message}`);
    } else {
      imported++;
    }
  }

  return NextResponse.json({ imported, skipped, errors });
}
