import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from('media_notes')
    .select('*')
    .eq('media_item_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notes: data || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { title, content, content_format, note_type, audio_url, audio_public_id } = body;

  if (!content?.trim() && !audio_url) {
    return NextResponse.json({ error: 'content or audio is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('media_notes')
    .insert({
      media_item_id: id,
      user_id: user.id,
      title: title || null,
      content: (content || '').trim(),
      content_format: content_format || 'markdown',
      note_type: note_type || 'general',
      audio_url: audio_url || null,
      audio_public_id: audio_public_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ note: data }, { status: 201 });
}
