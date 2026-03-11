import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getServiceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = sp.get('type');
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);
  const search = sp.get('search');
  const mediaType = sp.get('media_type');

  if (!type || (type !== 'media' && type !== 'equipment')) {
    return NextResponse.json({ error: 'type must be "media" or "equipment"' }, { status: 400 });
  }

  const serviceDb = getServiceDb();

  if (type === 'media') {
    let query = serviceDb
      .from('media_items')
      .select('*', { count: 'exact' })
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('like_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    if (mediaType) {
      query = query.eq('media_type', mediaType);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data || [], total: count || 0 });
  }

  if (type === 'equipment') {
    let query = serviceDb
      .from('equipment')
      .select('*, equipment_categories(name, icon, color)', { count: 'exact' })
      .eq('visibility', 'public')
      .eq('is_active', true)
      .order('like_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data || [], total: count || 0 });
  }
}
