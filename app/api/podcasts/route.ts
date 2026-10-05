import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mediaRetiredResponse } from '@/lib/media/retired';

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

// Media moved to Stream.WitUS: writes are retired (410 Gone). See lib/media/retired.ts.
export function POST() {
  return mediaRetiredResponse();
}
