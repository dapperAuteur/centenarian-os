// scripts/nasm-academy-load.mjs
// Service-role loader for the NASM CPT7 Fast Track course. Mirrors the insert
// logic of app/api/academy/courses/[id]/import/route.ts, but runs headless with
// the service-role key. Create mode only (additive): existing lessons at a
// module+order slot are skipped, never overwritten. Scoped to one course id.
//
// Run: node --env-file=.env.local scripts/nasm-academy-load.mjs
//
// Loads one module of text + quiz lessons from a lessons dir, plus one
// module-scoped graded assignment. Re-runnable: skips anything already present.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const COURSE_ID = '86891884-1cac-49af-8ed5-d21893312623';
const MODULE_TITLE = 'Chapter 13: Integrated Training and the OPT Model';
const MODULE_ORDER = 13;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PILOT = join(__dirname, '..', 'docs', 'nasm-curriculum', 'ch13-pilot');
const LESSONS = join(PILOT, 'lessons');

// order, file, title, type, duration, free
const LESSONS_SPEC = [
  [1, '01-what-integrated-training-is.md', 'What Integrated Training Is, and Why the Exam Loves It', 'text', 420, true],
  [2, '02-seven-components-part-1.md', 'The 7 Training Components, Part 1 (Flexibility, Cardio, Core)', 'text', 420, false],
  [3, '03-seven-components-part-2.md', 'The 7 Training Components, Part 2 (Balance, Plyometric, SAQ, Resistance)', 'text', 420, false],
  [4, '04-opt-levels-vs-phases.md', 'The OPT Model: 3 Levels vs 5 Phases', 'text', 420, false],
  [5, '05-phase-by-phase.md', 'Phase by Phase: Stabilization to Strength to Power', 'text', 420, false],
  [6, '06-five-movement-patterns.md', 'The 5 Fundamental Movement Patterns', 'text', 420, false],
  [7, '07-acute-variables.md', 'Acute Variables, the Dials You Turn', 'text', 420, false],
  [8, '08-choosing-the-phase.md', 'Choosing the Right Phase for a Real Client', 'text', 420, false],
  [9, '09-module-review.md', 'Module Review: Your OPT Cheat Sheet in Your Head', 'text', 360, false],
  [10, '10-on-the-test.md', 'On the Test: How the Exam Asks About the OPT Model', 'text', 480, false],
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// Read a lesson file and strip the leading "# H1" line (the lesson title field
// shows the title; keeping the H1 would double it).
function lessonBody(file) {
  const raw = readFileSync(join(LESSONS, file), 'utf8');
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
  // 0. Confirm course exists and is ours.
  const { data: course } = await db
    .from('courses').select('id, title, price_type').eq('id', COURSE_ID).maybeSingle();
  if (!course) { console.error('Course not found:', COURSE_ID); process.exit(1); }
  console.log('Course:', course.title);

  // 1. Module: reuse by title (case-insensitive) or create.
  const { data: mods } = await db
    .from('course_modules').select('id, title, order').eq('course_id', COURSE_ID);
  let moduleId = (mods ?? []).find((m) => m.title.toLowerCase().trim() === MODULE_TITLE.toLowerCase())?.id;
  if (moduleId) {
    console.log('Module exists, reusing:', moduleId);
  } else {
    const { data: nm, error } = await db
      .from('course_modules')
      .insert({ course_id: COURSE_ID, title: MODULE_TITLE, order: MODULE_ORDER })
      .select('id').single();
    if (error) { console.error('Module insert failed:', error.message); process.exit(1); }
    moduleId = nm.id;
    console.log('Module created:', moduleId);
  }

  // 2. Existing lessons in this module (create-mode skip set).
  const { data: existing } = await db
    .from('lessons').select('id, order').eq('course_id', COURSE_ID).eq('module_id', moduleId);
  const taken = new Set((existing ?? []).map((l) => l.order));

  const isFreeCourse = course.price_type === 'free';
  const stats = { created: 0, skipped: 0, errors: [] };

  // 3. Text lessons.
  for (const [order, file, title, type, duration, free] of LESSONS_SPEC) {
    if (taken.has(order)) { stats.skipped++; continue; }
    const { error } = await db.from('lessons').insert({
      course_id: COURSE_ID,
      module_id: moduleId,
      title,
      lesson_type: type,
      text_content: lessonBody(file),
      content_format: 'markdown',
      duration_seconds: duration,
      order,
      is_free_preview: free || isFreeCourse,
    });
    if (error) stats.errors.push(`L${order} ${title}: ${error.message}`);
    else { stats.created++; console.log(`  + L${order} ${title}`); }
  }

  // 4. Quiz lesson (order 11).
  if (taken.has(11)) {
    stats.skipped++;
  } else {
    const quiz = JSON.parse(readFileSync(join(PILOT, '_quiz-content.json'), 'utf8'));
    const { error } = await db.from('lessons').insert({
      course_id: COURSE_ID,
      module_id: moduleId,
      title: 'Module 13 Quiz: Integrated Training and the OPT Model',
      lesson_type: 'quiz',
      text_content: 'Twelve questions on integrated training and the OPT model. You need 80% to pass, and you can retake it as many times as you like. Read each explanation, the wrong-answer reasons are the best study material.',
      content_format: 'markdown',
      order: 11,
      is_free_preview: isFreeCourse,
      quiz_content: quiz,
    });
    if (error) stats.errors.push(`L11 quiz: ${error.message}`);
    else { stats.created++; console.log('  + L11 Module 13 Quiz (12 questions)'); }
  }

  // 5. Module-scoped graded assignment (skip if same title exists).
  const ASSIGN_TITLE = 'Program a Client Through the OPT Model';
  const { data: existingAssign } = await db
    .from('assignments').select('id, title').eq('course_id', COURSE_ID).eq('title', ASSIGN_TITLE).maybeSingle();
  if (existingAssign) {
    console.log('Assignment exists, skipping');
  } else {
    const description = readFileSync(join(PILOT, '_assignment.md'), 'utf8');
    const { error } = await db.from('assignments').insert({
      course_id: COURSE_ID,
      title: ASSIGN_TITLE,
      description,
      scope: 'module',
      module_id: moduleId,
    });
    if (error) stats.errors.push(`assignment: ${error.message}`);
    else console.log('  + Assignment: Program a Client Through the OPT Model');
  }

  console.log('\nStats:', JSON.stringify(stats));

  // 6. Readback verification.
  const { data: check } = await db
    .from('lessons')
    .select('order, title, lesson_type, is_free_preview, quiz_content')
    .eq('course_id', COURSE_ID).eq('module_id', moduleId)
    .order('order', { ascending: true });
  console.log(`\nModule now has ${check?.length ?? 0} lessons:`);
  for (const l of check ?? []) {
    const q = l.quiz_content?.questions?.length ? ` [quiz: ${l.quiz_content.questions.length} Q]` : '';
    console.log(`  ${String(l.order).padStart(2)}. (${l.lesson_type}) ${l.title}${l.is_free_preview ? ' [free]' : ''}${q}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
