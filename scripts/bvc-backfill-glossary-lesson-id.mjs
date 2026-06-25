// One-time backfill: give every Better Vice Club glossary term an explicit
// lesson_id so lesson_id is the single source of truth (no CSV/heuristic
// fallback needed by future tooling).
//
// After the per-season split, the only terms still missing lesson_id are 41
// legacy Season 1 terms (imported before per-lesson linking; sort_order 1-64).
// Their original sort_order interleaves episodes, so it is not a reliable
// signal. Instead each is assigned, by content, to its episode's "Key Terms"
// lesson via the explicit, reviewable map below. Cross-cutting concepts
// (commodity, colonialism, supply chain, price elasticity, etc.) are assigned
// to the episode that first introduces them (Coffee, Episode 1).
//
// Usage:
//   node --env-file=.env.local scripts/bvc-backfill-glossary-lesson-id.mjs --dry
//   node --env-file=.env.local scripts/bvc-backfill-glossary-lesson-id.mjs --commit
import { createClient } from '@supabase/supabase-js';

const DRY = !process.argv.includes('--commit');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const S1 = 'ca047c66-f03c-4924-9ebe-16e6bf076a85';

// term -> Season 1 episode number (its Key Terms lesson is the link target)
const TERM_EPISODE = {
  // Episode 1 — Coffee (incl. cross-cutting concepts first introduced here)
  'Coffee Belt': 1, 'Commodity': 1, 'Colonialism': 1, 'Public sphere': 1,
  'Penny Universities': 1, 'Elevation': 1, 'Bean Belt': 1, 'Supply chain': 1,
  'Commodity coffee': 1, 'Price elasticity': 1, 'Fair Trade': 1, 'Monoculture': 1, 'Subsidy': 1,
  // Episode 2 — Tea
  'Darjeeling': 2, 'Assam': 2, 'Imperialism': 2, 'Opium': 2, 'Cha dao': 2,
  // Episode 3 — Chocolate
  'Mesoamerica': 3, 'Aztec': 3, 'Maya': 3, 'Olmec': 3, 'Conquistador': 3, 'COCOBOD': 3, 'Fairtrade': 3,
  // Episode 4 — Sugar
  'Plantation': 4, 'Transatlantic': 4, 'Emancipation': 4, 'Abolition': 4,
  // Episode 5 — Guayusa & Kola Nut (Forest Wisdom)
  'Kichwa': 5, 'Akan': 5, 'Sovereignty': 5, 'Ethnobotany': 5, 'Intellectual property': 5,
  // Episode 6 — Kava
  'Talanoa': 6, 'Vanuatu': 6, 'Polynesia': 6, 'Melanesia': 6,
  // Episode 7 — My Daily Altar (Season Synthesis)
  'Decolonization': 7, 'Cultural appropriation': 7, 'Economic justice': 7,
};

async function main() {
  console.log(`\n=== BVC glossary lesson_id backfill (${DRY ? 'DRY RUN' : 'COMMIT'}) ===\n`);

  const { data: mods } = await db.from('course_modules').select('id,order').eq('course_id', S1);
  const modByOrder = Object.fromEntries(mods.map((m) => [m.order, m.id]));
  const { data: lessons } = await db.from('lessons').select('id,title,module_id').eq('course_id', S1);
  // episode order -> Key Terms lesson id
  const ktByEpisode = {};
  for (const [order, mid] of Object.entries(modByOrder)) {
    const kt = lessons.find((l) => l.module_id === mid && /key terms/i.test(l.title));
    if (kt) ktByEpisode[order] = kt.id;
  }
  for (let e = 1; e <= 7; e++) if (!ktByEpisode[e]) throw new Error(`Episode ${e} has no Key Terms lesson`);

  const { data: terms } = await db.from('course_glossary_terms').select('id,term,lesson_id').eq('course_id', S1).is('lesson_id', null);
  console.log(`Null lesson_id terms on Season 1: ${terms.length}`);

  const unmapped = terms.filter((t) => !TERM_EPISODE[t.term]);
  if (unmapped.length) { console.log(`\nABORT: no episode mapping for: ${unmapped.map((t) => t.term).join(', ')}\n`); return; }

  const byEp = {};
  for (const t of terms) { const e = TERM_EPISODE[t.term]; (byEp[e] = byEp[e] || []).push(t); }
  for (let e = 1; e <= 7; e++) if (byEp[e]) console.log(`  ep${e}: ${byEp[e].map((t) => t.term).join(', ')}`);

  if (DRY) { console.log('\nRe-run with --commit to apply.\n'); return; }

  let updated = 0;
  for (const t of terms) {
    const lid = ktByEpisode[TERM_EPISODE[t.term]];
    const { error } = await db.from('course_glossary_terms').update({ lesson_id: lid }).eq('id', t.id);
    if (error) throw new Error(`${t.term}: ${error.message}`);
    updated++;
  }
  console.log(`\nUpdated ${updated} terms.`);

  // Verify: zero null lesson_id across all three BVC courses.
  for (const [name, cid] of [['S1', S1], ['S2', '880da0c1-176b-4546-8f38-2c0d13e28803'], ['S3', 'f4b2e611-71f4-4d19-ba83-c85e1f7b549a']]) {
    const { count } = await db.from('course_glossary_terms').select('id', { count: 'exact', head: true }).eq('course_id', cid).is('lesson_id', null);
    console.log(`  ${name}: ${count} null lesson_id remaining`);
  }
  console.log('');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
