import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getServiceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const type = sp.get('type');

  if (!type || (type !== 'media' && type !== 'equipment')) {
    return NextResponse.json({ error: 'type must be "media" or "equipment"' }, { status: 400 });
  }

  const serviceDb = getServiceDb();

  if (type === 'media') {
    const { data, error } = await serviceDb
      .from('media_items')
      .select('*')
      .eq('id', id)
      .eq('visibility', 'public')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  }

  if (type === 'equipment') {
    const { data, error } = await serviceDb
      .from('equipment')
      .select('*, equipment_categories(name, icon, color)')
      .eq('id', id)
      .eq('visibility', 'public')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Fetch equipment media (images only)
    const { data: media } = await serviceDb
      .from('equipment_media')
      .select('id, url, media_type, caption')
      .eq('equipment_id', id)
      .eq('media_type', 'image')
      .order('sort_order', { ascending: true });

    return NextResponse.json({
      item: {
        ...data,
        equipment_media: media || [],
      },
    });
  }
}
