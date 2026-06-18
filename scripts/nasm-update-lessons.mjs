// scripts/nasm-update-lessons.mjs
// Re-sync an already-loaded module's lesson bodies (and quiz_content) from the
// local files, when drafts were edited after loading. Matches the module by
// title and lessons by order (never filters Supabase by `order`, which is a
// reserved word). Scoped to the manifest's course id.
//
// Run: node --env-file=.env.local scripts/nasm-update-lessons.mjs docs/nasm-curriculum/ch01

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const moduleDir = process.argv[2];
if (!moduleDir) { console.error('Usage: nasm-update-lessons.mjs <moduleDir>'); process.exit(1); }
const DIR = resolve(moduleDir);
const manifest = JSON.parse(readFileSync(join(DIR, '_manifest.json'), 'utf8'));
const { courseId, module: mod, lessons } = manifest;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

function lessonBody(file) {
  const raw = readFileSync(join(DIR, file), 'utf8');
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i]?.startsWith('# ')) { i++; while (i < lines.length && lines[i].trim() === '') i++; }
  return lines.slice(i).join('\n').trim();
}

async function main() {
  const { data: mods } = await db.from('course_modules').select('id, title').eq('course_id', courseId);
  const moduleId = (mods ?? []).find((m) => m.title.toLowerCase().trim() === mod.title.toLowerCase().trim())?.id;
  if (!moduleId) { console.error('Module not found:', mod.title); process.exit(1); }

  const { data: rows } = await db.from('lessons').select('id, title, order, lesson_type').eq('course_id', courseId).eq('module_id', moduleId);
  const byOrder = new Map((rows ?? []).map((r) => [r.order, r]));

  let updated = 0; const errors = [];
  for (const L of lessons) {
    const row = byOrder.get(L.order);
    if (!row) { errors.push(`order ${L.order} not in DB`); continue; }
    const payload = {};
    if (L.type === 'quiz') payload.quiz_content = JSON.parse(readFileSync(join(DIR, L.quizFile), 'utf8'));
    else payload.text_content = lessonBody(L.file);
    const { error } = await db.from('lessons').update(payload).eq('id', row.id);
    if (error) errors.push(`L${L.order}: ${error.message}`);
    else { updated++; console.log(`  ~ updated L${L.order} (${L.type}) ${row.title}`); }
  }
  console.log(`\nUpdated ${updated} lessons. ${errors.length ? 'Errors: ' + JSON.stringify(errors) : 'No errors.'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
