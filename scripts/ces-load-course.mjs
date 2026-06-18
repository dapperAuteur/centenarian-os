// scripts/ces-load-course.mjs
// Service-role bulk loader for a course-import CSV. Mirrors the logic of
// app/api/academy/courses/[id]/import/route.ts but runs headless with the service
// role key (the HTTP route needs a logged-in session). Additive and scoped to one
// course id. Fixes the module_order=0 / lesson_order=0 parse bug from the route
// (parseInt(x) || fallback drops a real 0).
//
// Usage:
//   node --env-file=.env.local scripts/ces-load-course.mjs <courseId> <csvPath> [--mode create|upsert|replace] [--dry-run]
// Default mode: create (skip existing module+order slots, no deletes).

import fs from 'fs';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

const courseId = process.argv[2];
const csvPath = process.argv[3];
const modeArg = (process.argv.find((a) => a.startsWith('--mode')) || '').split('=')[1]
  || (process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : null);
const MODE = modeArg || 'create';
const DRY = process.argv.includes('--dry-run');

if (!courseId || !csvPath) {
  console.error('Usage: node --env-file=.env.local scripts/ces-load-course.mjs <courseId> <csvPath> [--mode create|upsert|replace] [--dry-run]');
  process.exit(2);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// parse int but PRESERVE a real 0 (the route's `parseInt||fallback` bug drops it)
const intOr = (v, fallback) => { const n = parseInt(String(v ?? '').trim(), 10); return Number.isFinite(n) ? n : fallback; };
const tryJson = (v) => { if (!v || String(v).trim() === '') return null; try { return JSON.parse(v); } catch { return null; } };

async function main() {
  const { data: course, error: cErr } = await db.from('courses').select('id, teacher_id, price_type').eq('id', courseId).maybeSingle();
  if (cErr) { console.error('Course lookup failed:', cErr.message); process.exit(1); }
  if (!course) { console.error(`Course ${courseId} not found.`); process.exit(1); }

  const parsed = Papa.parse(fs.readFileSync(csvPath, 'utf8'), { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  if (!rows.length) { console.error('No rows in CSV.'); process.exit(1); }

  const stats = { mode: MODE, dryRun: DRY, modules_created: 0, lessons_created: 0, lessons_updated: 0, lessons_skipped: 0, errors: [] };

  if (MODE === 'replace' && !DRY) {
    await db.from('lessons').delete().eq('course_id', courseId);
    await db.from('course_modules').delete().eq('course_id', courseId);
    await db.from('courses').update({ stripe_price_id: null, stripe_product_id: null }).eq('id', courseId);
  }

  const { data: existingModules } = await db.from('course_modules').select('id, title, order').eq('course_id', courseId).order('order', { ascending: true });
  const moduleMap = new Map();
  for (const m of existingModules ?? []) moduleMap.set(m.title.toLowerCase().trim(), m.id);

  const { data: existingLessons } = await db.from('lessons').select('id, title, order, module_id').eq('course_id', courseId);
  const lessonsByKey = new Map();
  for (const l of existingLessons ?? []) lessonsByKey.set(`${l.module_id || 'null'}:${l.order}`, l.id);

  const isFreeCourse = course.price_type === 'free';

  // create missing modules (preserve module_order 0)
  const moduleTitles = [...new Set(rows.map((r) => r.module_title?.trim()).filter(Boolean))];
  let nextModuleOrder = (existingModules ?? []).length;
  for (const mt of moduleTitles) {
    if (moduleMap.has(mt.toLowerCase())) continue;
    const moduleOrder = intOr(rows.find((r) => r.module_title?.trim() === mt)?.module_order, nextModuleOrder);
    if (DRY) { console.log(`[dry] create module "${mt}" order=${moduleOrder}`); moduleMap.set(mt.toLowerCase(), `dry-${nextModuleOrder}`); stats.modules_created++; nextModuleOrder++; continue; }
    const { data: nm, error } = await db.from('course_modules').insert({ course_id: courseId, title: mt, order: moduleOrder }).select('id').single();
    if (error) stats.errors.push(`Module "${mt}": ${error.message}`);
    else { moduleMap.set(mt.toLowerCase(), nm.id); stats.modules_created++; }
    nextModuleOrder++;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const title = row.title?.trim();
    if (!title) { stats.errors.push(`Row ${i + 1}: missing title, skipped`); continue; }
    const moduleName = row.module_title?.trim();
    const moduleId = moduleName ? moduleMap.get(moduleName.toLowerCase()) ?? null : null;
    const lessonOrder = intOr(row.lesson_order ?? row.order, i);
    const lessonType = row.lesson_type?.trim() || 'video';
    const durationSeconds = intOr(row.duration_seconds, null);
    const isFreePreview = row.is_free_preview?.trim().toLowerCase() === 'true' || isFreeCourse;
    const contentUrl = row.content_url?.trim() || null;
    const textContent = row.text_content?.trim() || null;
    const contentFormat = row.content_format?.trim() || 'markdown';
    const audioChapters = tryJson(row.audio_chapters);
    const transcriptContent = tryJson(row.transcript_content);
    const mapContent = tryJson(row.map_content);
    let documents = tryJson(row.documents);
    const podcastLinks = tryJson(row.podcast_links);
    const quizContent = tryJson(row.quiz_content);

    if (Array.isArray(documents)) {
      const bad = documents.filter((d) => { try { const u = new URL(d?.url || ''); return u.protocol !== 'http:' && u.protocol !== 'https:'; } catch { return !!d?.url; } });
      if (bad.length) { stats.errors.push(`Row ${i + 1} "${title}": ${bad.length} non-absolute document URL(s) — documents dropped. First: "${bad[0]?.url}".`); documents = null; }
    }

    const lessonData = {
      course_id: courseId, module_id: moduleId, title, lesson_type: lessonType,
      content_url: contentUrl, text_content: textContent, content_format: contentFormat,
      duration_seconds: durationSeconds, order: lessonOrder, is_free_preview: isFreePreview,
      ...(audioChapters ? { audio_chapters: audioChapters } : {}),
      ...(transcriptContent ? { transcript_content: transcriptContent } : {}),
      ...(mapContent ? { map_content: mapContent } : {}),
      ...(documents ? { documents } : {}),
      ...(podcastLinks ? { podcast_links: podcastLinks } : {}),
      ...(quizContent ? { quiz_content: quizContent } : {}),
    };

    const k = `${moduleId || 'null'}:${lessonOrder}`;
    const existsId = lessonsByKey.get(k);

    if (existsId && existsId !== 'new') {
      if (MODE === 'upsert') {
        const upd = {};
        if (row.title?.trim()) upd.title = title;
        if (row.lesson_type?.trim()) upd.lesson_type = lessonType;
        if (row.content_url?.trim()) upd.content_url = contentUrl;
        if (row.text_content?.trim()) upd.text_content = textContent;
        if (row.content_format?.trim()) upd.content_format = contentFormat;
        if (row.duration_seconds?.trim()) upd.duration_seconds = durationSeconds;
        if (row.is_free_preview?.trim()) upd.is_free_preview = isFreePreview;
        if (row.lesson_order?.trim() || row.order?.trim()) upd.order = lessonOrder;
        if (row.module_title?.trim() && moduleId) upd.module_id = moduleId;
        if (audioChapters) upd.audio_chapters = audioChapters;
        if (transcriptContent) upd.transcript_content = transcriptContent;
        if (mapContent) upd.map_content = mapContent;
        if (documents) upd.documents = documents;
        if (podcastLinks) upd.podcast_links = podcastLinks;
        if (quizContent) upd.quiz_content = quizContent;
        if (!Object.keys(upd).length) { stats.lessons_skipped++; continue; }
        if (DRY) { console.log(`[dry] update "${title}" (${Object.keys(upd).join(',')})`); stats.lessons_updated++; continue; }
        const { error } = await db.from('lessons').update(upd).eq('id', existsId);
        if (error) stats.errors.push(`Row ${i + 1} "${title}": ${error.message}`); else stats.lessons_updated++;
      } else { stats.lessons_skipped++; }
    } else {
      if (DRY) { console.log(`[dry] create ${lessonType} "${title}" mod="${moduleName}" order=${lessonOrder} free=${isFreePreview}`); stats.lessons_created++; lessonsByKey.set(k, 'new'); continue; }
      const { error } = await db.from('lessons').insert(lessonData);
      if (error) stats.errors.push(`Row ${i + 1} "${title}": ${error.message}`);
      else { stats.lessons_created++; lessonsByKey.set(k, 'new'); }
    }
  }

  console.log(JSON.stringify(stats, null, 2));
  if (stats.errors.length) { console.log(`\n${stats.errors.length} error(s) above.`); }
}

main().catch((e) => { console.error(e); process.exit(1); });
