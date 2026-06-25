// One-time migration: split the single "Better Vice Club" course
// (ca047c66...) into three per-season course rows that share a
// `series_slug` so each season can be sold/enrolled separately and the
// generic Series & Season switcher groups them.
//
//   Season 1 "The Daily Ritual"   = Episodes 1-7   (existing course, renamed)
//   Season 2 "The Oldest Toast"   = Episodes 8-14  (new course row)
//   Season 3 "The Forbidden Leaf" = Episodes 15-21 (new course row)
//
// Re-homes course_modules, lessons, assignments, and course_glossary_terms
// to the right season course. lesson_embeddings/activity_links/progress are
// keyed by lesson_id (unchanged on re-home), so they follow automatically.
//
// Usage:
//   node --env-file=.env.local scripts/bvc-split-seasons.mjs --dry
//   node --env-file=.env.local scripts/bvc-split-seasons.mjs --commit
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DRY = !process.argv.includes('--commit');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');

const COURSE_ID = 'ca047c66-f03c-4924-9ebe-16e6bf076a85';
const SERIES_SLUG = 'better-vice-club';
const SERIES_TITLE = 'Better Vice Club';

// season -> { title, slug (new courses only), episodeDirs }
const SEASONS = {
  1: {
    title: 'Better Vice Club: Season 1 — The Daily Ritual',
    slug: null, // keep existing course slug 'better-vice-club'
    dirs: ['coffee', 'tea', 'chocolate', 'sugar', 'forest-wisdom', 'kava', 'synthesis'],
  },
  2: {
    title: 'Better Vice Club: Season 2 — The Oldest Toast',
    slug: 'better-vice-club-season-2',
    dirs: ['beer', 'wine', 'whiskey', 'rum', 'tequila-mezcal', 'sake', 'the-toast'],
  },
  3: {
    title: 'Better Vice Club: Season 3 — The Forbidden Leaf',
    slug: 'better-vice-club-season-3',
    dirs: ['tobacco', 'cannabis', 'opioids', 'coca', 'psychedelics', 'khat', 'full-spectrum'],
  },
};

const seasonForOrder = (o) => (o <= 7 ? 1 : o <= 14 ? 2 : 3);

// Parse just the first CSV column (term) from a glossary.csv, handling quotes.
function csvTerms(path) {
  const out = [];
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).slice(1); // skip header
  for (const line of lines) {
    if (!line.trim()) continue;
    let term;
    if (line[0] === '"') {
      const end = line.indexOf('"', 1);
      term = line.slice(1, end);
    } else {
      term = line.slice(0, line.indexOf(','));
    }
    if (term) out.push(term.trim());
  }
  return out;
}

// term-name -> season, from the on-disk per-episode glossary CSVs.
function buildCsvTermSeason() {
  const map = new Map();
  for (const [season, cfg] of Object.entries(SEASONS)) {
    for (const dir of cfg.dirs) {
      const path = join(REPO, 'plans', 'BVC', 'ver1', dir, 'glossary.csv');
      for (const t of csvTerms(path)) map.set(t, Number(season));
    }
  }
  return map;
}

