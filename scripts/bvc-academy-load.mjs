#!/usr/bin/env node
// scripts/bvc-academy-load.mjs <episode-slug> [--dry]
//
// Service-role loader for the "Better Vice Club" Academy course. Mirrors the
// insert logic of app/api/academy/courses/[id]/import/route.ts but runs headless,
// SCOPED to a single episode module. Non-destructive to the other episodes.
//
// For the target episode it:
//   1. keeps the existing recorded "Episode N Audio" lesson (the full listen),
//   2. deletes the old non-audio lessons in that module,
//   3. inserts the new audio-first micro-lessons (with maps, primary-source docs),
//   4. inserts the rotating quiz lesson,
//   5. inserts the module-scoped Project assignment,
//   6. loads the episode glossary into course_glossary_terms (season-wide list),
//   7. reads everything back.
//
// Run: node --env-file=.env.local scripts/bvc-academy-load.mjs coffee|tea [--dry]

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const ROOT = '/Users/bam/Code_NOiCloud/ai-builds/gemini/centenarian-os';
const COURSE_ID = 'ca047c66-f03c-4924-9ebe-16e6bf076a85'; // "Better Vice Club"
const DRY = process.argv.includes('--dry');
const slug = process.argv[2];

// Each episode: the exact existing module title, the assignment title, and the
// lesson spec: [order, file, title, type, durationSec, free, mapFile, docIds].
// Audio lesson is preserved at order 1; new lessons start at order 2.
const EPISODES = {
  coffee: {
    moduleTitle: 'Episode 1: Coffee — The Daily Global Connection',
    assignmentTitle: 'Trace Your Favorite Coffee',
    lessons: [
      [2, '02-intro.md', 'Coffee, and Why a Cup Is a Classroom', 'text', 180, true, null, ['teacher-resources']],
      [3, '03-geo-coffee-belt.md', 'The Coffee Belt: Where Coffee Grows and Why', 'text', 360, true, null, []],
      [4, '04-geo-producers.md', 'The Big Producers and Their Terroir', 'text', 420, false, 'map-geography.json', []],
      [5, '05-geo-climate.md', 'Climate Change Is Redrawing the Map', 'text', 360, false, null, ['bunn-2015']],
      [6, '06-social-coffeehouse.md', 'The Coffeehouse Revolution', 'text', 480, false, null, ['royal-proclamation-1675', 'womens-petition-1674', 'mens-answer-1674']],
      [7, '07-social-two-truths.md', 'Two Truths: Democracy and Colonial Labor', 'text', 420, false, 'map-trade.json', ['colonial-plantation-records']],
      [8, '08-econ-bean-to-cup.md', 'Follow the Money: Bean to Cup', 'text', 420, false, null, []],
      [9, '09-econ-trade-models.md', 'Fair Trade, Direct Trade, and Commodity', 'text', 420, false, null, []],
      [10, '10-econ-price-shocks.md', 'Price Shocks and Why You Keep Buying', 'text', 420, false, null, []],
      [11, '11-ela-words.md', 'The Words Coffee Carries', 'text', 360, false, null, []],
      [12, '12-ela-ceremony.md', 'The Ethiopian Ceremony as Story', 'text', 360, false, null, []],
      [13, '13-ela-ads.md', 'Reading a Coffee Ad', 'text', 420, false, null, []],
      [14, '14-key-terms.md', 'Key Terms: Coffee', 'text', 300, false, null, []],
      [15, '15-review.md', 'Cumulative Review: Coffee', 'text', 360, false, null, []],
      [16, '16-references.md', 'Sources and Further Reading: Coffee', 'text', 180, false, null, []],
      [17, '17-quiz.md', 'Knowledge Check: Coffee', 'quiz', 720, false, null, []],
    ],
  },
  tea: {
    moduleTitle: 'Episode 2: Tea — The Way of Tea',
    assignmentTitle: 'The Story in Your Cup of Tea',
    lessons: [
      [2, '02-intro.md', 'Tea, and the Plant Behind Every Cup', 'text', 180, true, null, ['teacher-resources']],
      [3, '03-geo-climate-zones.md', 'The Tea Plant and Its Climate Zones', 'text', 420, true, null, []],
      [4, '04-geo-producers.md', 'The Big Producers and the First Flush', 'text', 360, false, 'map-geography.json', []],
      [5, '05-geo-trade-routes.md', 'The Roads Tea Traveled', 'text', 420, false, 'map-trade.json', []],
      [6, '06-social-origins-ceremony.md', 'From Medicine to Ceremony', 'text', 480, false, null, []],
      [7, '07-social-boston-tea-party.md', 'The Boston Tea Party', 'text', 420, false, null, ['boston-tea-party-loc']],
      [8, '08-social-who-grows-tea.md', 'Who Grows the Tea', 'text', 360, false, null, []],
      [9, '09-econ-one-leaf-many-teas.md', 'One Leaf, Many Teas', 'text', 420, false, null, []],
      [10, '10-econ-who-gets-paid.md', 'Who Gets Paid, Tea and Coffee Compared', 'text', 420, false, null, []],
      [11, '11-ela-cha-and-te.md', 'Cha and Te', 'text', 360, false, null, []],
      [12, '12-ela-classic-and-way.md', 'The Classic of Tea and the Way of Tea', 'text', 360, false, null, ['okakura-book-of-tea', 'classic-of-tea']],
      [13, '13-ela-tea-ad.md', 'Reading a Tea Ad', 'text', 420, false, null, ['orwell-nice-cup-of-tea']],
      [14, '14-key-terms.md', 'Key Terms: Tea', 'text', 300, false, null, []],
      [15, '15-review.md', 'Cumulative Review: Tea', 'text', 360, false, null, []],
      [16, '16-references.md', 'Sources and Further Reading: Tea', 'text', 180, false, null, []],
      [17, '17-quiz.md', 'Knowledge Check: Tea', 'quiz', 720, false, null, []],
    ],
  },
  chocolate: {
    moduleTitle: 'Episode 3: Chocolate — Food of the Gods',
    assignmentTitle: 'The Real Cost of a Chocolate Bar',
    lessons: [
      [2, '02-intro.md', 'Chocolate, the Food of the Gods', 'text', 180, true, null, ['teacher-resources']],
      [3, '03-geo-cacao-tree.md', 'The Cacao Tree and the Narrowest Belt', 'text', 420, true, null, []],
      [4, '04-geo-producers.md', 'The Big Producers and the Cacao Varieties', 'text', 420, false, 'map-geography.json', []],
      [5, '05-geo-climate.md', 'A Two-Degree Threat', 'text', 360, false, null, []],
      [6, '06-social-food-of-gods.md', 'Food of the Gods', 'text', 480, false, 'map-trade.json', ['popol-vuh', 'florentine-codex']],
      [7, '07-social-great-reversal.md', 'Conquest and the Great Reversal', 'text', 420, false, null, ['cortes-letters']],
      [8, '08-social-children-in-cacao.md', 'The Children in the Cacao', 'text', 360, false, null, ['cocoa-barometer']],
      [9, '09-econ-commodity-trap.md', 'The Commodity Trap', 'text', 420, false, null, []],
      [10, '10-econ-50-cent-question.md', 'The Fifty-Cent Question', 'text', 420, false, null, []],
      [11, '11-ela-cacao-cocoa-chocolate.md', 'Cacao, Cocoa, Chocolate', 'text', 360, false, null, []],
      [12, '12-ela-two-ways-of-seeing.md', 'Two Ways of Seeing a Bean', 'text', 360, false, null, ['cortes-letters', 'popol-vuh', 'florentine-codex']],
      [13, '13-ela-chocolate-ad.md', 'Reading a Chocolate Ad', 'text', 420, false, null, []],
      [14, '14-key-terms.md', 'Key Terms: Chocolate', 'text', 300, false, null, []],
      [15, '15-review.md', 'Cumulative Review: Chocolate', 'text', 360, false, null, []],
      [16, '16-references.md', 'Sources and Further Reading: Chocolate', 'text', 180, false, null, []],
      [17, '17-quiz.md', 'Knowledge Check: Chocolate', 'quiz', 720, false, null, []],
    ],
  },
  sugar: {
    moduleTitle: 'Episode 4: Sugar — The Sweet Revolution',
    assignmentTitle: 'The True Price of Sweet',
    lessons: [
      [2, '02-intro.md', 'Sugar, the Sweet Revolution', 'text', 180, true, null, ['teacher-resources']],
      [3, '03-geo-two-plants.md', 'Two Plants, One Sweetness', 'text', 420, true, null, []],
      [4, '04-geo-where-sugar-grows.md', 'Where Sugar Grows', 'text', 360, false, 'map-geography.json', []],
      [5, '05-geo-sugar-islands.md', 'The Sugar Islands', 'text', 360, false, null, []],
      [6, '06-social-new-world.md', 'From New Guinea to the New World', 'text', 360, false, null, []],
      [7, '07-social-triangular-trade.md', 'The Triangular Trade and the Middle Passage', 'text', 480, false, 'map-trade.json', ['equiano']],
      [8, '08-social-resistance.md', 'Resistance and Revolution', 'text', 420, false, null, ['mary-prince']],
      [9, '09-econ-from-luxury-to-cheap.md', 'From Luxury to the Cheapest Calorie', 'text', 420, false, null, []],
      [10, '10-econ-hidden-costs.md', 'The Hidden Costs of Cheap Sugar', 'text', 420, false, null, []],
      [11, '11-ela-words-of-sugar.md', 'The Words of Sugar', 'text', 360, false, null, []],
      [12, '12-ela-whose-voice.md', 'Whose Voice Tells the Story', 'text', 420, false, null, ['beckford-jamaica', 'equiano', 'mary-prince', 'austen-mansfield']],
      [13, '13-ela-blood-sweetened.md', 'Blood-Sweetened Luxury', 'text', 360, false, null, ['clarkson-essay']],
      [14, '14-key-terms.md', 'Key Terms: Sugar', 'text', 300, false, null, []],
      [15, '15-review.md', 'Cumulative Review: Sugar', 'text', 360, false, null, []],
      [16, '16-references.md', 'Sources and Further Reading: Sugar', 'text', 180, false, null, []],
      [17, '17-quiz.md', 'Knowledge Check: Sugar', 'quiz', 720, false, null, []],
    ],
  },
  'forest-wisdom': {
    moduleTitle: 'Episode 5: Guayusa & Kola Nut — Forest Wisdom',
    assignmentTitle: 'Whose Knowledge',
    lessons: [
      [2, '02-intro.md', 'Forest Wisdom: Guayusa and the Kola Nut', 'text', 180, true, null, ['teacher-resources']],
      [3, '03-geo-two-plants.md', 'Two Plants of the Forest', 'text', 360, true, null, []],
      [4, '04-geo-chemistry-is-relationship.md', 'Chemistry Is Relationship', 'text', 360, false, 'map-geography.json', []],
      [5, '05-geo-forests-under-threat.md', 'Forests Under Threat', 'text', 360, false, null, []],
      [6, '06-social-pre-dawn-and-kola-road.md', 'The Pre-Dawn Cup and the Kola Road', 'text', 420, false, 'map-trade.json', []],
      [7, '07-social-coca-cola-and-biopiracy.md', 'How Coca-Cola Got Its Name', 'text', 420, false, null, ['pendergrast-coca-cola']],
      [8, '08-social-whose-knowledge.md', 'Whose Knowledge Is It', 'text', 420, false, null, ['un-declaration', 'wipo-treaty']],
      [9, '09-econ-reciprocity-economy.md', 'The Reciprocity Economy', 'text', 420, false, null, []],
      [10, '10-econ-biopiracy-benefit-sharing.md', 'Biopiracy and Benefit-Sharing', 'text', 420, false, null, []],
      [11, '11-ela-two-ways-of-knowing.md', 'Two Ways of Knowing', 'text', 360, false, null, ['lewis-2003']],
      [12, '12-ela-wisdom-of-proverbs.md', 'The Wisdom of Proverbs', 'text', 360, false, null, []],
      [13, '13-ela-water-pretending.md', 'Water Pretending to Be Wisdom', 'text', 360, false, null, ['aidoo']],
      [14, '14-key-terms.md', 'Key Terms: Forest Wisdom', 'text', 300, false, null, []],
      [15, '15-review.md', 'Cumulative Review: Forest Wisdom', 'text', 360, false, null, []],
      [16, '16-references.md', 'Sources and Further Reading: Forest Wisdom', 'text', 180, false, null, []],
      [17, '17-quiz.md', 'Knowledge Check: Forest Wisdom', 'quiz', 720, false, null, []],
    ],
  },
  kava: {
    moduleTitle: 'Episode 6: Kava — The Root of Peace',
    assignmentTitle: 'The Root of Peace Project',
    lessons: [
      [2, '02-intro.md', 'Kava, the Root of Peace', 'text', 180, true, null, ['teacher-resources']],
      [3, '03-geo-volcanic-islands.md', 'A Plant of Volcanic Islands', 'text', 360, true, null, []],
      [4, '04-geo-why-volcanic-soil.md', 'Why Volcanic Soil Only', 'text', 360, false, 'map-geography.json', []],
      [5, '05-geo-islands-under-pressure.md', 'Islands Under Pressure', 'text', 360, false, null, []],
      [6, '06-social-root-of-peace.md', 'The Root of Peace', 'text', 480, false, 'map-trade.json', ['lebot-1992']],
      [7, '07-social-kava-governs.md', 'Kava Governs', 'text', 420, false, null, []],
      [8, '08-social-who-sits-at-the-bowl.md', 'Who Sits at the Bowl', 'text', 360, false, null, []],
      [9, '09-econ-ceremony-meets-market.md', 'Ceremony Meets the Market', 'text', 420, false, null, ['singh-2002']],
      [10, '10-econ-who-benefits.md', 'Who Benefits from the Boom', 'text', 420, false, null, []],
      [11, '11-ela-root-that-heals.md', 'The Root That Heals', 'text', 360, false, null, ['lebot-1992']],
      [12, '12-ela-roots-and-proverbs.md', 'Roots and Proverbs', 'text', 360, false, null, []],
      [13, '13-ela-kava-compass.md', 'The Kava Compass', 'text', 360, false, null, []],
      [14, '14-key-terms.md', 'Key Terms: Kava', 'text', 300, false, null, []],
      [15, '15-review.md', 'Cumulative Review: Kava', 'text', 360, false, null, []],
      [16, '16-references.md', 'Sources and Further Reading: Kava', 'text', 180, false, null, []],
      [17, '17-quiz.md', 'Knowledge Check: Kava', 'quiz', 720, false, null, []],
    ],
  },
  synthesis: {
    moduleTitle: 'Episode 7: My Daily Altar — Season Synthesis',
    assignmentTitle: 'Read Your Own Commodity',
    lessons: [
      [2, '02-intro.md', 'My Daily Altar: Looking Back at the Season', 'text', 180, true, null, ['teacher-resources']],
      [3, '03-geo-the-geography-pattern.md', 'The Geography Pattern', 'text', 420, true, 'map-geography.json', []],
      [4, '04-geo-the-climate-pattern.md', 'The Climate Pattern', 'text', 360, false, null, []],
      [5, '05-social-same-story-six-times.md', 'The Same Story, Six Times', 'text', 420, false, null, []],
      [6, '06-social-people-behind-every-cup.md', 'The People Behind Every Cup', 'text', 420, false, null, []],
      [7, '07-social-long-fight-for-justice.md', 'The Long Fight for Justice', 'text', 420, false, null, []],
      [8, '08-econ-who-captures-the-value.md', 'Who Captures the Value', 'text', 420, false, null, ['mintz-sweetness']],
      [9, '09-econ-two-ways-of-doing-economics.md', 'Two Ways of Doing Economics', 'text', 420, false, null, []],
      [10, '10-ela-the-stories-we-tell.md', 'The Stories We Tell', 'text', 420, false, null, []],
      [11, '11-ela-a-plants-eye-view.md', "A Plant's-Eye View", 'text', 360, false, null, ['pollan-botany']],
      [12, '12-my-daily-altar.md', 'My Daily Altar', 'text', 360, false, null, ['kimmerer-sweetgrass']],
      [13, '13-key-terms.md', 'Key Terms: Season Synthesis', 'text', 300, false, null, []],
      [14, '14-review.md', 'Cumulative Review: The Whole Season', 'text', 360, false, null, []],
      [15, '15-references.md', 'Sources and Further Reading: The Season', 'text', 180, false, null, []],
      [16, '16-quiz.md', 'Knowledge Check: Season Synthesis', 'quiz', 720, false, null, []],
    ],
  },
};
if (!slug || !EPISODES[slug]) {
  console.error(`usage: bvc-academy-load.mjs <episode-slug> [--dry]  (known: ${Object.keys(EPISODES).join(', ')})`);
  process.exit(1);
}
const EP = EPISODES[slug];
const SRC = path.join(ROOT, 'plans/BVC/ver1', slug);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

