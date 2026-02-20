// app/api/admin/help/ingest/route.ts
// POST: embed all help articles and upsert into help_articles table.
// Admin-only. Uses Gemini text-embedding-004 (768-dim).

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { HELP_ARTICLES } from '@/lib/help/articles';

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
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

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();

  // Clear existing articles before re-ingesting
  await db.from('help_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const results: { title: string; ok: boolean; error?: string }[] = [];

  for (const article of HELP_ARTICLES) {
    const text = `${article.title}\n\n${article.content}`;
    try {
      const embedding = await getEmbedding(text);
      const { error } = await db.from('help_articles').insert({
        title: article.title,
        content: article.content,
        role: article.role,
        embedding,
      });
      if (error) throw new Error(error.message);
      results.push({ title: article.title, ok: true });
    } catch (e) {
      results.push({ title: article.title, ok: false, error: e instanceof Error ? e.message : 'Unknown' });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({ succeeded, failed: failed.length > 0 ? failed : undefined });
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const { count } = await db
    .from('help_articles')
    .select('id', { count: 'exact', head: true });

  return NextResponse.json({ count: count ?? 0, total: HELP_ARTICLES.length });
}
