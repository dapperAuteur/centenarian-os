// app/api/academy/courses/[id]/generate-embeddings/route.ts
// POST: generate Gemini embeddings for all lessons in a CYOA course.
// Only the course's teacher or admin can trigger this.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const EMBEDDING_MODEL = 'text-embedding-004';

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not set');

  // Embedding models are on the stable v1 endpoint, not v1beta
  const url = `https://generativelanguage.googleapis.com/v1/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      task_type: 'SEMANTIC_SIMILARITY',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini embedding error: ${err}`);
  }

  const data = await response.json();
  return data.embedding?.values ?? [];
}

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: course } = await db
    .from('courses')
    .select('teacher_id, navigation_mode')
    .eq('id', courseId)
    .single();

  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (course.navigation_mode !== 'cyoa') {
    return NextResponse.json({ error: 'Course is not in CYOA mode' }, { status: 400 });
  }

  const { data: lessons } = await db
    .from('lessons')
    .select('id, title, text_content')
    .eq('course_id', courseId);

  if (!lessons?.length) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;
  const errors: string[] = [];

  for (const lesson of lessons) {
    const text = [lesson.title, lesson.text_content].filter(Boolean).join('\n\n');
    if (!text.trim()) continue;

    try {
      const embedding = await getEmbedding(text);
      await db
        .from('lesson_embeddings')
        .upsert({ lesson_id: lesson.id, embedding }, { onConflict: 'lesson_id' });
      processed++;
    } catch (e) {
      errors.push(`${lesson.id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  return NextResponse.json({ processed, errors: errors.length > 0 ? errors : undefined });
}
