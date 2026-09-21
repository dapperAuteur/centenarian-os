import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mediaRetiredResponse } from '@/lib/media/retired';

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

// Media moved to Stream.WitUS: writes are retired (410 Gone). See lib/media/retired.ts.
export function POST() {
  return mediaRetiredResponse();
}

export function DELETE() {
  return mediaRetiredResponse();
}
