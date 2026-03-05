// lib/admin/syncKnowledge.ts
// Shared logic for syncing help articles, course embeddings, and context timestamp.
// Called by: daily cron (/api/admin/demo/reset) and on-demand (/api/admin/knowledge/refresh).

import { createClient } from '@supabase/supabase-js';
import { HELP_ARTICLES } from '@/lib/help/articles';

const EMBEDDING_MODEL = 'gemini-embedding-001';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini embedding error: ${err}`);
  }

  const data = await response.json();
  return data.embedding?.values ?? [];
}

export interface SyncResult {
  helpArticles: { succeeded: number; failed: number };
  courses: { processed: number; errors: number };
  timestamp: string;
}

/** Re-embed all help articles into help_articles table. */
export async function syncHelpArticles(): Promise<{ succeeded: number; failed: number }> {
  const db = getDb();

  // Clear existing
  await db.from('help_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  let succeeded = 0;
  let failed = 0;

  for (const article of HELP_ARTICLES) {
    const text = `${article.title}\n\n${article.content}`;
    try {
      const embedding = await getEmbedding(text);
      if (!embedding.length) throw new Error('Empty embedding');

      const { error } = await db.from('help_articles').insert({
        title: article.title,
        content: article.content,
        role: article.role,
        embedding: `[${embedding.join(',')}]`,
      });
      if (error) throw new Error(error.message);
      succeeded++;
    } catch {
      failed++;
    }
  }

  return { succeeded, failed };
}

/** Regenerate embeddings for all published CYOA courses. */
export async function syncCourseEmbeddings(): Promise<{ processed: number; errors: number }> {
  const db = getDb();

  // Get all published CYOA courses
  const { data: courses } = await db
    .from('courses')
    .select('id')
    .eq('is_published', true)
    .eq('navigation_mode', 'cyoa');

  if (!courses?.length) return { processed: 0, errors: 0 };

  let processed = 0;
  let errors = 0;

  for (const course of courses) {
    const { data: lessons } = await db
      .from('lessons')
      .select('id, title, text_content')
      .eq('course_id', course.id);

    if (!lessons?.length) continue;

    for (const lesson of lessons) {
      const text = [lesson.title, lesson.text_content].filter(Boolean).join('\n\n');
      if (!text.trim()) continue;

      try {
        const embedding = await getEmbedding(text);
        await db
          .from('lesson_embeddings')
          .upsert({ lesson_id: lesson.id, embedding: `[${embedding.join(',')}]` }, { onConflict: 'lesson_id' });
        processed++;
      } catch {
        errors++;
      }
    }
  }

  return { processed, errors };
}

/** Update the knowledge sync timestamp in platform_settings. */
export async function updateContextTimestamp(): Promise<string> {
  const db = getDb();
  const now = new Date().toISOString();

  await db
    .from('platform_settings')
    .upsert({ key: 'knowledge_last_synced_at', value: now }, { onConflict: 'key' });

  return now;
}

/** Run all sync tasks. Returns combined results. */
export async function syncAllKnowledge(): Promise<SyncResult> {
  const [helpResult, courseResult] = await Promise.allSettled([
    syncHelpArticles(),
    syncCourseEmbeddings(),
  ]);

  const helpArticles = helpResult.status === 'fulfilled'
    ? helpResult.value
    : { succeeded: 0, failed: HELP_ARTICLES.length };

  const courses = courseResult.status === 'fulfilled'
    ? courseResult.value
    : { processed: 0, errors: -1 };

  const timestamp = await updateContextTimestamp();

  return { helpArticles, courses, timestamp };
}
