import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const brandId = sp.get('brand_id');
  const status = sp.get('status');
  const limit = Math.min(Number(sp.get('limit')) || 50, 200);
  const offset = Number(sp.get('offset')) || 0;

  let query = supabase
    .from('podcast_episodes')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('air_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (brandId) query = query.eq('brand_id', brandId);
  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ episodes: data || [], total: count || 0 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const {
    episode_number, season_number, air_date, description,
    show_notes, show_notes_format, audio_url, external_url,
    duration_min, status: episodeStatus, brand_id,
  } = body;

  const { data, error } = await supabase
    .from('podcast_episodes')
    .insert({
      user_id: user.id,
      title: title.trim(),
      episode_number: episode_number ?? null,
      season_number: season_number ?? null,
      air_date: air_date || null,
      description: description || null,
      show_notes: show_notes || null,
      show_notes_format: show_notes_format || null,
      audio_url: audio_url || null,
      external_url: external_url || null,
      duration_min: duration_min ?? null,
      status: episodeStatus || 'draft',
      brand_id: brand_id || null,
    })
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ episode: data }, { status: 201 });
}
