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

  // Embedding models are on the stable v1 endpoint, not v1beta (which is for generative models)
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

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Preflight: validate API key exists and the Gemini API is reachable
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_GEMINI_API_KEY is not set in environment variables.' },
      { status: 500 },
    );
  }

  // Quick ping to verify the key works before processing all articles
  try {
    await getEmbedding('test');
  } catch (e) {
    return NextResponse.json(
      { error: `Gemini API key check failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  const db = getDb();

  // Clear existing articles before re-ingesting
  await db.from('help_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const results: { title: string; ok: boolean; error?: string }[] = [];

  for (const article of HELP_ARTICLES) {
    const text = `${article.title}\n\n${article.content}`;
    try {
      const embedding = await getEmbedding(text);
      if (!embedding.length) throw new Error('Gemini returned an empty embedding vector.');

      // pgvector expects the array formatted as a bracketed string e.g. "[0.1,0.2,...]"
      const { error } = await db.from('help_articles').insert({
        title: article.title,
        content: article.content,
        role: article.role,
        embedding: `[${embedding.join(',')}]`,
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
