// app/api/admin/union-submissions/[id]/route.ts
// PATCH: approve/reject a union RAG submission (admin only)
// Approve triggers: download file → extract text → chunk → embed → create union_document as shared

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;
const EMBEDDING_MODEL = 'gemini-embedding-001';

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { action, admin_notes } = body as { action: string; admin_notes?: string };

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  const db = getDb();

  // Get submission
  const { data: sub, error: subErr } = await db
    .from('union_rag_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (subErr || !sub) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  if (sub.status !== 'pending') {
    return NextResponse.json({ error: `Submission already ${sub.status}` }, { status: 400 });
  }

  // Reject
  if (action === 'reject') {
    await db.from('union_rag_submissions').update({
      status: 'rejected',
      admin_notes: admin_notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    return NextResponse.json({ status: 'rejected' });
  }

  // Approve — mark as processing, then process the file
  await db.from('union_rag_submissions').update({
    status: 'processing',
    admin_notes: admin_notes || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  try {
    // Download file from Cloudinary URL
    const fileRes = await fetch(sub.file_url);
    if (!fileRes.ok) throw new Error('Failed to download file');

    const contentType = fileRes.headers.get('content-type') || '';
    let fullText: string;

    if (contentType.includes('pdf') || sub.file_name.endsWith('.pdf')) {
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      fullText = await extractPdfText(buffer.toString('base64'));
    } else {
      fullText = await fileRes.text();
    }

    if (!fullText.trim()) {
      await db.from('union_rag_submissions').update({
        status: 'rejected',
        admin_notes: (admin_notes || '') + '\n[Auto] No text could be extracted from file.',
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      return NextResponse.json({ error: 'No text extracted' }, { status: 400 });
    }

    // Create union_document as shared community doc
    const docName = sub.file_name.replace(/\.[^.]+$/, '');
    const { data: doc, error: docErr } = await db
      .from('union_documents')
      .insert({
        user_id: sub.user_id,
        name: sub.description ? `${docName} — ${sub.description}` : docName,
        union_local: sub.union_local,
        doc_type: sub.doc_type,
        doc_url: sub.file_url,
        is_shared: true,
        status: 'processing',
      })
      .select()
      .single();

    if (docErr) throw new Error(docErr.message);

    // Chunk and embed
    const chunks = chunkText(fullText);
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

    if (chunkErr) throw new Error(chunkErr.message);

    // Mark document as ready
    await db.from('union_documents').update({
      status: 'ready',
      page_count: chunks.length,
      updated_at: new Date().toISOString(),
    }).eq('id', doc.id);

    // Mark submission as live
    await db.from('union_rag_submissions').update({
      status: 'live',
      document_id: doc.id,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    return NextResponse.json({ status: 'live', document_id: doc.id, chunks: chunks.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Processing failed';
    await db.from('union_rag_submissions').update({
      status: 'pending',
      admin_notes: (admin_notes || '') + `\n[Error] ${msg}`,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
