// app/api/academy/paths/recommend/route.ts
// GET — returns top 3 learning paths recommended for the current student,
//       ranked by Gemini based on their enrollment history.

import { NextResponse } from 'next/server';
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
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
}

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Fetch student enrollment history (course titles they've taken)
  const [{ data: enrollments }, { data: paths }] = await Promise.all([
    db
      .from('enrollments')
      .select('course_id, courses(title, category, tags)')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    db
      .from('learning_paths')
      .select(`
        id, title, description,
        learning_path_courses(
          courses(title, category)
        )
      `)
      .eq('is_published', true),
  ]);

  if (!paths || paths.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  // If no enrollment history, return the first 3 paths (newest) without AI ranking
  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({
      recommendations: paths.slice(0, 3).map((p) => ({
        ...p,
        reason: 'Start your learning journey with this path.',
      })),
    });
  }

  type CourseInfo = { title?: string; category?: string };
  type EnrollmentRow = { course_id: string; courses?: CourseInfo | CourseInfo[] | null };

  const history = (enrollments as EnrollmentRow[]).map((e) => {
    const c = Array.isArray(e.courses) ? e.courses[0] : e.courses;
    return c?.title ?? 'Unknown Course';
  }).join(', ');

  const pathList = paths.map((p, i) => {
    type PathCourseRow = { courses?: CourseInfo | CourseInfo[] | null };
    const courseNames = ((p.learning_path_courses as PathCourseRow[]) || [])
      .map((lpc) => {
        const c = Array.isArray(lpc.courses) ? lpc.courses[0] : lpc.courses;
        return c?.title ?? '';
      })
      .filter(Boolean)
      .join(', ');
    return `${i + 1}. "${p.title}" (ID: ${p.id}) — ${p.description ?? ''} [Courses: ${courseNames}]`;
  }).join('\n');

  const prompt = `You are a personalized learning advisor on CentenarianOS, a health and longevity education platform.

A student has completed or enrolled in these courses: ${history}

Here are the available learning paths:
${pathList}

Rank the top 3 most relevant learning paths for this student based on their history. Return ONLY valid JSON (no markdown):

[
  {
    "path_id": "uuid-here",
    "reason": "One sentence explaining why this path fits their learning journey"
  }
]

Only include paths from the list above. Do not invent path IDs.`;

  let ranked: { path_id: string; reason: string }[] = [];
  try {
    const raw = await callGemini(prompt);
    ranked = JSON.parse(raw);
  } catch {
    // Fallback: return first 3 without AI reason
    return NextResponse.json({
      recommendations: paths.slice(0, 3).map((p) => ({
        ...p,
        reason: null,
      })),
    });
  }

  const pathMap = new Map(paths.map((p) => [p.id, p]));
  const recommendations = ranked
    .map((r) => {
      const path = pathMap.get(r.path_id);
      if (!path) return null;
      return { ...path, reason: r.reason };
    })
    .filter(Boolean)
    .slice(0, 3);

  return NextResponse.json({ recommendations });
}
