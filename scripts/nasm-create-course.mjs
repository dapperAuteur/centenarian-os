// scripts/nasm-create-course.mjs
// One-time, idempotent creation of the "NASM CPT7 Fast Track" course row.
// Run: node --env-file=.env.local scripts/nasm-create-course.mjs
//
// Safe to re-run: if a course with the exact title already exists it prints the
// existing id instead of inserting a duplicate. Writes are additive and scoped
// to this single course. Created as a draft (is_published=false); pricing and
// publish are set later in the editor.

import { createClient } from '@supabase/supabase-js';

const TITLE = 'NASM CPT7 Fast Track: From Study to Certified Trainer by Fit T. Cent 4.0';
const CATEGORY = 'Fitness Certification';
const DESCRIPTION =
  'Pass the NASM CPT7 exam and start training clients with confidence. ' +
  'Fit T. Cent walks you through every chapter in short, audio-first lessons you can finish on a commute. ' +
  'Each lesson opens with a quick recall, teaches one idea in plain words, and shows you exactly how it appears on the test. ' +
  'Quizzes, cheat sheets, a glossary, and a full practice exam get you ready for test day.';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

function kebab(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function resolveTeacherId() {
  // Prefer the admin's auth user id; fall back to an existing course's teacher.
  try {
    let page = 1;
    for (;;) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      const hit = data.users.find((u) => u.email === adminEmail);
      if (hit) return hit.id;
      if (data.users.length < 200) break;
      page += 1;
      if (page > 25) break;
    }
  } catch (e) {
    console.warn('listUsers failed, falling back to existing course teacher:', e.message);
  }
  const { data } = await db
    .from('courses')
    .select('teacher_id')
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0]?.teacher_id ?? null;
}

async function uniqueSlug(teacherId, base) {
  let candidate = base;
  let n = 1;
  for (;;) {
    const { data } = await db
      .from('courses')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('slug', candidate)
      .limit(1);
    if (!data?.length) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

async function main() {
  // Visibility: list current courses (helps spot the concurrent build).
  const { data: existing } = await db
    .from('courses')
    .select('id, title, slug, teacher_id, is_published, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  console.log('Existing courses (most recent 20):');
  for (const c of existing ?? []) {
    console.log(`  ${c.id}  pub=${c.is_published}  ${c.title}`);
  }

  const dupe = (existing ?? []).find((c) => c.title === TITLE);
  if (dupe) {
    console.log(`\nCourse already exists. COURSE_ID=${dupe.id} slug=${dupe.slug}`);
    return;
  }

  const teacherId = await resolveTeacherId();
  if (!teacherId) {
    console.error('Could not resolve a teacher_id. Aborting.');
    process.exit(1);
  }
  console.log(`\nUsing teacher_id=${teacherId}`);

  const slug = await uniqueSlug(teacherId, kebab('nasm-cpt7-fast-track'));
  const { data, error } = await db
    .from('courses')
    .insert({
      teacher_id: teacherId,
      title: TITLE,
      slug,
      description: DESCRIPTION,
      category: CATEGORY,
      tags: ['nasm', 'cpt7', 'personal-training', 'certification', 'exam-prep'],
      price: 0,
      price_type: 'free',
      navigation_mode: 'linear',
      is_published: false,
    })
    .select('id, slug, title')
    .single();

  if (error) {
    console.error('Insert failed:', error.message);
    process.exit(1);
  }
  console.log(`\nCreated course. COURSE_ID=${data.id} slug=${data.slug}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
