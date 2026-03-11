// app/api/media/import/route.ts
// POST: bulk import media items from parsed CSV rows

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { MAX_IMPORT_ROWS, validateDate } from '@/lib/csv/helpers';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_TYPES = new Set([
  'book', 'tv_show', 'movie', 'video', 'song', 'album', 'podcast', 'art', 'article', 'other',
]);
const VALID_STATUSES = new Set(['want_to_consume', 'in_progress', 'completed', 'dropped']);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const rows = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_IMPORT_ROWS} rows per import` }, { status: 400 });
  }

  const db = getDb();
  const payloads: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const title = row.title?.trim();
    if (!title) {
      errors.push(`Row ${i + 1}: missing title`);
      skipped++;
      continue;
    }

    const mediaType = row.media_type?.trim()?.toLowerCase();
    if (!mediaType || !VALID_TYPES.has(mediaType)) {
      errors.push(`Row ${i + 1}: invalid or missing media_type`);
      skipped++;
      continue;
    }

    const statusRaw = row.status?.trim()?.toLowerCase();
    const status = statusRaw && VALID_STATUSES.has(statusRaw) ? statusRaw : 'want_to_consume';

    const rating = row.rating ? parseInt(row.rating) : null;
    const validRating = rating && rating >= 1 && rating <= 5 ? rating : null;

    const startDate = row.start_date?.trim() && validateDate(row.start_date.trim())
      ? row.start_date.trim() : null;
    const endDate = row.end_date?.trim() && validateDate(row.end_date.trim())
      ? row.end_date.trim() : null;

    const genre = row.genre?.trim()
      ? row.genre.trim().split(';').map((g: string) => g.trim()).filter(Boolean)
      : [];
    const tags = row.tags?.trim()
      ? row.tags.trim().split(';').map((t: string) => t.trim()).filter(Boolean)
      : [];

    const yearReleased = row.year_released ? parseInt(row.year_released) : null;
    const seasonNumber = row.season_number ? parseInt(row.season_number) : null;
    const episodeNumber = row.episode_number ? parseInt(row.episode_number) : null;

    payloads.push({
      user_id: user.id,
      title,
      creator: row.creator?.trim() || null,
      media_type: mediaType,
      status,
      rating: validRating,
      start_date: startDate,
      end_date: endDate,
      genre,
      tags,
      cover_image_url: row.cover_image_url?.trim() || null,
      external_url: row.external_url?.trim() || null,
      current_progress: row.current_progress?.trim() || null,
      total_length: row.total_length?.trim() || null,
      season_number: seasonNumber,
      episode_number: episodeNumber,
      year_released: yearReleased,
      source_platform: row.source_platform?.trim() || null,
      notes: row.notes?.trim() || null,
      is_favorite: row.favorite?.toLowerCase() === 'true',
      visibility: row.visibility === 'public' ? 'public' : 'private',
    });
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors.slice(0, 10) }, { status: 400 });
  }

  const { data, error } = await db
    .from('media_items')
    .insert(payloads)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const imported = data?.length || 0;
  return NextResponse.json({
    imported,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `Imported ${imported} media items. ${skipped > 0 ? `${skipped} skipped.` : ''}`,
  });
}
