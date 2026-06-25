#!/usr/bin/env node
// scripts/bvc-flashlearn-push.mjs <episode-slug> [--update|--reset]
//
// Push / update Better Vice Club flashcard sets on FlashLearn AI (v1 API).
// Clone of the CNC pusher; the only episode-specific bit is the flashcards dir.
//   (default)   create new sets, skip ones already in _setmap.json
//   --update    PATCH the sets already in _setmap.json (preserves setId + student history)
//   --reset     delete every set in _setmap.json first, then create fresh
// Cards carry front/back + externalId + authored multiple-choice (options + correctOptionId).
// Needs FLASHLEARN_ECO_API_KEY with sets:write. Throttled + 429/network backoff; idempotent.
// Recipe: plans/ecosystem/flashlearn-ai/flashcard-integration.md
// Run: node --env-file=.env.local scripts/bvc-flashlearn-push.mjs coffee [--update|--reset]

import fs from 'fs';
import path from 'path';

const ROOT = '/Users/bam/Code_NOiCloud/ai-builds/gemini/centenarian-os';
const BASE = 'https://flashlearnai.witus.online/api/v1';
const KEY = process.env.FLASHLEARN_ECO_API_KEY;
if (!KEY) { console.error('FLASHLEARN_ECO_API_KEY not set'); process.exit(1); }
const slug = process.argv[2];
if (!slug) { console.error('usage: bvc-flashlearn-push.mjs <episode-slug> [--update|--reset]'); process.exit(1); }
const DIR = path.join(ROOT, 'plans/BVC/ver1', slug, 'flashcards');
if (!fs.existsSync(DIR)) { console.error('No flashcards dir:', DIR, '(run build-bvc-flashcards.mjs first)'); process.exit(1); }
const MAP = path.join(DIR, '_setmap.json');
const setmap = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, 'utf8')) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const THROTTLE = 1200;
const UPDATE = process.argv.includes('--update');
const RESET = process.argv.includes('--reset');

const cardBody = (c) => ({
  front: c.front, back: c.back, externalId: c.externalId,
  ...(Array.isArray(c.options) && c.options.length ? { options: c.options, correctOptionId: c.correctOptionId } : {}),
});
const setBody = (set) => ({ title: set.title, description: set.description || '', isPublic: !!set.isPublic, flashcards: set.cards.map(cardBody) });

async function send(method, url, payload, label) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url, { method, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined });
      const txt = await res.text();
      if (res.ok) return { ok: true, json: txt ? JSON.parse(txt) : {} };
      if (res.status === 429) { console.log(`429 on ${label}, backing off 62s (attempt ${attempt + 1})`); await sleep(62000); continue; }
      if (res.status === 401 || res.status === 403) { console.error(`>> auth/permission HTTP ${res.status} on ${label}: ${txt.slice(0, 180)}`); return { stop: true }; }
      if (res.status === 400) { console.error(`>> 400 INVALID on ${label}: ${txt.slice(0, 220)}`); return { bad: true }; }
      console.error(`retryable HTTP ${res.status} on ${label} (attempt ${attempt + 1}): ${txt.slice(0, 120)}`); await sleep(5000); continue;
    } catch (e) { console.error(`net err ${label} (attempt ${attempt + 1}):`, e.message); await sleep(5000); continue; }
  }
  return { failed: true };
}

if (RESET) {
  for (const [f, v] of Object.entries(setmap)) {
    if (!v?.setId) { delete setmap[f]; continue; }
    const r = await send('DELETE', `${BASE}/sets/${v.setId}`, null, `del ${f}`);
    if (r.ok || r.bad) { delete setmap[f]; fs.writeFileSync(MAP, JSON.stringify(setmap, null, 2)); }
    await sleep(THROTTLE);
  }
  console.log('reset: cleared setmap. proceeding to create.');
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== '_setmap.json').sort();
let pushed = 0, updated = 0, skipped = 0, failed = 0;
for (const f of files) {
  const set = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (!set.cards?.length) { console.log('skip empty:', f); continue; }
  if (UPDATE) {
    const sid = setmap[f]?.setId;
    if (!sid) { console.log('skip (not in setmap; create first):', f); skipped++; continue; }
    const r = await send('PATCH', `${BASE}/sets/${sid}`, setBody(set), f);
    if (r.stop) break;
    if (r.ok) { updated++; const mc = set.cards.filter((c) => c.options).length; console.log(`updated ${f} -> ${sid} (${set.cards.length} cards, ${mc} MC)`); } else failed++;
    await sleep(THROTTLE); continue;
  }
  if (setmap[f]?.setId) { console.log('skip (already pushed):', f, setmap[f].setId); skipped++; continue; }
  const r = await send('POST', `${BASE}/sets`, setBody(set), f);
  if (r.stop) break;
  if (r.ok) {
    const setId = r.json?.data?.id || r.json?.id;
    setmap[f] = { setId, title: set.title, cards: set.cards.length };
    fs.writeFileSync(MAP, JSON.stringify(setmap, null, 2));
    pushed++; const mc = set.cards.filter((c) => c.options).length;
    console.log(`pushed ${f} -> ${setId} (${set.cards.length} cards, ${mc} MC)`);
  } else failed++;
  await sleep(THROTTLE);
}
console.log(`\ndone. pushed=${pushed} updated=${updated} skipped=${skipped} failed=${failed}.`);
