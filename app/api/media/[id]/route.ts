import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function toArray(val: unknown): string[] | null {
  if (!val) return null;
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return val.split(';').map((s) => s.trim()).filter(Boolean);
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from('media_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ item: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const allowed = [
    'title', 'media_type', 'creator', 'category_id', 'brand_id',
    'status', 'rating', 'cover_image_url', 'external_url',
    'start_date', 'end_date', 'year_released',
    'source_platform', 'season_number', 'episode_number',
    'total_seasons', 'total_episodes', 'current_progress', 'total_length',
    'visibility', 'is_favorite', 'notes',
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (body.genre !== undefined) updates.genre = toArray(body.genre);
  if (body.tags !== undefined) updates.tags = toArray(body.tags);

  if (updates.title && typeof updates.title === 'string') {
    updates.title = updates.title.trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('media_items')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase
    .from('media_items')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
