// app/api/academy/courses/[id]/export/route.ts
// GET: Export course modules + lessons as CSV matching the import template format.

import { NextRequest } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { csvEscape } from '@/lib/csv/helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Verify ownership or admin
  const { data: course } = await db
    .from('courses')
    .select('id, title, teacher_id')
    .eq('id', courseId)
    .single();

  if (!course) return new Response('Not found', { status: 404 });
  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return new Response('Forbidden', { status: 403 });
  }

  // Fetch modules
  const { data: modules } = await db
    .from('course_modules')
    .select('id, title, order')
    .eq('course_id', courseId)
    .order('order', { ascending: true });

  const moduleMap = new Map<string, { title: string; order: number }>();
  for (const m of modules ?? []) {
    moduleMap.set(m.id, { title: m.title, order: m.order });
  }

  // Fetch all lessons
  const { data: lessons } = await db
    .from('lessons')
    .select('module_id, title, lesson_type, duration_seconds, is_free_preview, content_url, text_content, content_format, audio_chapters, transcript_content, map_content, documents, podcast_links, quiz_content, order')
    .eq('course_id', courseId)
    .order('order', { ascending: true });

  const headers = [
    'module_title', 'module_order', 'lesson_order', 'title', 'lesson_type',
    'duration_seconds', 'is_free_preview', 'content_url', 'text_content',
    'content_format', 'audio_chapters', 'transcript_content', 'map_content',
    'documents', 'podcast_links', 'quiz_content',
  ];

  const rows = (lessons ?? []).map((l) => {
    const mod = l.module_id ? moduleMap.get(l.module_id) : null;
    return [
      mod?.title ?? '',
      mod ? String(mod.order) : '',
      String(l.order ?? ''),
      l.title ?? '',
      l.lesson_type ?? '',
      l.duration_seconds != null ? String(l.duration_seconds) : '',
      l.is_free_preview ? 'true' : 'false',
      l.content_url ?? '',
      l.text_content ?? '',
      l.content_format ?? 'markdown',
      l.audio_chapters ? JSON.stringify(l.audio_chapters) : '',
      l.transcript_content ? JSON.stringify(l.transcript_content) : '',
      l.map_content ? JSON.stringify(l.map_content) : '',
      l.documents ? JSON.stringify(l.documents) : '',
      l.podcast_links ? JSON.stringify(l.podcast_links) : '',
      l.quiz_content ? JSON.stringify(l.quiz_content) : '',
    ];
  });

  const headerLine = headers.join(',');
  const csvRows = rows.map((row) => row.map((v) => csvEscape(v)).join(','));
  const csv = [headerLine, ...csvRows].join('\n');

  const safeTitle = course.title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').substring(0, 50);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeTitle}-export.csv"`,
    },
  });
}
