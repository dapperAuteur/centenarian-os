import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function toArray(val: unknown): string[] | null {
  if (!val) return null;
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return val.split(';').map((s) => s.trim()).filter(Boolean);
  return null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const mediaType = sp.get('media_type');
  const status = sp.get('status');
  const categoryId = sp.get('category_id');
  const brandId = sp.get('brand_id');
  const search = sp.get('search');
  const isFavorite = sp.get('is_favorite');
  const limit = Math.min(Number(sp.get('limit')) || 50, 200);
  const offset = Number(sp.get('offset')) || 0;

  let query = supabase
    .from('media_items')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (mediaType) query = query.eq('media_type', mediaType);
  if (status) query = query.eq('status', status);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (brandId) query = query.eq('brand_id', brandId);
  if (search) query = query.ilike('title', `%${search}%`);
  if (isFavorite === 'true') query = query.eq('is_favorite', true);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [], total: count || 0 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, media_type } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (!media_type?.trim()) {
    return NextResponse.json({ error: 'media_type is required' }, { status: 400 });
  }

  const {
    subtitle, creator, category_id, brand_id, status: itemStatus,
    rating, source_url, image_url, image_public_id,
    start_date, end_date, release_year, duration_minutes,
    platform, format, language, isbn, season, episode,
    series_name, series_order, is_favorite, notes,
  } = body;

  const genre = toArray(body.genre);
  const tags = toArray(body.tags);

  const { data, error } = await supabase
    .from('media_items')
    .insert({
      user_id: user.id,
      title: title.trim(),
      media_type: media_type.trim(),
      subtitle: subtitle || null,
      creator: creator || null,
      category_id: category_id || null,
      brand_id: brand_id || null,
      status: itemStatus || 'backlog',
      rating: rating ?? null,
      genre: genre || null,
      tags: tags || null,
      source_url: source_url || null,
      image_url: image_url || null,
      image_public_id: image_public_id || null,
      start_date: start_date || null,
      end_date: end_date || null,
      release_year: release_year ?? null,
      duration_minutes: duration_minutes ?? null,
      platform: platform || null,
      format: format || null,
      language: language || null,
      isbn: isbn || null,
      season: season ?? null,
      episode: episode ?? null,
      series_name: series_name || null,
      series_order: series_order ?? null,
      is_favorite: is_favorite ?? false,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data }, { status: 201 });
}
