// scripts/ces-flashlearn-push.mjs
// Pushes the staged CES flashcard sets to FlashLearn AI. Follows the academy procedure in
// docs/CentenarianAcademy/FlashcardPushGuide.md (proven on CNC). Reads
// docs/ces-curriculum/academy-import/flashcards/*.json (each { title, description, isPublic,
// flashcards:[{front,back,externalId}] }), POSTs each to /api/v1/sets, records
// file -> {setId,title,cards} in flashcards/_setmap.json. Idempotent: skips already-pushed
// sets. Stops on the first 401/403 so it does not hammer the API.
//
// Usage: node --env-file=.env.local scripts/ces-flashlearn-push.mjs [--dry-run]

import fs from 'fs';
import path from 'path';

const DIR = 'docs/ces-curriculum/academy-import/flashcards';
const MAP = path.join(DIR, '_setmap.json');
const BASE = process.env.FLASHLEARN_API_BASE || 'https://flashlearnai.witus.online/api/v1';
const KEY = process.env.FLASHLEARN_ECO_API_KEY;
const DRY = process.argv.includes('--dry-run');
if (!KEY) { console.error('Missing FLASHLEARN_ECO_API_KEY'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setmap = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, 'utf8')) : {};
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== '_setmap.json' && f !== '_uploads.json').sort();

let pushed = 0, skipped = 0;
for (const f of files) {
  if (setmap[f]?.setId) { skipped++; continue; }
  const set = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const cards = set.flashcards || set.cards || [];
  if (!cards.length) { console.log('skip empty', f); continue; }
  const body = { title: set.title, description: set.description || '', isPublic: set.isPublic !== false, flashcards: cards.map((c) => ({ front: c.front, back: c.back, ...(c.externalId ? { externalId: c.externalId } : {}) })) };
  if (DRY) { console.log(`[dry] would push ${f} (${cards.length} cards) "${set.title}"`); continue; }
  const res = await fetch(`${BASE}/sets`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    console.error(`STOP ${res.status} on ${f}: ${json?.error?.message || ''} (requestId ${json?.meta?.requestId || '?'})`);
    break;
  }
  const setId = json?.data?.id;
  if (!res.ok || !setId) { console.error(`FAILED ${f}: ${res.status} ${json?.error?.message || JSON.stringify(json).slice(0, 120)}`); continue; }
  setmap[f] = { setId, title: set.title, cards: cards.length };
  fs.writeFileSync(MAP, JSON.stringify(setmap, null, 2));
  pushed++;
  console.log(`pushed ${f} -> ${setId} (${cards.length} cards)`);
  await sleep(1100); // stay under 60 req/min
}
console.log(JSON.stringify({ pushed, skipped, totalSets: files.length, setmap: MAP }, null, 2));
