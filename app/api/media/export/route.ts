// app/api/media/export/route.ts
// GET: export the signed-in user's media list as CSV, in the format Stream.WitUS's
// media import reads (Media moved there in decomposition Stage 1; this export stays on).
//
// Query params:
//   part=N           one file of at most 500 rows (Stream's per-file import limit);
//                    part 1 is rows 1-500, part 2 rows 501-1000, and so on.
//                    Without it, the whole list comes back in one file.
//   media_type, status   optional filters.
// Deleted items (is_active = false) are left out, matching the media list.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';
import {
  EXPORT_READ_PAGE_SIZE,
  exportPartRange,
  mediaExportFilename,
  mediaItemToCsvRow,
  parseExportPart,
  type MediaExportSource,
} from '@/lib/media/export-csv';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const mediaType = params.get('media_type');
  const status = params.get('status');
  const part = parseExportPart(params.get('part'));
  if (part === 'invalid') {
    return NextResponse.json({ error: 'part must be a whole number from 1' }, { status: 400 });
  }

  const readRange = async (from: number, to: number) => {
    let query = supabase
      .from('media_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      // id breaks created_at ties so pages never overlap or skip a row.
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
    if (mediaType) query = query.eq('media_type', mediaType);
    if (status) query = query.eq('status', status);
    return query;
  };

  const items: MediaExportSource[] = [];
  if (part != null) {
    const { from, to } = exportPartRange(part);
    const { data, error } = await readRange(from, to);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    items.push(...((data ?? []) as MediaExportSource[]));
  } else {
    // Supabase caps a select at 1,000 rows, so read the whole list page by page.
    for (let from = 0; ; from += EXPORT_READ_PAGE_SIZE) {
      const { data, error } = await readRange(from, from + EXPORT_READ_PAGE_SIZE - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const page = (data ?? []) as MediaExportSource[];
      items.push(...page);
      if (page.length < EXPORT_READ_PAGE_SIZE) break;
    }
  }

  // The header list below must stay a literal here: Stream.WitUS's tests read it from this
  // file to check that its importer still matches. It equals MEDIA_EXPORT_HEADERS in
  // lib/media/export-csv.ts (tests/unit/media-retirement.test.ts checks that).
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
    items.map(mediaItemToCsvRow),
    mediaExportFilename(part),
  );
}
