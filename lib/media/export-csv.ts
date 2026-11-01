// lib/media/export-csv.ts
// The media CSV export that users carry to Stream.WitUS (decomposition Stage 1).
// Pure: no imports, so the route, the banner and node:test can all load it.
//
// Two limits shape the export:
//   - Stream.WitUS's POST /api/media/import refuses a whole file of more than 500 rows
//     (MAX_ROWS in stream-witus src/app/api/media/import/route.ts). A list bigger than
//     that is exported in parts of at most 500 rows, one file per part.
//   - Supabase returns at most 1,000 rows per select by default, so the route reads the
//     list in pages instead of trusting one select('*') to return everything.

/** Stream.WitUS's per-file import limit (MAX_ROWS in its import route). */
export const STREAM_IMPORT_MAX_ROWS = 500;

/** Rows per database read; under Supabase's default 1,000-row response cap. */
export const EXPORT_READ_PAGE_SIZE = 500;

/**
 * Export columns, in file order. app/api/media/export/route.ts repeats this list as a
 * literal inside its buildCsvResponse call, because Stream.WitUS's drift test reads the
 * literal from that file; tests/unit/media-retirement.test.ts keeps the two equal.
 *
 * Columns 1-20 match public/templates/media-import-template.csv. `is_favorite` repeats
 * `favorite` because Stream's importer reads that name (it also accepts `favorite`).
 */
export const MEDIA_EXPORT_HEADERS = [
  'title', 'creator', 'media_type', 'status', 'rating',
  'start_date', 'end_date', 'genre', 'tags',
  'cover_image_url', 'external_url',
  'current_progress', 'total_length',
  'season_number', 'episode_number', 'year_released',
  'source_platform', 'notes', 'favorite', 'visibility',
  'is_favorite',
] as const;

export type MediaExportHeader = (typeof MEDIA_EXPORT_HEADERS)[number];

/** The media_items columns the export reads. */
export interface MediaExportSource {
  title?: string | null;
  creator?: string | null;
  media_type?: string | null;
  status?: string | null;
  rating?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  genre?: string[] | null;
  tags?: string[] | null;
  cover_image_url?: string | null;
  external_url?: string | null;
  current_progress?: string | null;
  total_length?: string | null;
  season_number?: number | null;
  episode_number?: number | null;
  year_released?: number | null;
  source_platform?: string | null;
  notes?: string | null;
  is_favorite?: boolean | null;
  visibility?: string | null;
}

const text = (v: string | null | undefined) => v ?? '';
const num = (v: number | null | undefined) => (v == null ? '' : String(v));
// Stream splits genre and tags on `;`, so join with it.
const list = (v: string[] | null | undefined) => (v ?? []).join(';');

/** One media_items row as export cells, in MEDIA_EXPORT_HEADERS order. */
export function mediaItemToCsvRow(r: MediaExportSource): string[] {
  const favorite = r.is_favorite ? 'true' : 'false';
  const cells: Record<MediaExportHeader, string> = {
    title: text(r.title),
    creator: text(r.creator),
    media_type: text(r.media_type),
    status: text(r.status),
    rating: num(r.rating),
    start_date: text(r.start_date),
    end_date: text(r.end_date),
    genre: list(r.genre),
    tags: list(r.tags),
    cover_image_url: text(r.cover_image_url),
    external_url: text(r.external_url),
    current_progress: text(r.current_progress),
    total_length: text(r.total_length),
    season_number: num(r.season_number),
    episode_number: num(r.episode_number),
    year_released: num(r.year_released),
    source_platform: text(r.source_platform),
    notes: text(r.notes),
    favorite,
    visibility: r.visibility || 'private',
    is_favorite: favorite,
  };
  return MEDIA_EXPORT_HEADERS.map((h) => cells[h]);
}

/** How many files a list of `total` items needs for Stream's import. At least 1. */
export function exportPartCount(total: number): number {
  return Math.max(1, Math.ceil(total / STREAM_IMPORT_MAX_ROWS));
}

/**
 * Reads the `part` query value: a whole number from 1, or null for "the whole list".
 * Anything else is invalid and the route answers 400.
 */
export function parseExportPart(raw: string | null): number | null | 'invalid' {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 'invalid';
}

/** Zero-based inclusive row range of a part, for Supabase's .range(from, to). */
export function exportPartRange(part: number): { from: number; to: number } {
  const from = (part - 1) * STREAM_IMPORT_MAX_ROWS;
  return { from, to: from + STREAM_IMPORT_MAX_ROWS - 1 };
}

export function mediaExportFilename(part: number | null): string {
  return part == null
    ? 'centenarianos-media-export.csv'
    : `centenarianos-media-export-part-${part}.csv`;
}
