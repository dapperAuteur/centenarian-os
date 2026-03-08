// app/api/contractor/union/documents/route.ts
// GET: list user's union documents (+ shared)
// POST: upload a union document (FormData: file + metadata), extract text, chunk, embed

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DOCS_PER_USER = 50;
const CHUNK_SIZE = 1500; // chars per chunk
const CHUNK_OVERLAP = 200;
const EMBEDDING_MODEL = 'gemini-embedding-001';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
]);

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

async function extractPdfText(base64: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY!;
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Extract all text content from this document. Preserve structure with headings, sections, and paragraphs. Return only the extracted text.' },
            { inlineData: { mimeType: 'application/pdf', data: base64 } },
          ],
        }],
      }),
    },
  );
  if (!res.ok) throw new Error('Failed to extract PDF text');
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start = end - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }
  return chunks;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Own docs
  const { data: own, error: ownErr } = await db
    .from('union_documents')
    .select('id, name, union_local, doc_type, is_shared, status, error_msg, page_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (ownErr) return NextResponse.json({ error: ownErr.message }, { status: 500 });

  // Shared docs from others
  const { data: shared } = await db
    .from('union_documents')
    .select('id, name, union_local, doc_type, is_shared, status, page_count, created_at, user_id')
    .eq('is_shared', true)
    .eq('status', 'ready')
    .neq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Get usernames for shared
  const sharedUserIds = [...new Set((shared ?? []).map((d) => d.user_id))];
  const usernameMap: Record<string, string> = {};
  if (sharedUserIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, username')
      .in('id', sharedUserIds);
    for (const p of profiles ?? []) {
      usernameMap[p.id] = p.username ?? 'Anonymous';
    }
  }

  return NextResponse.json({
    documents: own ?? [],
    shared: (shared ?? []).map((d) => ({
      ...d,
      author: usernameMap[d.user_id] ?? 'Anonymous',
    })),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const name = formData.get('name') as string | null;
  const union_local = formData.get('union_local') as string | null;
  const doc_type = formData.get('doc_type') as string | null;
  const is_shared = formData.get('is_shared') === 'true';

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!doc_type) return NextResponse.json({ error: 'doc_type required' }, { status: 400 });

  const validTypes = ['contract', 'bylaws', 'rate_sheet', 'rules', 'other'];
  if (!validTypes.includes(doc_type)) {
    return NextResponse.json({ error: 'Invalid doc_type' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only PDF, TXT, and Markdown files are supported' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
  }

  const db = getDb();

  // Check doc count
  const { count } = await db
    .from('union_documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if ((count ?? 0) >= MAX_DOCS_PER_USER) {
    return NextResponse.json({ error: `Max ${MAX_DOCS_PER_USER} documents reached` }, { status: 400 });
  }

  // Create document record as 'processing'
  const { data: doc, error: insertErr } = await db
    .from('union_documents')
    .insert({
      user_id: user.id,
      name: name.trim(),
      union_local: union_local?.trim() || null,
      doc_type,
      is_shared,
      status: 'processing',
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Process in background-like fashion (still within request, but after response setup)
  try {
    // Extract text
    let fullText: string;
    if (file.type === 'application/pdf') {
      const buffer = Buffer.from(await file.arrayBuffer());
      fullText = await extractPdfText(buffer.toString('base64'));
    } else {
      fullText = await file.text();
    }

    if (!fullText.trim()) {
      await db.from('union_documents').update({ status: 'error', error_msg: 'No text could be extracted' }).eq('id', doc.id);
      return NextResponse.json({ error: 'No text could be extracted from file' }, { status: 400 });
    }

    // Chunk the text
    const chunks = chunkText(fullText);

    // Embed each chunk and insert
    const chunkRows = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      chunkRows.push({
        document_id: doc.id,
        chunk_text: chunks[i],
        chunk_index: i,
        embedding: `[${embedding.join(',')}]`,
      });
    }

    const { error: chunkErr } = await db
      .from('union_document_chunks')
      .insert(chunkRows);

    if (chunkErr) {
      await db.from('union_documents').update({ status: 'error', error_msg: chunkErr.message }).eq('id', doc.id);
      return NextResponse.json({ error: chunkErr.message }, { status: 500 });
    }

    // Mark as ready
    await db.from('union_documents').update({
      status: 'ready',
      page_count: chunks.length,
      updated_at: new Date().toISOString(),
    }).eq('id', doc.id);

    return NextResponse.json({ id: doc.id, status: 'ready', chunks: chunks.length }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Processing failed';
    await db.from('union_documents').update({ status: 'error', error_msg: msg }).eq('id', doc.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
