// app/api/help/chat/route.ts
// POST: RAG-powered help chat.
//   1. Embed the user's question via Gemini text-embedding-004
//   2. Find top-5 matching help_articles via pgvector cosine similarity
//   3. Build a context-grounded prompt and call Gemini Flash
//   4. Return the answer

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// gemini-embedding-001 outputs 3072 dims by default; pin to 768 to match schema
const EMBEDDING_MODEL = 'gemini-embedding-001';
const CHAT_MODEL = 'gemini-2.5-flash';

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });
  if (!res.ok) throw new Error(`Embedding error: ${await res.text()}`);
  const data = await res.json();
  return data.embedding?.values ?? [];
}

async function generateAnswer(systemPrompt: string, question: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: question }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'I could not generate a response.';
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { question, role } = await request.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  const db = getDb();

  // 1. Embed the question
  let queryEmbedding: number[];
  try {
    queryEmbedding = await getEmbedding(question.trim());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Embedding failed' }, { status: 500 });
  }

  // 2. Retrieve top-5 matching articles
  // pgvector expects the vector as a bracketed string "[0.1,0.2,...]"
  const { data: matches, error: matchError } = await db.rpc('match_help_articles', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_count: 5,
    role_filter: role ?? null,
  });

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  const context = (matches ?? [])
    .map((m: { title: string; content: string }) => `## ${m.title}\n${m.content}`)
    .join('\n\n---\n\n');

  // 3. Build system prompt
  const systemPrompt = `You are a helpful assistant for Centenarian Academy, a learning platform inside CentenarianOS focused on longevity and healthy living.

Answer the user's question using ONLY the documentation context provided below. Be concise, friendly, and specific. If the answer involves a page path (like /academy/my-courses), include it. If the context does not contain enough information to answer the question, say so honestly and suggest they contact support.

--- DOCUMENTATION CONTEXT ---
${context}
--- END CONTEXT ---`;

  // 4. Generate the answer
  let answer: string;
  try {
    answer = await generateAnswer(systemPrompt, question.trim());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Generation failed' }, { status: 500 });
  }

  return NextResponse.json({ answer });
}
