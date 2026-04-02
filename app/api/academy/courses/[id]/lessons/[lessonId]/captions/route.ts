// app/api/academy/courses/[id]/lessons/[lessonId]/captions/route.ts
// POST: Pull auto-generated captions from a YouTube video and save to lesson transcript_content.
// Uses YouTube Data API v3 — requires YOUTUBE_DATA_API_KEY env var.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string; lessonId: string }> };

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Parse YouTube's timedtext XML into TranscriptSegment[].
 * YouTube returns XML like: <text start="1.23" dur="4.56">Hello world</text>
 */
function parseTimedTextXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const tagRe = /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = tagRe.exec(xml)) !== null) {
    const startTime = parseFloat(match[1]);
    const dur = parseFloat(match[2]);
    // Decode basic XML entities
    const text = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim();
    if (text) {
      segments.push({ startTime, endTime: startTime + dur, text });
    }
  }
  return segments;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId, lessonId } = await params;

  // Auth check — must be teacher of this course or admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get the lesson's content_url
  const { data: lesson } = await db
    .from('lessons')
    .select('content_url, lesson_type')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single();

  if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

  // Extract YouTube video ID
  const body = await request.json().catch(() => ({}));
  const videoId = body.videoId as string | undefined;
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'Invalid or missing videoId' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }

  try {
    // Step 1: List available caption tracks
    const listUrl = `https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&part=snippet&key=${apiKey}`;
    const listRes = await fetch(listUrl);
    if (!listRes.ok) {
      const err = await listRes.text();
      return NextResponse.json({ error: 'YouTube API error', detail: err }, { status: 502 });
    }
    const listData = await listRes.json();
    const tracks = listData.items as Array<{
      id: string;
      snippet: { language: string; trackKind: string; name: string };
    }>;

    if (!tracks || tracks.length === 0) {
      return NextResponse.json({
        error: 'No captions available',
        detail: 'YouTube may still be processing auto-captions. Try again in a few minutes.',
      }, { status: 404 });
    }

    // Prefer English auto-generated, then any English, then first available
    const enAuto = tracks.find((t) => t.snippet.language === 'en' && t.snippet.trackKind === 'ASR');
    const enManual = tracks.find((t) => t.snippet.language === 'en');
    const track = enAuto || enManual || tracks[0];

    // Step 2: Fetch transcript via the timedtext endpoint (no OAuth needed)
    const lang = track.snippet.language;
    const ttUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
    const ttRes = await fetch(ttUrl);
    if (!ttRes.ok) {
      return NextResponse.json({
        error: 'Could not fetch transcript',
        detail: 'The timedtext endpoint returned an error. The video may not have downloadable captions.',
      }, { status: 502 });
    }

    const xml = await ttRes.text();
    const segments = parseTimedTextXml(xml);

    if (segments.length === 0) {
      return NextResponse.json({
        error: 'Transcript is empty',
        detail: 'Captions were found but contained no text segments.',
      }, { status: 404 });
    }

    // Step 3: Save transcript to lesson
    const { error: updateError } = await db
      .from('lessons')
      .update({ transcript_content: segments, updated_at: new Date().toISOString() })
      .eq('id', lessonId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      language: lang,
      trackKind: track.snippet.trackKind,
      segmentCount: segments.length,
      segments,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch captions', detail: String(err) }, { status: 500 });
  }
}
