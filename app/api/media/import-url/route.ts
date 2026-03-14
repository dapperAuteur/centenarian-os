// app/api/media/import-url/route.ts
// Fetches a media URL (IMDB, Goodreads, etc.), extracts JSON-LD or Open Graph
// metadata, and returns normalized fields for the MediaForm to pre-populate.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/** Map JSON-LD @type to our media_type enum */
function mapType(ldType: string | string[]): string | null {
  const t = Array.isArray(ldType) ? ldType[0] : ldType;
  const map: Record<string, string> = {
    Movie: 'movie',
    TVSeries: 'tv_show',
    TVSeason: 'tv_show',
    TVEpisode: 'tv_show',
    Book: 'book',
    MusicAlbum: 'album',
    MusicRecording: 'song',
    MusicPlaylist: 'album',
    Article: 'article',
    VideoObject: 'video',
    Podcast: 'podcast',
    PodcastEpisode: 'podcast',
    CreativeWork: 'other',
    VisualArtwork: 'art',
  };
  return map[t] ?? null;
}

/** Extract person name from JSON-LD person field */
function extractPerson(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    const names = val.map((v) =>
      typeof v === 'string' ? v : (v as Record<string, unknown>)?.name,
    ).filter(Boolean);
    return names.join(', ') || null;
  }
  if (typeof val === 'object') return (val as Record<string, unknown>)?.name as string ?? null;
  return null;
}

/** Extract year from date string */
function extractYear(val: unknown): number | null {
  if (!val) return null;
  const str = String(val);
  const match = str.match(/(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

/** Extract genre array */
function extractGenre(val: unknown): string[] {
  if (!val) return [];
  if (typeof val === 'string') return val.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  return [];
}

/** Extract Open Graph meta tags as fallback */
function extractOG(html: string): Record<string, string> {
  const og: Record<string, string> = {};
  const pattern = /<meta[^>]*(?:property|name)=["'](og:[^"']+)["'][^>]*content=["']([^"']*)["']/gi;
  for (const match of html.matchAll(pattern)) {
    og[match[1]] = match[2];
  }
  // Also try reversed attribute order: content before property
  const pattern2 = /<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["'](og:[^"']+)["']/gi;
  for (const match of html.matchAll(pattern2)) {
    if (!og[match[2]]) og[match[2]] = match[1];
  }
  return og;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let url: string;
  try {
    const body = await request.json();
    url = body.url;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  try { new URL(url); } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CentenarianOS/1.0; media-importer)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.error('[media-import] Fetch failed:', err);
    return NextResponse.json({ error: 'Could not fetch the URL. Check that it is publicly accessible.' }, { status: 422 });
  }

  // Try JSON-LD first
  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let mediaData: Record<string, unknown> | null = null;

  const mediaTypes = ['Movie', 'TVSeries', 'TVSeason', 'TVEpisode', 'Book', 'MusicAlbum', 'MusicRecording', 'MusicPlaylist', 'Article', 'VideoObject', 'Podcast', 'PodcastEpisode', 'VisualArtwork', 'CreativeWork'];

  for (const match of html.matchAll(scriptPattern)) {
    try {
      const parsed = JSON.parse(match[1]);
      const items: unknown[] = parsed['@graph'] ?? (Array.isArray(parsed) ? parsed : [parsed]);
      const found = items.find((item) => {
        const t = (item as Record<string, unknown>)['@type'];
        const types = Array.isArray(t) ? t : [t];
        return types.some((typ) => mediaTypes.includes(String(typ)));
      });
      if (found) { mediaData = found as Record<string, unknown>; break; }
    } catch { /* skip malformed JSON-LD */ }
  }

  if (mediaData) {
    const ldType = mediaData['@type'] as string | string[];
    return NextResponse.json({
      title: typeof mediaData.name === 'string' ? stripHtml(mediaData.name) : '',
      media_type: mapType(ldType) || 'other',
      creator: extractPerson(mediaData.director ?? mediaData.author ?? mediaData.creator ?? mediaData.byArtist),
      year_released: extractYear(mediaData.datePublished ?? mediaData.dateCreated ?? mediaData.startDate),
      cover_image_url: typeof mediaData.image === 'string' ? mediaData.image
        : (mediaData.image as Record<string, unknown>)?.url as string ?? null,
      genre: extractGenre(mediaData.genre),
      notes: typeof mediaData.description === 'string' ? stripHtml(mediaData.description).slice(0, 500) : null,
      external_url: url,
      source: 'json-ld',
    });
  }

  // Fallback: Open Graph meta tags
  const og = extractOG(html);
  if (og['og:title']) {
    // Try to detect type from URL or og:type
    let media_type = 'other';
    const ogType = og['og:type'] || '';
    if (ogType.includes('movie') || ogType.includes('video.movie')) media_type = 'movie';
    else if (ogType.includes('tv_show') || ogType.includes('video.tv_show')) media_type = 'tv_show';
    else if (ogType.includes('music.album')) media_type = 'album';
    else if (ogType.includes('music.song')) media_type = 'song';
    else if (ogType.includes('book')) media_type = 'book';
    else if (ogType.includes('article')) media_type = 'article';
    else if (ogType.includes('video')) media_type = 'video';

    return NextResponse.json({
      title: stripHtml(og['og:title']),
      media_type,
      creator: null,
      year_released: null,
      cover_image_url: og['og:image'] || null,
      genre: [],
      notes: og['og:description'] ? stripHtml(og['og:description']).slice(0, 500) : null,
      external_url: url,
      source: 'opengraph',
    });
  }

  return NextResponse.json(
    { error: 'No media metadata found on this page. Try a different URL.' },
    { status: 422 },
  );
}
