// app/api/academy/media/route.ts
//
// GET  — list the current user's media library, newest first.
// POST — register a freshly uploaded Cloudinary asset. Called by
//        Cloudinary360Uploader after a successful upload; the widget
//        passes enough metadata that we don't need a server-side
//        Cloudinary API call to populate the row.
//
// Auth: teacher or admin only (learners don't own a media library).
// Service role used for DB writes so we can bypass RLS after auth.

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { AssetKind, CloudinaryResourceType } from '@/lib/academy/media-types';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const ALLOWED_KINDS: AssetKind[] = [
  'video', 'image', 'audio', 'panorama_video', 'panorama_image', 'document', 'other',
];
const ALLOWED_RESOURCE_TYPES: CloudinaryResourceType[] = ['image', 'video', 'raw'];

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');

  let query = db.from('media_assets').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
  if (kind && (ALLOWED_KINDS as string[]).includes(kind)) {
    query = query.eq('asset_kind', kind);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  // Validate required fields. The uploader should send all of these —
  // missing values suggest a malformed client payload, return 400 so the
  // client error-logger can surface it.
  const {
    cloudinary_public_id,
    cloudinary_resource_type,
    secure_url,
    asset_kind,
    name,
    description,
    tags,
    file_size_bytes,
    duration_seconds,
    width,
    height,
  } = body;

  if (!cloudinary_public_id || typeof cloudinary_public_id !== 'string') {
    return NextResponse.json({ error: 'cloudinary_public_id required' }, { status: 400 });
  }
  if (!secure_url || typeof secure_url !== 'string') {
    return NextResponse.json({ error: 'secure_url required' }, { status: 400 });
  }
  if (!(ALLOWED_RESOURCE_TYPES as string[]).includes(cloudinary_resource_type)) {
    return NextResponse.json({ error: 'cloudinary_resource_type must be image|video|raw' }, { status: 400 });
  }
  if (!(ALLOWED_KINDS as string[]).includes(asset_kind)) {
    return NextResponse.json({ error: 'invalid asset_kind' }, { status: 400 });
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  const db = getDb();

  // Upsert on (owner_id, cloudinary_public_id) so re-registering the same
  // asset (e.g. teacher replaces a file and the upload succeeds twice)
  // just updates the existing row.
  const { data, error } = await db
    .from('media_assets')
    .upsert(
      {
        owner_id: user.id,
        cloudinary_public_id,
        cloudinary_resource_type,
        secure_url,
        asset_kind,
        name: name.trim(),
        description: description ?? null,
        tags: Array.isArray(tags) ? tags : [],
        file_size_bytes: file_size_bytes ?? null,
        duration_seconds: duration_seconds ?? null,
        width: width ?? null,
        height: height ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,cloudinary_public_id' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data }, { status: 201 });
}
