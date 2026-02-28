// app/api/coach/documents/route.ts
// GET: list documents for a gem   — ?gem_persona_id=xxx
// POST: upload a file to a gem's knowledge base (FormData: gem_persona_id + file)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10 MB raw file
const MAX_TEXT_SIZE = 200_000; // 200 KB stored text limit per document
const MAX_DOCS_PER_GEM = 20;

const ALLOWED_TYPES = new Set([
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/json',
]);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const gemId = request.nextUrl.searchParams.get('gem_persona_id');
  if (!gemId) return NextResponse.json({ error: 'gem_persona_id required' }, { status: 400 });

  const db = getDb();
  const { data, error } = await db
    .from('gem_documents')
    .select('id, name, mime_type, size_bytes, created_at')
    .eq('user_id', user.id)
    .eq('gem_persona_id', gemId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const gemId = formData.get('gem_persona_id') as string | null;
  const file = formData.get('file') as File | null;

  if (!gemId) return NextResponse.json({ error: 'gem_persona_id required' }, { status: 400 });
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

  // Validate file type
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Allowed: CSV, TXT, Markdown, PDF, JSON` },
      { status: 400 },
    );
  }

  if (file.size > MAX_DOC_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
  }

  const db = getDb();

  // Verify gem ownership
  const { data: gem } = await db
    .from('gem_personas')
    .select('id')
    .eq('id', gemId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!gem) return NextResponse.json({ error: 'Gem not found' }, { status: 404 });

  // Check document count limit
  const { count } = await db
    .from('gem_documents')
    .select('id', { count: 'exact', head: true })
    .eq('gem_persona_id', gemId);

  if ((count ?? 0) >= MAX_DOCS_PER_GEM) {
    return NextResponse.json(
      { error: `Maximum ${MAX_DOCS_PER_GEM} documents per gem reached` },
      { status: 400 },
    );
  }

  // Extract text content
  let textContent: string;

  if (file.type === 'application/pdf') {
    // For PDFs, extract text via Gemini
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Extract all text content from this PDF document. Return only the extracted text, preserving structure with headings and paragraphs. Do not add commentary.' },
              { inlineData: { mimeType: 'application/pdf', data: base64 } },
            ],
          }],
        }),
      },
    );

    if (!geminiRes.ok) {
      return NextResponse.json({ error: 'Failed to extract text from PDF' }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } else {
    textContent = await file.text();
  }

  // Truncate if too large
  if (textContent.length > MAX_TEXT_SIZE) {
    textContent = textContent.slice(0, MAX_TEXT_SIZE) + '\n\n[Document truncated — exceeded 200KB text limit]';
  }

  const { data: doc, error } = await db
    .from('gem_documents')
    .insert({
      user_id: user.id,
      gem_persona_id: gemId,
      name: file.name,
      content: textContent,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select('id, name, mime_type, size_bytes, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(doc, { status: 201 });
}
