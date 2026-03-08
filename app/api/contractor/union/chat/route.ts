// app/api/contractor/union/chat/route.ts
// POST: RAG-powered union contract chat
//   1. Embed user question
//   2. Find top-5 matching chunks via pgvector cosine similarity
//   3. Build context-grounded prompt with MANDATORY disclaimer
//   4. Return answer + sources + disclaimer

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const EMBEDDING_MODEL = 'gemini-embedding-001';
const CHAT_MODEL = 'gemini-2.5-flash';

const DISCLAIMER = 'This is an AI-generated summary for reference only. It is not legal advice. Always consult your union representative or the official contract document for authoritative answers.';

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: question }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.2 },
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

  const { question, union_local } = await request.json();
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

  // 2. Retrieve top-5 matching chunks
  const { data: matches, error: matchError } = await db.rpc('match_union_chunks', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_count: 5,
    union_filter: union_local || null,
    p_user_id: user.id,
  });

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({
      answer: 'I could not find any relevant information in your uploaded union documents. Please upload the relevant contract or document first.',
      sources: [],
      disclaimer: DISCLAIMER,
    });
  }

  const context = matches
    .map((m: { doc_name: string; chunk_index: number; chunk_text: string }) =>
      `[Source: ${m.doc_name}, Section ${m.chunk_index + 1}]\n${m.chunk_text}`,
    )
    .join('\n\n---\n\n');

  // 3. Build system prompt
  const systemPrompt = `You are a knowledgeable assistant that helps union contractors understand their contracts, bylaws, and work rules.

Answer the user's question using ONLY the contract/document excerpts provided below. Be specific, cite the source document name when possible, and quote relevant passages. If the context does not contain enough information, say so clearly.

IMPORTANT: You MUST end every response with the following disclaimer on its own line:
"${DISCLAIMER}"

--- CONTRACT EXCERPTS ---
${context}
--- END EXCERPTS ---`;

  // 4. Generate the answer
  let answer: string;
  try {
    answer = await generateAnswer(systemPrompt, question.trim());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Generation failed' }, { status: 500 });
  }

  // Ensure disclaimer is present
  if (!answer.includes('not legal advice')) {
    answer += `\n\n${DISCLAIMER}`;
  }

  const sources = matches.map((m: { doc_name: string; union_local: string; chunk_index: number; similarity: number }) => ({
    document: m.doc_name,
    union_local: m.union_local,
    section: m.chunk_index + 1,
    similarity: Math.round(m.similarity * 100) / 100,
  }));

  return NextResponse.json({ answer, sources, disclaimer: DISCLAIMER });
}