function lessonBody(file) {
  const raw = fs.readFileSync(path.join(SRC, file), 'utf8');
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i]?.startsWith('# ')) { i++; while (i < lines.length && lines[i].trim() === '') i++; }
  return lines.slice(i).join('\n').trim();
}
function readJson(file) { return JSON.parse(fs.readFileSync(path.join(SRC, file), 'utf8')); }
function isHttps(u) { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } }
function parseRow(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) { const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } }
  out.push(cur); return out.map((s) => s.trim());
}

async function main() {
  const { data: course } = await db.from('courses').select('id, title, price_type').eq('id', COURSE_ID).maybeSingle();
  if (!course) { console.error('Course not found:', COURSE_ID); process.exit(1); }
  console.log('Course:', course.title, `(price_type=${course.price_type})`);
  const isFreeCourse = course.price_type === 'free';

  const { data: mods } = await db.from('course_modules').select('id, title, order').eq('course_id', COURSE_ID);
  const mod = (mods ?? []).find((m) => m.title.toLowerCase().trim() === EP.moduleTitle.toLowerCase().trim());
  if (!mod) { console.error('Module not found by title:', EP.moduleTitle, '\n  existing:', (mods ?? []).map((m) => m.title)); process.exit(1); }
  console.log('Module:', mod.title, mod.id);

  const { data: existing } = await db.from('lessons').select('id, order, title, lesson_type').eq('course_id', COURSE_ID).eq('module_id', mod.id).order('order');
  const audio = (existing ?? []).filter((l) => l.lesson_type === 'audio');
  const toDelete = (existing ?? []).filter((l) => l.lesson_type !== 'audio');
  console.log(`Existing: ${existing?.length ?? 0} lessons. Keep ${audio.length} audio. Delete ${toDelete.length} non-audio:`, toDelete.map((l) => l.title).join(' | ') || '(none)');

  const docs = readJson('documents.json');
  const docById = new Map(docs.filter((d) => isHttps(d.url)).map((d) => [d.id, { title: d.title, description: d.description, url: d.url, source_url: d.source_url ?? null }]));
  const skippedDocs = docs.filter((d) => !isHttps(d.url)).map((d) => d.id);
  if (skippedDocs.length) console.log('Docs skipped (non-https url):', skippedDocs.join(', '));

  if (DRY) {
    console.log('\n[DRY RUN] would insert', EP.lessons.length, 'lessons:');
    for (const [order, , title, type, , free, mapFile, docIds] of EP.lessons)
      console.log(`  ${String(order).padStart(2)}. (${type}) ${title}${free ? ' [free]' : ''}${mapFile ? ' +map' : ''}${docIds.length ? ' +docs(' + docIds.length + ')' : ''}`);
    const gloss = fs.readFileSync(path.join(SRC, 'glossary.csv'), 'utf8').split(/\r?\n/).filter(Boolean).slice(1);
    console.log(`\n[DRY RUN] would load ${gloss.length} glossary terms and 1 assignment "${EP.assignmentTitle}". No DB writes.`);
    return;
  }

  for (const a of audio) await db.from('lessons').update({ order: 1, is_free_preview: true }).eq('id', a.id);
  for (const l of toDelete) { const { error } = await db.from('lessons').delete().eq('id', l.id); if (error) console.error('  ! delete', l.title, error.message); }

  const stats = { created: 0, errors: [] };
  for (const [order, file, title, type, duration, free, mapFile, docIds] of EP.lessons) {
    const row = {
      course_id: COURSE_ID, module_id: mod.id, title, lesson_type: type,
      text_content: lessonBody(file), content_format: 'markdown',
      duration_seconds: duration, order, is_free_preview: free || isFreeCourse,
    };
    if (mapFile) row.map_content = readJson(mapFile);
    if (type === 'quiz') row.quiz_content = readJson('quiz.json');
    const attachDocs = docIds.map((id) => docById.get(id)).filter(Boolean);
    if (attachDocs.length) row.documents = attachDocs;
    const { error } = await db.from('lessons').insert(row);
    if (error) stats.errors.push(`L${order} ${title}: ${error.message}`);
    else { stats.created++; console.log(`  + L${order} (${type}) ${title}${row.map_content ? ' +map' : ''}${row.documents ? ' +' + row.documents.length + 'docs' : ''}`); }
  }

  const { data: existingAssign } = await db.from('assignments').select('id').eq('course_id', COURSE_ID).eq('title', EP.assignmentTitle).maybeSingle();
  if (existingAssign) console.log('Assignment exists, skipping:', EP.assignmentTitle);
  else {
    const { error } = await db.from('assignments').insert({ course_id: COURSE_ID, title: EP.assignmentTitle, description: lessonBody('project.md'), scope: 'module', module_id: mod.id });
    if (error) stats.errors.push(`assignment: ${error.message}`); else console.log('  + Assignment:', EP.assignmentTitle);
  }

  const { data: allLessons } = await db.from('lessons').select('id, title').eq('course_id', COURSE_ID);
  const lessonByTitle = new Map((allLessons ?? []).map((l) => [l.title.toLowerCase().trim(), l.id]));
  const glossLines = fs.readFileSync(path.join(SRC, 'glossary.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  let gl = 0;
  for (let i = 1; i < glossLines.length; i++) {
    const [term, phonetic, definition, lessonTitle] = parseRow(glossLines[i]);
    if (!term) continue;
    const lessonId = lessonTitle ? lessonByTitle.get(lessonTitle.toLowerCase().trim()) ?? null : null;
    const { error } = await db.from('course_glossary_terms').upsert({
      course_id: COURSE_ID, term, phonetic: phonetic || null, definition: definition || null,
      definition_format: 'markdown', lesson_id: lessonId, sort_order: 1000 + i, updated_at: new Date().toISOString(),
    }, { onConflict: 'course_id,term' });
    if (error) stats.errors.push(`glossary ${term}: ${error.message}`); else gl++;
  }
  console.log(`  + ${gl} glossary terms`);

  console.log('\nStats:', JSON.stringify(stats));
  const { data: check } = await db.from('lessons').select('order, title, lesson_type, is_free_preview, map_content, documents, quiz_content').eq('course_id', COURSE_ID).eq('module_id', mod.id).order('order');
  console.log(`\nModule now has ${check?.length ?? 0} lessons:`);
  for (const l of check ?? []) {
    const q = l.quiz_content?.questions?.length ? ` [quiz: ${l.quiz_content.questions.length}Q]` : '';
    const m = l.map_content ? ' [map]' : '';
    const d = Array.isArray(l.documents) && l.documents.length ? ` [${l.documents.length}docs]` : '';
    console.log(`  ${String(l.order).padStart(2)}. (${l.lesson_type}) ${l.title}${l.is_free_preview ? ' [free]' : ''}${q}${m}${d}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
