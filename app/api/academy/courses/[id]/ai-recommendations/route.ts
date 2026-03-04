// app/api/academy/courses/[id]/ai-recommendations/route.ts
// GET: AI-generated course recommendations (cached 24h)
// POST: force-refresh recommendations (teacher only)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const GEMINI_MODEL = 'gemini-2.5-flash';

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const json = await res.json() as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
}

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

interface AiRec {
  course_id: string;
  reason: string;
}

interface AiRecommendations {
  before: AiRec[];
  after: AiRec[];
}

async function generateRecommendations(db: ReturnType<typeof getDb>, courseId: string): Promise<AiRecommendations> {
  // Get current course
  const { data: course } = await db
    .from('courses')
    .select('title, description, category, tags')
    .eq('id', courseId)
    .single();

  if (!course) return { before: [], after: [] };

  // Get all other published courses
  const { data: allCourses } = await db
    .from('courses')
    .select('id, title, description, category')
    .eq('is_published', true)
    .neq('id', courseId)
    .limit(100);

  if (!allCourses || allCourses.length === 0) return { before: [], after: [] };

  const courseList = allCourses
    .map((c, i) => `${i + 1}. "${c.title}" (ID: ${c.id}) — ${c.description?.slice(0, 100) || 'No description'} [Category: ${c.category || 'None'}]`)
    .join('\n');

  const prompt = `You are a learning advisor on CentenarianOS, a health and longevity education platform.

Current course: "${course.title}"
Description: ${course.description || 'None'}
Category: ${course.category || 'General'}
Tags: ${(course.tags as string[])?.join(', ') || 'None'}

Available courses on the platform:
${courseList}

Recommend up to 3 courses students should take BEFORE this course (prerequisites/foundations) and up to 3 courses to take AFTER this course (next steps/advanced topics).

Return ONLY valid JSON:
{
  "before": [{ "course_id": "uuid", "reason": "One sentence why" }],
  "after": [{ "course_id": "uuid", "reason": "One sentence why" }]
}

Only include courses from the list above. If no good matches, return empty arrays.`;

  const raw = await callGemini(prompt);
  const parsed = JSON.parse(raw) as AiRecommendations;

  // Validate course IDs exist
  const validIds = new Set(allCourses.map((c) => c.id));
  return {
    before: (parsed.before ?? []).filter((r) => validIds.has(r.course_id)),
    after: (parsed.after ?? []).filter((r) => validIds.has(r.course_id)),
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const db = getDb();

  // Check cache
  const { data: course } = await db
    .from('courses')
    .select('ai_recommendations, ai_recommendations_at')
    .eq('id', courseId)
    .single();

  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const cacheAge = course.ai_recommendations_at
    ? Date.now() - new Date(course.ai_recommendations_at).getTime()
    : Infinity;

  if (course.ai_recommendations && cacheAge < 24 * 60 * 60 * 1000) {
    // Resolve titles for cached recommendations
    const recs = course.ai_recommendations as AiRecommendations;
    const allIds = [...(recs.before ?? []), ...(recs.after ?? [])].map((r) => r.course_id);
    const { data: courses } = await db
      .from('courses')
      .select('id, title, cover_image_url')
      .in('id', allIds);
    const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));

    return NextResponse.json({
      before: (recs.before ?? []).map((r) => ({ ...r, title: courseMap.get(r.course_id)?.title ?? 'Unknown', cover_image_url: courseMap.get(r.course_id)?.cover_image_url ?? null })),
      after: (recs.after ?? []).map((r) => ({ ...r, title: courseMap.get(r.course_id)?.title ?? 'Unknown', cover_image_url: courseMap.get(r.course_id)?.cover_image_url ?? null })),
      cached: true,
    });
  }

  // Generate fresh
  try {
    const recs = await generateRecommendations(db, courseId);

    // Cache
    await db
      .from('courses')
      .update({ ai_recommendations: recs, ai_recommendations_at: new Date().toISOString() })
      .eq('id', courseId);

    // Resolve titles
    const allIds = [...recs.before, ...recs.after].map((r) => r.course_id);
    const { data: courses } = await db
      .from('courses')
      .select('id, title, cover_image_url')
      .in('id', allIds.length > 0 ? allIds : ['__none__']);
    const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));

    return NextResponse.json({
      before: recs.before.map((r) => ({ ...r, title: courseMap.get(r.course_id)?.title ?? 'Unknown', cover_image_url: courseMap.get(r.course_id)?.cover_image_url ?? null })),
      after: recs.after.map((r) => ({ ...r, title: courseMap.get(r.course_id)?.title ?? 'Unknown', cover_image_url: courseMap.get(r.course_id)?.cover_image_url ?? null })),
      cached: false,
    });
  } catch {
    return NextResponse.json({ before: [], after: [], cached: false });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify teacher ownership
  const { data: course } = await db.from('courses').select('teacher_id').eq('id', courseId).single();
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Force regenerate
  try {
    const recs = await generateRecommendations(db, courseId);
    await db
      .from('courses')
      .update({ ai_recommendations: recs, ai_recommendations_at: new Date().toISOString() })
      .eq('id', courseId);

    const allIds = [...recs.before, ...recs.after].map((r) => r.course_id);
    const { data: courses } = await db
      .from('courses')
      .select('id, title, cover_image_url')
      .in('id', allIds.length > 0 ? allIds : ['__none__']);
    const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _body = await request.text();

    return NextResponse.json({
      before: recs.before.map((r) => ({ ...r, title: courseMap.get(r.course_id)?.title ?? 'Unknown', cover_image_url: courseMap.get(r.course_id)?.cover_image_url ?? null })),
      after: recs.after.map((r) => ({ ...r, title: courseMap.get(r.course_id)?.title ?? 'Unknown', cover_image_url: courseMap.get(r.course_id)?.cover_image_url ?? null })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AI generation failed' }, { status: 500 });
  }
}
