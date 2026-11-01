// tests/unit/media-retirement.test.ts
// Run: npm run test:unit
//
// Decomposition Stage 1: Media moved to Stream.WitUS. Three things are checked here:
//   1. The CSV export (lib/media/export-csv.ts + app/api/media/export/route.ts) is the
//      file Stream.WitUS's importer reads: same headers, every column it reads, values
//      that survive CSV quoting, and 500-row parts for Stream's per-file limit.
//   2. Every media write route answers 410 (lib/media/retired.ts), including likes and
//      shares on media items, while the export stays a plain GET.
//   3. Media is out of the main nav, and the Data Hub still links to the export.
//
// Route files import through the `@/` alias, which node:test cannot resolve, so (2) and
// (3) read the source files. Every title below is made up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Papa from 'papaparse';
import { csvEscape } from '../../lib/csv/helpers.ts';
import {
  MEDIA_EXPORT_HEADERS,
  STREAM_IMPORT_MAX_ROWS,
  exportPartCount,
  exportPartRange,
  mediaExportFilename,
  mediaItemToCsvRow,
  parseExportPart,
  type MediaExportSource,
} from '../../lib/media/export-csv.ts';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ─── 1. CSV format ─────────────────────────────────────────────────────────────

// Copied from stream-witus tests/media-csv.test.ts (CENTOS_EXPORT_HEADERS, 2026-09-21).
// Stream's test checks this same list against our route file.
const STREAM_FIXTURE_HEADERS = [
  'title', 'creator', 'media_type', 'status', 'rating',
  'start_date', 'end_date', 'genre', 'tags',
  'cover_image_url', 'external_url',
  'current_progress', 'total_length',
  'season_number', 'episode_number', 'year_released',
  'source_platform', 'notes', 'favorite', 'visibility',
  'is_favorite',
];

// The keys stream-witus src/lib/csv.ts csvToMediaItems reads from each row.
const STREAM_READS = [
  'title', 'media_type', 'creator', 'status', 'rating', 'genre', 'tags',
  'cover_image_url', 'external_url', 'start_date', 'end_date', 'year_released',
  'source_platform', 'current_progress', 'total_length', 'season_number',
  'episode_number', 'visibility', 'is_favorite', 'notes',
];

/** The header literal inside buildCsvResponse([...]), read the way Stream's drift test reads it. */
function routeHeaders(): string[] {
  const src = read('app/api/media/export/route.ts');
  const block = src.match(/buildCsvResponse\(\s*\[([\s\S]*?)\],/);
  assert.ok(block, 'export route must pass a literal header array to buildCsvResponse');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** The file the route sends: lib/csv/helpers.ts buildCsvResponse's text. */
function exportText(items: MediaExportSource[]): string {
  const lines = items.map((it) => mediaItemToCsvRow(it).map(csvEscape).join(','));
  return [MEDIA_EXPORT_HEADERS.join(','), ...lines].join('\n');
}

/** Parse the way Stream's csvToMediaItems does (papaparse, header row, normalized names). */
function parseLikeStream(csv: string) {
  return Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });
}

// Mirrors the rows in Stream's "csvToMediaItems with a CentenarianOS export" fixture.
const FIXTURE: MediaExportSource[] = [
  {
    title: 'Fake Show', creator: 'Fake Studio', media_type: 'tv_show', status: 'in_progress',
    rating: 3, genre: ['Drama'], start_date: '2026-08-01', year_released: 2021,
    source_platform: 'FakeFlix', current_progress: 'S1E1', total_length: '3 episodes',
    season_number: 2, episode_number: 7, visibility: 'private', is_favorite: false,
    notes: 'Has a comma, a "quote" and\na second line.',
  },
  {
    title: 'Fake Book', creator: 'A. Author', media_type: 'book', status: 'completed',
    rating: 5, genre: ['Nonfiction', 'Health'], tags: ['longevity'], start_date: '2026-01-02',
    end_date: '2026-02-03', visibility: 'public', is_favorite: true,
  },
  { title: 'Fake Podcast', media_type: 'podcast', status: 'in_progress' },
];

test('export headers: route literal, module list and Stream fixture are the same', () => {
  assert.deepEqual(routeHeaders(), [...MEDIA_EXPORT_HEADERS]);
  assert.deepEqual([...MEDIA_EXPORT_HEADERS], STREAM_FIXTURE_HEADERS);
});

test('export headers: every column Stream.WitUS reads is present', () => {
  const missing = STREAM_READS.filter((c) => !(MEDIA_EXPORT_HEADERS as readonly string[]).includes(c));
  assert.deepEqual(missing, []);
});

test('export headers: columns 1-20 match the CentOS import template', () => {
  const template = read('public/templates/media-import-template.csv').split('\n')[0].trim().split(',');
  assert.deepEqual(MEDIA_EXPORT_HEADERS.slice(0, 20), template);
});

test('export row: one cell per header, in header order', () => {
  const row = mediaItemToCsvRow(FIXTURE[0]);
  assert.equal(row.length, MEDIA_EXPORT_HEADERS.length);
  const cell = (h: string) => row[MEDIA_EXPORT_HEADERS.indexOf(h as never)];
  assert.equal(cell('season_number'), '2');
  assert.equal(cell('episode_number'), '7');
  assert.equal(cell('year_released'), '2021');
  assert.equal(cell('rating'), '3');
  assert.equal(cell('end_date'), '');
});

test('export row: nulls become empty cells, favorite and visibility get defaults', () => {
  const row = mediaItemToCsvRow({ title: 'Bare', media_type: 'movie' });
  const cell = (h: string) => row[MEDIA_EXPORT_HEADERS.indexOf(h as never)];
  assert.equal(cell('season_number'), '');
  assert.equal(cell('genre'), '');
  assert.equal(cell('favorite'), 'false');
  assert.equal(cell('is_favorite'), 'false');
  assert.equal(cell('visibility'), 'private');
});