async function main() {
  console.log(`\n=== BVC season split (${DRY ? 'DRY RUN' : 'COMMIT'}) ===\n`);

  const { data: course } = await db.from('courses').select('*').eq('id', COURSE_ID).maybeSingle();
  if (!course) throw new Error('source course not found');
  console.log(`Source: "${course.title}" (slug ${course.slug}, published ${course.is_published}, price ${course.price})`);

  const { data: mods } = await db.from('course_modules').select('id,title,order').eq('course_id', COURSE_ID);
  const modSeason = new Map(mods.map((m) => [m.id, seasonForOrder(m.order)]));
  const modsBySeason = { 1: [], 2: [], 3: [] };
  for (const m of mods) modsBySeason[seasonForOrder(m.order)].push(m.id);
  console.log(`Modules: S1=${modsBySeason[1].length} S2=${modsBySeason[2].length} S3=${modsBySeason[3].length}`);

  const { data: lessons } = await db.from('lessons').select('id,module_id,title').eq('course_id', COURSE_ID);
  const lessonSeason = new Map(lessons.map((l) => [l.id, modSeason.get(l.module_id)]));

  const { data: asg } = await db.from('assignments').select('id,module_id').eq('course_id', COURSE_ID);

  // Glossary: prefer the DB lesson_id linkage; fall back to CSV term-name map.
  const csvTermSeason = buildCsvTermSeason();
  const { data: terms } = await db.from('course_glossary_terms').select('id,term,lesson_id').eq('course_id', COURSE_ID);
  const termSeason = new Map();
  let viaLesson = 0, viaCsv = 0, unmapped = [], disagree = [];
  for (const t of terms) {
    const byLesson = t.lesson_id ? lessonSeason.get(t.lesson_id) : undefined;
    const byCsv = csvTermSeason.get(t.term);
    let s = byLesson ?? byCsv;
    if (byLesson) viaLesson++; else if (byCsv) viaCsv++;
    if (byLesson && byCsv && byLesson !== byCsv) disagree.push(`${t.term} (lesson=${byLesson} csv=${byCsv})`);
    if (!s) { unmapped.push(t.term); continue; }
    termSeason.set(t.id, s);
  }
  const termCount = { 1: 0, 2: 0, 3: 0 };
  for (const s of termSeason.values()) termCount[s]++;
  console.log(`Glossary: ${terms.length} terms (via lesson_id ${viaLesson}, via CSV ${viaCsv}) -> S1=${termCount[1]} S2=${termCount[2]} S3=${termCount[3]}`);
  if (disagree.length) console.log(`  ⚠ season disagreements (${disagree.length}): ${disagree.join('; ')}`);
  // Unmapped terms are foundational Season 1 vocabulary (no lesson link, not in
  // any current per-episode CSV). They stay on the existing course, which
  // becomes Season 1, so no move is needed. Safety: assert none are S2/S3 — by
  // construction they aren't (an S2/S3 term would have matched its CSV above).
  const s2s3Csv = new Set([...csvTermSeason.entries()].filter(([, s]) => s !== 1).map(([t]) => t));
  const misfiled = unmapped.filter((t) => s2s3Csv.has(t));
  if (misfiled.length) { console.log(`\nABORT: unmapped terms that look like S2/S3: ${misfiled.join(', ')}\n`); return; }
  termCount[1] += unmapped.length; // they remain on the S1 course
  if (unmapped.length) console.log(`  → ${unmapped.length} unmapped S1 terms stay on the existing (Season 1) course: ${unmapped.join(', ')}`);
  if (disagree.length) { console.log('\nABORT: season disagreement between lesson_id and CSV — resolve first.\n'); return; }
  console.log(`Assignments: ${asg.length} (re-pointed by module_id)`);

  if (DRY) {
    console.log('\n--- DRY: would create 2 new courses (S2, S3), rename existing -> S1, set series fields, and move:');
    for (const s of [2, 3]) {
      console.log(`  Season ${s}: ${modsBySeason[s].length} modules, ${lessons.filter((l) => lessonSeason.get(l.id) === s).length} lessons, ${asg.filter((a) => modSeason.get(a.module_id) === s).length} assignments, ${termCount[s]} glossary terms`);
    }
    console.log('\nRe-run with --commit to apply.\n');
    return;
  }

  // ---- COMMIT ----
  const copyFields = (extra) => ({
    description: course.description,
    cover_image_url: course.cover_image_url,
    category: course.category,
    tags: course.tags,
    price: course.price,
    price_type: course.price_type,
    is_published: course.is_published,
    published_at: course.published_at,
    visibility: course.visibility,
    navigation_mode: course.navigation_mode,
    is_sequential: course.is_sequential,
    teacher_id: course.teacher_id,
    override_questions: course.override_questions,
    allow_cross_course_cyoa: course.allow_cross_course_cyoa,
    series_slug: SERIES_SLUG,
    series_title: SERIES_TITLE,
    ...extra,
  });

  const seasonCourseId = { 1: COURSE_ID };
  for (const s of [2, 3]) {
    // idempotent: reuse if a course with this slug already exists
    const { data: existing } = await db.from('courses').select('id').eq('slug', SEASONS[s].slug).maybeSingle();
    if (existing) { seasonCourseId[s] = existing.id; console.log(`S${s} course already exists (${existing.id}), reusing`); continue; }
    const { data: created, error } = await db.from('courses')
      .insert(copyFields({ title: SEASONS[s].title, slug: SEASONS[s].slug, season_number: s }))
      .select('id').single();
    if (error) throw new Error(`create S${s}: ${error.message}`);
    seasonCourseId[s] = created.id;
    console.log(`Created S${s} course: ${created.id} (${SEASONS[s].slug})`);
  }

  for (const s of [2, 3]) {
    const cid = seasonCourseId[s];
    const modIds = modsBySeason[s];
    const lessonIds = lessons.filter((l) => lessonSeason.get(l.id) === s).map((l) => l.id);
    const termIds = [...termSeason.entries()].filter(([, sea]) => sea === s).map(([id]) => id);
    const asgIds = asg.filter((a) => modSeason.get(a.module_id) === s).map((a) => a.id);

    let r;
    r = await db.from('course_modules').update({ course_id: cid }).in('id', modIds);
    if (r.error) throw new Error(`S${s} modules: ${r.error.message}`);
    r = await db.from('lessons').update({ course_id: cid }).in('id', lessonIds);
    if (r.error) throw new Error(`S${s} lessons: ${r.error.message}`);
    if (asgIds.length) { r = await db.from('assignments').update({ course_id: cid }).in('id', asgIds); if (r.error) throw new Error(`S${s} assignments: ${r.error.message}`); }
    // glossary in chunks of 100
    for (let i = 0; i < termIds.length; i += 100) {
      r = await db.from('course_glossary_terms').update({ course_id: cid }).in('id', termIds.slice(i, i + 100));
      if (r.error) throw new Error(`S${s} glossary: ${r.error.message}`);
    }
    console.log(`Moved to S${s} (${cid}): ${modIds.length} modules, ${lessonIds.length} lessons, ${asgIds.length} assignments, ${termIds.length} glossary terms`);
  }

  // Rename + tag the existing course as Season 1.
  const r1 = await db.from('courses').update({
    title: SEASONS[1].title,
    series_slug: SERIES_SLUG,
    series_title: SERIES_TITLE,
    season_number: 1,
  }).eq('id', COURSE_ID);
  if (r1.error) throw new Error(`rename S1: ${r1.error.message}`);
  console.log(`Renamed existing course -> "${SEASONS[1].title}" (season_number 1, series ${SERIES_SLUG})`);

  console.log('\n=== Verify ===');
  for (const s of [1, 2, 3]) {
    const cid = seasonCourseId[s];
    const { count: mc } = await db.from('course_modules').select('id', { count: 'exact', head: true }).eq('course_id', cid);
    const { count: lc } = await db.from('lessons').select('id', { count: 'exact', head: true }).eq('course_id', cid);
    const { count: gc } = await db.from('course_glossary_terms').select('id', { count: 'exact', head: true }).eq('course_id', cid);
    console.log(`  S${s} ${cid}: ${mc} modules, ${lc} lessons, ${gc} glossary terms`);
  }
  console.log(`\nSeason course ids: ${JSON.stringify(seasonCourseId)}\n`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
