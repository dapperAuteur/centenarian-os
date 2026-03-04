// app/api/teaching/learning-paths/suggest/route.ts
// POST — Gemini suggests 2-3 learning path groupings from the teacher's published courses.
// Returns draft path suggestions the teacher can accept, edit, or discard.

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

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'teacher' && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Teacher account required' }, { status: 403 });
  }

  const db = getDb();
  const { data: courses, error } = await db
    .from('courses')
    .select('id, title, description, category, tags')
    .eq('teacher_id', user.id)
    .eq('is_published', true)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!courses || courses.length < 2) {
    return NextResponse.json(
      { error: 'You need at least 2 published courses to generate path suggestions.' },
      { status: 400 }
    );
  }

  const courseList = courses.map((c, i) =>
    `${i + 1}. "${c.title}" (ID: ${c.id})${c.description ? ` — ${c.description.slice(0, 120)}` : ''}${c.category ? ` [${c.category}]` : ''}`
  ).join('\n');

  const prompt = `You are an educational curriculum designer. A teacher has published the following courses on CentenarianOS, a health and longevity education platform:

${courseList}

Suggest 2–3 logical learning path groupings from these courses. Each path should have a clear progression or thematic connection. Return ONLY a valid JSON array (no markdown) in this exact format:

[
  {
    "title": "Path title",
    "description": "1-2 sentence description of what this path teaches and why these courses belong together",
    "course_ids": ["course-uuid-1", "course-uuid-2"]
  }
]

Rules:
- Only use course IDs from the list above
- Each path should have 2 or more courses
- Courses may appear in multiple paths if they fit multiple themes
- Titles should be clear and student-facing`;

  let suggestions: { title: string; description: string; course_ids: string[] }[] = [];
  try {
    const raw = await callGemini(prompt);
    suggestions = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response. Please try again.' }, { status: 500 });
  }

  // Attach full course objects to each suggestion for the UI
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const enriched = suggestions.map((s) => ({
    ...s,
    courses: (s.course_ids || [])
      .map((id) => courseMap.get(id))
      .filter(Boolean),
  }));

  return NextResponse.json({ suggestions: enriched });
}
