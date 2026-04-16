// app/api/offline/assets/route.ts
//
// GET  — list the current user's offline ledger (what they've saved).
// POST — register that the client just cached an asset locally. The
//        client is responsible for the actual blob storage; this row
//        is the server's record of what the client claims to have.
// DELETE body { asset_url } — remove a specific ledger entry (paired
//        with the client deleting the blob from IndexedDB).
//
// Auth: any signed-in user can manage their own rows. RLS on the table
// enforces user_id = auth.uid() for all operations as a belt-and-suspenders
// check; we also use the service-role client to bypass RLS after
// confirming auth explicitly.

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const ALLOWED_KINDS = ['panorama_video', 'panorama_image', 'poster', 'audio', 'video', 'image', 'other'] as const;

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('offline_assets')
    .select('*')
    .eq('user_id', user.id)
    .order('downloaded_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { asset_url, asset_kind, course_id, lesson_id, size_bytes, expires_at } = body;

  if (!asset_url || typeof asset_url !== 'string') {
    return NextResponse.json({ error: 'asset_url required' }, { status: 400 });
  }
  if (!(ALLOWED_KINDS as readonly string[]).includes(asset_kind)) {
    return NextResponse.json({ error: 'invalid asset_kind' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('offline_assets')
    .upsert(
      {
        user_id: user.id,
        asset_url,
        asset_kind,
        course_id: course_id ?? null,
        lesson_id: lesson_id ?? null,
        size_bytes: size_bytes ?? null,
        expires_at: expires_at ?? null,
        downloaded_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,asset_url' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { asset_url } = body;
  if (!asset_url || typeof asset_url !== 'string') {
    return NextResponse.json({ error: 'asset_url required' }, { status: 400 });
  }

  const db = getDb();
  const { error } = await db
    .from('offline_assets')
    .delete()
    .eq('user_id', user.id)
    .eq('asset_url', asset_url);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
