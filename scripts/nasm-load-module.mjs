// scripts/nasm-load-module.mjs
// Generic, manifest-driven service-role loader for one NASM CPT7 module.
// Mirrors the import route insert logic; create mode (additive), scoped to the
// course id in the manifest. Re-runnable: skips lessons already at a module+order
// slot and an assignment with the same title.
//
// Run: node --env-file=.env.local scripts/nasm-load-module.mjs docs/nasm-curriculum/ch01
//
// The module dir must contain `_manifest.json`:
// {
//   "courseId": "86891884-...",
//   "module": { "title": "Chapter 1: ...", "order": 1 },
//   "lessons": [
//     { "order": 1, "file": "lessons/01-x.md", "title": "...", "type": "text", "duration": 420, "free": true },
//     { "order": 9, "title": "Module 1 Quiz: ...", "type": "quiz", "quizFile": "_quiz-content.json" }
//   ],
//   "assignment": { "title": "...", "descriptionFile": "_assignment.md" }   // optional
// }

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const moduleDir = process.argv[2];
if (!moduleDir) { console.error('Usage: nasm-load-module.mjs <moduleDir>'); process.exit(1); }
const DIR = resolve(moduleDir);
const manifest = JSON.parse(readFileSync(join(DIR, '_manifest.json'), 'utf8'));
const { courseId, module: mod, lessons, assignment } = manifest;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// Strip a leading "# H1" line (the lesson title field renders the title).
function lessonBody(file) {
  const raw = readFileSync(join(DIR, file), 'utf8');
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i]?.startsWith('# ')) {
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
  }
  return lines.slice(i).join('\n').trim();
}

async function main() {
  const { data: course } = await db
    .from('courses').select('id, title, price_type').eq('id', courseId).maybeSingle();
  if (!course) { console.error('Course not found:', courseId); process.exit(1); }
  console.log('Course:', course.title);
  const isFreeCourse = course.price_type === 'free';

  // Module: reuse by title (case-insensitive) or create.
  const { data: mods } = await db
    .from('course_modules').select('id, title').eq('course_id', courseId);
  let moduleId = (mods ?? []).find((m) => m.title.toLowerCase().trim() === mod.title.toLowerCase().trim())?.id;
  if (moduleId) {
    console.log('Module exists, reusing:', moduleId);
  } else {
    const { data: nm, error } = await db
      .from('course_modules').insert({ course_id: courseId, title: mod.title, order: mod.order })
      .select('id').single();
    if (error) { console.error('Module insert failed:', error.message); process.exit(1); }
    moduleId = nm.id;
    console.log(`Module created: ${moduleId} (${mod.title}, order ${mod.order})`);
  }

  const { data: existing } = await db
    .from('lessons').select('order').eq('course_id', courseId).eq('module_id', moduleId);
  const taken = new Set((existing ?? []).map((l) => l.order));

  const stats = { created: 0, skipped: 0, errors: [] };
  for (const L of lessons) {
    if (taken.has(L.order)) { stats.skipped++; continue; }
    const row = {
      course_id: courseId,
      module_id: moduleId,
      title: L.title,
      lesson_type: L.type,
      content_format: 'markdown',
      order: L.order,
      is_free_preview: !!L.free || isFreeCourse,
      duration_seconds: L.duration ?? null,
    };
    if (L.type === 'quiz') {
      row.quiz_content = JSON.parse(readFileSync(join(DIR, L.quizFile), 'utf8'));
      row.text_content = L.intro ?? 'Answer each question, then read the explanation. You can retake this as many times as you like.';
    } else {
      row.text_content = lessonBody(L.file);
    }
    const { error } = await db.from('lessons').insert(row);
    if (error) stats.errors.push(`L${L.order} ${L.title}: ${error.message}`);
    else { stats.created++; console.log(`  + L${L.order} (${L.type}) ${L.title}`); }
  }

  if (assignment) {
    const { data: ex } = await db
      .from('assignments').select('id').eq('course_id', courseId).eq('title', assignment.title).maybeSingle();
    if (ex) {
      console.log('Assignment exists, skipping');
    } else {
      const { error } = await db.from('assignments').insert({
        course_id: courseId,
        title: assignment.title,
        description: readFileSync(join(DIR, assignment.descriptionFile), 'utf8'),
        scope: 'module',
        module_id: moduleId,
      });
      if (error) stats.errors.push(`assignment: ${error.message}`);
      else console.log(`  + Assignment: ${assignment.title}`);
    }
  }

  console.log('\nStats:', JSON.stringify(stats));
  const { data: check } = await db
    .from('lessons').select('order, title, lesson_type, quiz_content')
    .eq('course_id', courseId).eq('module_id', moduleId).order('order', { ascending: true });
  console.log(`Module now has ${check?.length ?? 0} lessons:`);
  for (const l of check ?? []) {
    const q = l.quiz_content?.questions?.length ? ` [${l.quiz_content.questions.length} Q, ${l.quiz_content.questionsPerAttempt ?? 'all'}/attempt]` : '';
    console.log(`  ${String(l.order).padStart(2)}. (${l.lesson_type}) ${l.title}${q}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
