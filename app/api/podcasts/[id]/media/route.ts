import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('media_episode_links')
    .select('*, media_items(title, media_type, creator, cover_image_url)')
    .eq('episode_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ links: data || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { media_item_id, discussion_notes, timestamp_start, sort_order } = body;

  if (!media_item_id) {
    return NextResponse.json({ error: 'media_item_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('media_episode_links')
    .insert({
      episode_id: id,
      media_item_id,
      user_id: user.id,
      discussion_notes: discussion_notes || null,
      timestamp_start: timestamp_start ?? null,
      sort_order: sort_order ?? null,
    })
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Increment use_count on the linked media item
  const { data: item } = await supabase
    .from('media_items')
    .select('use_count')
    .eq('id', media_item_id)
    .maybeSingle();

  if (item) {
    await supabase
      .from('media_items')
      .update({ use_count: (item.use_count ?? 0) + 1 })
      .eq('id', media_item_id);
  }

  return NextResponse.json({ link: data }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { media_item_id } = body;

  if (!media_item_id) {
    return NextResponse.json({ error: 'media_item_id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('media_episode_links')
    .delete()
    .eq('episode_id', id)
    .eq('media_item_id', media_item_id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