test('round trip: a CentOS export parses back to the same values under Stream rules', () => {
  const parsed = parseLikeStream(exportText(FIXTURE));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.data.length, 3);

  const [show, book, pod] = parsed.data;
  assert.equal(show.title, 'Fake Show');
  assert.equal(show.media_type, 'tv_show');
  assert.equal(show.season_number, '2');
  assert.equal(show.episode_number, '7');
  assert.equal(show.notes, 'Has a comma, a "quote" and\na second line.');
  assert.equal(show.is_favorite, 'false');

  // Stream splits genre and tags on ';'.
  assert.deepEqual(book.genre.split(';'), ['Nonfiction', 'Health']);
  assert.equal(book.tags, 'longevity');
  assert.equal(book.visibility, 'public');
  assert.equal(book.is_favorite, 'true');
  assert.equal(book.favorite, 'true');

  assert.equal(pod.title, 'Fake Podcast');
  assert.equal(pod.season_number, '');
});

test('parts: Stream takes 500 rows a file, so bigger lists split', () => {
  assert.equal(STREAM_IMPORT_MAX_ROWS, 500);
  assert.equal(exportPartCount(0), 1);
  assert.equal(exportPartCount(500), 1);
  assert.equal(exportPartCount(501), 2);
  assert.equal(exportPartCount(1200), 3);
  assert.deepEqual(exportPartRange(1), { from: 0, to: 499 });
  assert.deepEqual(exportPartRange(2), { from: 500, to: 999 });
});

test('parts: the part query value', () => {
  assert.equal(parseExportPart(null), null);
  assert.equal(parseExportPart(''), null);
  assert.equal(parseExportPart('2'), 2);
  for (const bad of ['0', '-1', '1.5', 'two']) assert.equal(parseExportPart(bad), 'invalid', bad);
  assert.equal(mediaExportFilename(null), 'centenarianos-media-export.csv');
  assert.equal(mediaExportFilename(3), 'centenarianos-media-export-part-3.csv');
});

test('export route: reads in pages, skips deleted items, has no write handler', () => {
  const src = read('app/api/media/export/route.ts');
  assert.match(src, /export async function GET/);
  assert.doesNotMatch(src, /export (async )?function (POST|PUT|PATCH|DELETE)/);
  assert.match(src, /\.eq\('is_active', true\)/);
  assert.match(src, /\.range\(/);
});

// ─── 2. Write block ────────────────────────────────────────────────────────────

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...routeFiles(rel));
    else if (name === 'route.ts') out.push(rel);
  }
  return out;
}

test('every media and podcast write handler answers 410 via mediaRetiredResponse', () => {
  const files = [...routeFiles('app/api/media'), ...routeFiles('app/api/podcasts')];
  assert.ok(files.length >= 15, `expected the media route files, found ${files.length}`);

  const writers: string[] = [];
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /export const (POST|PUT|PATCH|DELETE)\b/, `${f}: write handler as a const`);
    const handlers = [...src.matchAll(/export (?:async )?function (POST|PUT|PATCH|DELETE)\b[^{]*\{\s*([^\n]*)/g)];
    for (const [, method, firstLine] of handlers) {
      writers.push(`${f} ${method}`);
      assert.equal(firstLine.trim(), 'return mediaRetiredResponse();', `${f} ${method} must return 410`);
    }
  }
  // POST /api/media, PATCH+DELETE /api/media/[id] and POST /api/media/import at least.
  assert.ok(writers.length >= 4, writers.join('\n'));
});

test('likes and shares on a media item answer 410; equipment still works', () => {
  for (const f of ['app/api/social/likes/route.ts', 'app/api/social/shares/route.ts']) {
    const src = read(f);
    const post = src.slice(src.indexOf('export async function POST'));
    const guard = post.indexOf("if (entity_type === 'media_item') return mediaRetiredResponse();");
    assert.ok(guard > 0, `${f}: POST must refuse media_item`);
    assert.ok(guard < post.indexOf('ENTITY_TABLE_MAP[entity_type]'), `${f}: refuse before touching the table`);
    assert.match(src, /'equipment'/);
  }
});

test('the media detail page has no like or share controls', () => {
  const src = read('app/dashboard/media/[id]/page.tsx');
  assert.doesNotMatch(src, /\/api\/social\/(likes|shares)', \{\s*method: 'POST'/);
  assert.doesNotMatch(src, /handleLike|handleShare/);
});

test('the 410 body names Stream.WitUS and the export', () => {
  const src = read('lib/media/retired.ts');
  assert.match(src, /status: 410/);
  assert.match(src, /Stream\.WitUS/);
  assert.match(src, /export_url: MEDIA_EXPORT_PATH/);
  assert.match(read('lib/media/stream-handoff.ts'), /MEDIA_EXPORT_PATH = '\/api\/media\/export'/);
});

// ─── 3. Nav ────────────────────────────────────────────────────────────────────

test('Media is not in the main nav', () => {
  const nav = read('components/nav/NavConfig.ts');
  assert.doesNotMatch(nav, /href: '\/dashboard\/media'/);
  assert.doesNotMatch(nav, /label: 'Media'/);
});

test('the Data Hub keeps a link to the media export page', () => {
  const hub = read('app/dashboard/data/page.tsx');
  assert.match(hub, /href="\/dashboard\/media"/);
  assert.match(hub, /moved to Stream\.WitUS/);
});

test('the read-only Media page stays open to Starter users so they can export', () => {
  assert.match(read('lib/access/starter-modules.ts'), /'\/dashboard\/media'/);
});
