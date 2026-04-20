// app/api/academy/courses/[id]/import/route.ts
// POST: Bulk import modules + lessons from parsed CSV data.
// Accepts { rows: Record<string, string>[], mode: 'create' | 'upsert' }
// - Creates modules from unique module_title values (or reuses existing)
// - Creates or updates lessons within those modules
// - mode 'create' = skip existing lessons by order; 'upsert' = overwrite

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

function tryParseJson(val: string | undefined | null): unknown | null {
  if (!val || val.trim() === '') return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: course } = await db
    .from('courses')
    .select('teacher_id, price_type')
    .eq('id', courseId)
    .single();

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  if (course.teacher_id !== user.id && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const rows: Record<string, string>[] = body.rows;
  const mode: 'create' | 'upsert' | 'replace' = body.mode || 'create';

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }

  // Replace mode: delete all existing lessons, modules, and related progress
  if (mode === 'replace') {
    // Delete lessons first (cascades lesson_progress, lesson_embeddings, etc.)
    await db.from('lessons').delete().eq('course_id', courseId);
    // Delete modules
    await db.from('course_modules').delete().eq('course_id', courseId);
    // Clear cached stripe price/product so they get recreated if course price changes
    await db.from('courses').update({ stripe_price_id: null, stripe_product_id: null }).eq('id', courseId);
  }

  // Fetch existing modules for this course
  const { data: existingModules } = await db
    .from('course_modules')
    .select('id, title, order')
    .eq('course_id', courseId)
    .order('order', { ascending: true });

  const moduleMap = new Map<string, string>(); // title (lowercase) → id
  for (const m of existingModules ?? []) {
    moduleMap.set(m.title.toLowerCase().trim(), m.id);
  }

  // Fetch existing lessons for upsert matching
  const { data: existingLessons } = await db
    .from('lessons')
    .select('id, title, order, module_id')
    .eq('course_id', courseId);

  const lessonsByModuleAndOrder = new Map<string, string>(); // `${module_id}:${order}` → lesson id
  for (const l of existingLessons ?? []) {
    lessonsByModuleAndOrder.set(`${l.module_id || 'null'}:${l.order}`, l.id);
  }

  const isCourseFreePricing = course.price_type === 'free';
  const stats = { replaced: mode === 'replace', modules_created: 0, lessons_created: 0, lessons_updated: 0, lessons_skipped: 0, errors: [] as string[] };

  // Group rows by module_title to create modules first
  const moduleTitles = new Set<string>();
  for (const row of rows) {
    const mt = row.module_title?.trim();
    if (mt) moduleTitles.add(mt);
  }

  // Create any missing modules
  let nextModuleOrder = (existingModules ?? []).length;
  for (const mt of moduleTitles) {
    if (!moduleMap.has(mt.toLowerCase())) {
      const moduleOrder = parseInt(rows.find(r => r.module_title?.trim() === mt)?.module_order || '') || nextModuleOrder;
      const { data: newMod, error: modErr } = await db
        .from('course_modules')
        .insert({ course_id: courseId, title: mt, order: moduleOrder })
        .select('id')
        .single();

      if (modErr) {
        stats.errors.push(`Module "${mt}": ${modErr.message}`);
      } else if (newMod) {
        moduleMap.set(mt.toLowerCase(), newMod.id);
        stats.modules_created++;
      }
      nextModuleOrder++;
    }
  }

  // Process each lesson row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = row.title?.trim();
    if (!title) {
      stats.errors.push(`Row ${i + 1}: missing title, skipped`);
      continue;
    }

    const moduleName = row.module_title?.trim();
    const moduleId = moduleName ? moduleMap.get(moduleName.toLowerCase()) ?? null : null;
    const lessonOrder = parseInt(row.lesson_order || row.order || '') || i;
    const lessonType = row.lesson_type?.trim() || 'video';
    const durationSeconds = parseInt(row.duration_seconds || '') || null;
    const isFreePreview = row.is_free_preview?.trim().toLowerCase() === 'true' || isCourseFreePricing;
    const contentUrl = row.content_url?.trim() || null;
    const textContent = row.text_content?.trim() || null;
    const contentFormat = row.content_format?.trim() || 'markdown';

    // Parse optional JSON fields
    const audioChapters = tryParseJson(row.audio_chapters);
    const transcriptContent = tryParseJson(row.transcript_content);
    const mapContent = tryParseJson(row.map_content);
    const rawDocuments = tryParseJson(row.documents);
    const podcastLinks = tryParseJson(row.podcast_links);
    const quizContent = tryParseJson(row.quiz_content);

    // Reject document entries whose url isn't an absolute http(s) URL.
    // Previous Coffee import saved local paths like "/docs/bvc/…" that
    // 404 at the viewer because they're not served by the Next app.
    // Import fails fast so the teacher can fix the CSV instead of
    // discovering broken docs on the student side later.
    let documents: unknown = rawDocuments;
    if (Array.isArray(rawDocuments)) {
      const invalid: Array<{ index: number; url: string; title: string }> = [];
      for (let di = 0; di < rawDocuments.length; di++) {
        const d = rawDocuments[di] as { url?: unknown; title?: unknown };
        const url = typeof d?.url === 'string' ? d.url : '';
        const title = typeof d?.title === 'string' ? d.title : '';
        if (!url) continue;
        try {
          const u = new URL(url);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            invalid.push({ index: di, url, title });
          }
        } catch {
          invalid.push({ index: di, url, title });
        }
      }
      if (invalid.length > 0) {
        stats.errors.push(
          `Row ${i + 1} "${title}": ${invalid.length} document URL${invalid.length === 1 ? '' : 's'} not absolute http(s) — skipped documents entirely. First bad: "${invalid[0].url}". Upload to Cloudinary and re-run with the returned https:// URLs.`,
        );
        documents = null;
      }
    }

    const lessonData: Record<string, unknown> = {
      course_id: courseId,
      module_id: moduleId,
      title,
      lesson_type: lessonType,
      content_url: contentUrl,
      text_content: textContent,
      content_format: contentFormat,
      duration_seconds: durationSeconds,
      order: lessonOrder,
      is_free_preview: isFreePreview,
      ...(audioChapters ? { audio_chapters: audioChapters } : {}),
      ...(transcriptContent ? { transcript_content: transcriptContent } : {}),
      ...(mapContent ? { map_content: mapContent } : {}),
      ...(documents ? { documents } : {}),
      ...(podcastLinks ? { podcast_links: podcastLinks } : {}),
      ...(quizContent ? { quiz_content: quizContent } : {}),
    };

    // Check if lesson already exists at this module+order slot
    const existingKey = `${moduleId || 'null'}:${lessonOrder}`;
    const existingLessonId = lessonsByModuleAndOrder.get(existingKey);

    if (existingLessonId) {
      if (mode === 'upsert') {
        // Update existing lesson
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { course_id, ...updateData } = lessonData;
        const { error: updateErr } = await db
          .from('lessons')
          .update(updateData)
          .eq('id', existingLessonId);

        if (updateErr) {
          stats.errors.push(`Row ${i + 1} "${title}": ${updateErr.message}`);
        } else {
          stats.lessons_updated++;
        }
      } else {
        stats.lessons_skipped++;
      }
    } else {
      // Create new lesson
      const { error: insertErr } = await db
        .from('lessons')
        .insert(lessonData);

      if (insertErr) {
        stats.errors.push(`Row ${i + 1} "${title}": ${insertErr.message}`);
      } else {
        stats.lessons_created++;
        // Track for dedup within this batch
        lessonsByModuleAndOrder.set(existingKey, 'new');
      }
    }
  }

  return NextResponse.json({
    success: true,
    stats,
    message: `${stats.replaced ? 'Replaced all content. ' : ''}Created ${stats.modules_created} modules, ${stats.lessons_created} lessons. Updated ${stats.lessons_updated}. Skipped ${stats.lessons_skipped}.${stats.errors.length > 0 ? ` ${stats.errors.length} errors.` : ''}`,
  });
}
