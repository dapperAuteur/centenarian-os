// app/api/academy/media/[id]/route.ts
//
// PATCH  — rename the asset, update its description, or change its tags.
// DELETE — remove the asset. Blocks deletion when any lesson still
//          references the asset's secure_url; forces the teacher to
//          unwire first (27a design choice; 27b may relax this).

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

async function requireOwner(id: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 as const };

  const db = getDb();
  const { data: asset } = await db
    .from('media_assets')
    .select('id, owner_id, secure_url')
    .eq('id', id)
    .maybeSingle();
  if (!asset) return { error: 'Not found', status: 404 as const };
  if (asset.owner_id !== user.id) return { error: 'Forbidden', status: 403 as const };
  return { user, db, asset };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await requireOwner(id);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { db } = auth;

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === 'string') updates.name = body.name.trim();
  if (body.description === null || typeof body.description === 'string') {
    updates.description = body.description;
  }
  if (Array.isArray(body.tags)) {
    updates.tags = body.tags.filter((t: unknown): t is string => typeof t === 'string');
  }

  const { data, error } = await db
    .from('media_assets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await requireOwner(id);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { db, asset } = auth;

  // Block delete if any lesson references this URL. Teacher must
  // unwire those lessons first.
  const [contentMatches, posterMatches] = await Promise.all([
    db.from('lessons').select('id', { count: 'exact', head: true }).eq('content_url', asset.secure_url),
    db.from('lessons').select('id', { count: 'exact', head: true }).eq('video_360_poster_url', asset.secure_url),
  ]);
  const total = (contentMatches.count ?? 0) + (posterMatches.count ?? 0);
  if (total > 0) {
    return NextResponse.json(
      {
        error: 'Asset is in use',
        reason: 'referenced',
        reference_count: total,
      },
      { status: 409 },
    );
  }

  const { error } = await db.from('media_assets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
