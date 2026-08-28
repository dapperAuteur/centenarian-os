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
    // `is_favorite` alias — see the header comment below.
    r.is_favorite ? 'true' : 'false',
  ]);

  // Header names must be snake_case, not Title Case. Both importers that consume this file
  // key off the header row by exact name:
  //   - our own /api/media/import reads row.title, row.media_type, row.favorite, ...
  //   - Stream.WitUS's csvToMediaItems reads r.title, r.media_type, r.is_favorite, ...
  // Columns 1-20 match public/templates/media-import-template.csv exactly, so an export
  // re-imports here cleanly. The trailing `is_favorite` is a deliberate duplicate of
  // `favorite`: it is the only field whose name differs between the two importers, and an
  // unrecognized extra column is ignored by both, so carrying both names loses nothing.
  return buildCsvResponse(
    [
      'title', 'creator', 'media_type', 'status', 'rating',
      'start_date', 'end_date', 'genre', 'tags',
      'cover_image_url', 'external_url',
      'current_progress', 'total_length',
      'season_number', 'episode_number', 'year_released',
      'source_platform', 'notes', 'favorite', 'visibility',
      'is_favorite',
    ],
    rows,
    'centenarianos-media-export.csv',
  );
}
