#!/usr/bin/env node
// scripts/bvc-generate-embeddings.mjs <episode-slug>
//
// Generate Gemini embeddings for a Better Vice Club episode's lessons so the
// CYOA "semantic crossroads" can suggest related lessons. Mirrors
// app/api/academy/courses/[id]/generate-embeddings/route.ts but runs headless and
// is scoped to one episode module. Idempotent (upsert on lesson_id).
//
// Run: node --env-file=.env.local scripts/bvc-generate-embeddings.mjs coffee

import { createClient } from '@supabase/supabase-js';

const COURSE_ID = 'ca047c66-f03c-4924-9ebe-16e6bf076a85';
const EPISODES = {
  coffee: 'Episode 1: Coffee — The Daily Global Connection',
  tea: 'Episode 2: Tea — The Way of Tea',
  chocolate: 'Episode 3: Chocolate — Food of the Gods',
  sugar: 'Episode 4: Sugar — The Sweet Revolution',
  'forest-wisdom': 'Episode 5: Guayusa & Kola Nut — Forest Wisdom',
  kava: 'Episode 6: Kava — The Root of Peace',
  synthesis: 'Episode 7: My Daily Altar — Season Synthesis',
  beer: 'Episode 8: Beer — Liquid Bread',
  wine: 'Episode 9: Wine — Blood of the Earth',
  whiskey: 'Episode 10: Whiskey — Fire Water',
  rum: 'Episode 11: Rum — Sweet Poison',
  'tequila-mezcal': 'Episode 12: Tequila & Mezcal — Heart of the Agave',
  sake: 'Episode 13: Sake — The Koji Path',
  'the-toast': 'Episode 14: The Toast — Season Synthesis',
  tobacco: 'Episode 15: Tobacco — Sacred Smoke',
  cannabis: 'Episode 16: Cannabis — The Green Revolution',
  opioids: 'Episode 17: Opioids — The Poppy\'s Promise',
};
const slug = process.argv[2];
if (!slug || !EPISODES[slug]) { console.error(`usage: bvc-generate-embeddings.mjs <episode-slug>`); process.exit(1); }
const MODULE_TITLE = EPISODES[slug];
const EMBEDDING_MODEL = 'gemini-embedding-001';

const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY, gKey = process.env.GOOGLE_GEMINI_API_KEY;
if (!sUrl || !sKey) { console.error('Missing Supabase env'); process.exit(1); }
if (!gKey) { console.error('GOOGLE_GEMINI_API_KEY not set'); process.exit(1); }
const db = createClient(sUrl, sKey, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getEmbedding(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gKey },
    body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return data.embedding?.values ?? [];
}

async function main() {
  const { data: mods } = await db.from('course_modules').select('id, title').eq('course_id', COURSE_ID);
  const mod = (mods ?? []).find((m) => m.title.toLowerCase().trim() === MODULE_TITLE.toLowerCase().trim());
  if (!mod) { console.error('Module not found:', MODULE_TITLE); process.exit(1); }

  const { data: lessons } = await db.from('lessons').select('id, title, text_content').eq('course_id', COURSE_ID).eq('module_id', mod.id).order('order');
  let done = 0, skipped = 0; const errors = [];
  for (const l of lessons ?? []) {
    const text = [l.title, l.text_content].filter(Boolean).join('\n\n');
    if (!text.trim()) { skipped++; continue; } // e.g. the audio lesson with no text
    try {
      const embedding = await getEmbedding(text);
      if (!embedding.length) throw new Error('empty embedding');
      const { error } = await db.from('lesson_embeddings').upsert({ lesson_id: l.id, embedding }, { onConflict: 'lesson_id' });
      if (error) throw new Error(error.message);
      done++; console.log(`  embedded: ${l.title}`);
    } catch (e) { errors.push(`${l.title}: ${e.message}`); }
    await sleep(300);
  }
  console.log(`\nembedded ${done}, skipped ${skipped} (no text), errors ${errors.length}`);
  for (const e of errors) console.log('  !', e);
}
main().catch((e) => { console.error(e); process.exit(1); });
