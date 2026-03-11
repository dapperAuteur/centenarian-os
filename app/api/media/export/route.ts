// app/api/media/export/route.ts
// GET: export media items as CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const mediaType = params.get('media_type');
  const status = params.get('status');

  let query = supabase
    .from('media_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (mediaType) query = query.eq('media_type', mediaType);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r) => [
    r.title || '',
    r.creator || '',
    r.media_type || '',
    r.status || '',
    String(r.rating ?? ''),
    r.start_date || '',
    r.end_date || '',
    (r.genre || []).join(';'),
    (r.tags || []).join(';'),
    r.cover_image_url || '',
    r.external_url || '',
    r.current_progress || '',
    r.total_length || '',
    String(r.season_number ?? ''),
    String(r.episode_number ?? ''),
    String(r.year_released ?? ''),
    r.source_platform || '',
    r.notes || '',
    r.is_favorite ? 'true' : 'false',
    r.visibility || 'private',
  ]);

  return buildCsvResponse(
    [
      'Title', 'Creator', 'Media Type', 'Status', 'Rating',
      'Start Date', 'End Date', 'Genre', 'Tags',
      'Cover Image URL', 'External URL',
      'Current Progress', 'Total Length',
      'Season', 'Episode', 'Year Released',
      'Source Platform', 'Notes', 'Favorite', 'Visibility',
    ],
    rows,
    'centenarianos-media-export.csv',
  );
}
