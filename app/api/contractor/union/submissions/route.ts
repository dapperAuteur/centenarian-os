// app/api/contractor/union/submissions/route.ts
// GET: list user's own submissions
// POST: create a new submission (FormData: file + metadata) → uploads to Cloudinary

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

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('union_rag_submissions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const union_local = formData.get('union_local') as string | null;
  const doc_type = formData.get('doc_type') as string | null;
  const description = formData.get('description') as string | null;
  const coverage_dates = formData.get('coverage_dates') as string | null;

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (!doc_type) return NextResponse.json({ error: 'doc_type required' }, { status: 400 });

  const validTypes = ['contract', 'bylaws', 'rate_sheet', 'rules', 'other'];
  if (!validTypes.includes(doc_type)) {
    return NextResponse.json({ error: 'Invalid doc_type' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
  }

  // Upload to Cloudinary
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
  }

  const uploadForm = new FormData();
  uploadForm.append('file', file);
  uploadForm.append('upload_preset', uploadPreset);
  uploadForm.append('folder', 'union-submissions');
  uploadForm.append('resource_type', 'raw');

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
    { method: 'POST', body: uploadForm },
  );

  if (!uploadRes.ok) {
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  }

  const uploadData = await uploadRes.json();

  const db = getDb();
  const { data: submission, error } = await db
    .from('union_rag_submissions')
    .insert({
      user_id: user.id,
      file_url: uploadData.secure_url,
      file_name: file.name,
      union_local: union_local?.trim() || null,
      doc_type,
      description: description?.trim() || null,
      coverage_dates: coverage_dates?.trim() || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submission }, { status: 201 });
}
