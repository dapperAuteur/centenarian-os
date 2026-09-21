import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mediaRetiredResponse } from '@/lib/media/retired';

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
  if (search) {
    const term = `%${search}%`;
    query = query.or(
      `title.ilike.${term},creator.ilike.${term},source_platform.ilike.${term},genre.cs.{"${search}"},tags.cs.{"${search}"}`
    );
  }
  if (isFavorite === 'true') query = query.eq('is_favorite', true);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [], total: count || 0 });
}

// Media moved to Stream.WitUS: writes are retired (410 Gone). See lib/media/retired.ts.
export function POST() {
  return mediaRetiredResponse();
}
