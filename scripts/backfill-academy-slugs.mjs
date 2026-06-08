#!/usr/bin/env node
// scripts/backfill-academy-slugs.mjs
// Backfills `slug` on existing academy courses (unique per teacher) and lessons
// (unique per course) so legacy rows get human-readable URLs. Idempotent — only
// touches rows where slug IS NULL. Run after migration 190.
//
// Usage: node --env-file=.env.local scripts/backfill-academy-slugs.mjs

import { createClient } from '@supabase/supabase-js';
import slugify from 'slugify';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE env vars. Run with: node --env-file=.env.local scripts/backfill-academy-slugs.mjs');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Keep in sync with lib/academy/slug.ts.
const RESERVED = new Set(['lesson', 'lessons', 'assignments', 'teachers', 'paths', 'explore', 'teach', 'my-courses', 'offline', 'verify']);

function baseSlug(title) {
  return slugify(title || '', { lower: true, strict: true, trim: true });
}
function courseBase(title) {
  const s = baseSlug(title) || 'course';
  return RESERVED.has(s) ? `${s}-course` : s;
}
function lessonBase(title) {
  return baseSlug(title) || 'lesson';
}

// Picks a unique slug given a Set of already-used slugs (mutated).
function uniqueWithin(used, base) {
  if (!used.has(base)) { used.add(base); return base; }
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  const out = `${base}-${n}`;
  used.add(out);
  return out;
}

async function backfillCourses() {
  const { data: courses, error } = await db
    .from('courses')
    .select('id, teacher_id, title, slug');
  if (error) throw error;

  // Seed used-slug sets per teacher from rows that already have a slug.
  const usedByTeacher = new Map();
  for (const c of courses) {
    if (!usedByTeacher.has(c.teacher_id)) usedByTeacher.set(c.teacher_id, new Set());
    if (c.slug) usedByTeacher.get(c.teacher_id).add(c.slug);
  }

  let updated = 0;
  for (const c of courses) {
    if (c.slug) continue;
    const used = usedByTeacher.get(c.teacher_id);
    const slug = uniqueWithin(used, courseBase(c.title));
    const { error: upErr } = await db.from('courses').update({ slug }).eq('id', c.id);
    if (upErr) { console.error(`  course ${c.id}: ${upErr.message}`); continue; }
    updated++;
    console.log(`  course ${c.id} -> ${slug}`);
  }
  console.log(`Courses: ${updated} updated, ${courses.length - updated} skipped/already-set.`);
}

async function backfillLessons() {
  const { data: lessons, error } = await db
    .from('lessons')
    .select('id, course_id, title, slug, order');
  if (error) throw error;

  const usedByCourse = new Map();
  for (const l of lessons) {
    if (!usedByCourse.has(l.course_id)) usedByCourse.set(l.course_id, new Set());
    if (l.slug) usedByCourse.get(l.course_id).add(l.slug);
  }

  // Stable ordering so collisions resolve deterministically across re-runs.
  lessons.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  let updated = 0;
  for (const l of lessons) {
    if (l.slug) continue;
    const used = usedByCourse.get(l.course_id);
    const slug = uniqueWithin(used, lessonBase(l.title));
    const { error: upErr } = await db.from('lessons').update({ slug }).eq('id', l.id);
    if (upErr) { console.error(`  lesson ${l.id}: ${upErr.message}`); continue; }
    updated++;
  }
  console.log(`Lessons: ${updated} updated, ${lessons.length - updated} skipped/already-set.`);
}

(async () => {
  console.log('Backfilling course slugs...');
  await backfillCourses();
  console.log('Backfilling lesson slugs...');
  await backfillLessons();
  console.log('Done.');
})().catch((e) => { console.error(e); process.exit(1); });
