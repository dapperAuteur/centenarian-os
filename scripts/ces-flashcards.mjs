// scripts/ces-flashcards.mjs
// Generates flashlearn-ai set-create bodies from course content: a glossary set (from the
// vocabulary) and one quiz set per module (from _quiz-verified.json). Each card carries a
// stable externalId. SETS ARE CAPPED AT 20 CARDS: any larger set is split into balanced
// "(Part k of N)" files. Output files are ready to POST to flashlearn /api/v1/sets.
// Run: node scripts/ces-flashcards.mjs

import fs from 'fs';

const SRC = 'docs/ces-curriculum/source';
const AI = 'docs/ces-curriculum/academy-import';
const OUT = `${AI}/flashcards`;
const MAX = 20;
fs.mkdirSync(OUT, { recursive: true });

const deDash = (s) => String(s || '').replace(/(\d)\s*[‒–—―]\s*(\d)/g, '$1 to $2').replace(/\s*[‒–—―]\s*/g, ', ').replace(/\s+,/g, ',').trim();
const slug = (s) => String(s || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const pad = (x) => String(x).padStart(2, '0');
const written = [];

// Write a set as one file if <=MAX cards, else balanced "(Part k of N)" files.
function writeSet(base, title, description, cards) {
  if (cards.length <= MAX) {
    fs.writeFileSync(`${OUT}/${base}.json`, JSON.stringify({ title, description, isPublic: true, flashcards: cards }, null, 2));
    written.push({ file: `${base}.json`, cards: cards.length });
    return;
  }
  const n = Math.ceil(cards.length / MAX);
  const size = Math.ceil(cards.length / n);
  for (let k = 0; k < n; k++) {
    const chunk = cards.slice(k * size, (k + 1) * size);
    if (!chunk.length) continue;
    fs.writeFileSync(`${OUT}/${base}-p${k + 1}.json`, JSON.stringify({ title: `${title} (Part ${k + 1} of ${n})`, description, isPublic: true, flashcards: chunk }, null, 2));
    written.push({ file: `${base}-p${k + 1}.json`, cards: chunk.length });
  }
}

// 1) Glossary set (course-wide)
if (fs.existsSync(`${SRC}/vocabulary.json`)) {
  const vocab = JSON.parse(fs.readFileSync(`${SRC}/vocabulary.json`, 'utf8')).filter((e) => e.term && e.definition);
  const cards = vocab.map((e) => ({ front: deDash(e.term), back: deDash(e.definition), externalId: `ces:glossary:${slug(e.term)}` }));
  writeSet('glossary-set', 'NASM CES Accelerator — Glossary', 'Key terms for the NASM CES exam. Not affiliated with NASM.', cards);
}

// 2) Per-module quiz sets
if (fs.existsSync(`${AI}/_quiz-verified.json`)) {
  const questions = (JSON.parse(fs.readFileSync(`${AI}/_quiz-verified.json`, 'utf8')).questions || []).filter((q) => !q.verdict || q.verdict.agree);
  const byModule = new Map();
  for (const q of questions) {
    const key = q.moduleOrder ?? 99;
    if (!byModule.has(key)) byModule.set(key, { title: q.moduleTitle || `Module ${key}`, qs: [] });
    byModule.get(key).qs.push(q);
  }
  for (const [order, data] of [...byModule.entries()].sort((a, b) => a[0] - b[0])) {
    const cards = data.qs.map((q, i) => ({ front: deDash(q.question), back: deDash(`${q.correctAnswerText}. ${q.explanation || ''}`.trim()), externalId: `ces:m${order}:q${i + 1}` }));
    writeSet(`m${pad(order)}-quiz-set`, `NASM CES Accelerator — ${data.title} Flashcards`, 'Recall cards from this module. Not affiliated with NASM.', cards);
  }
} else {
  console.log('(no _quiz-verified.json yet)');
}

const over = written.filter((w) => w.cards > MAX);
console.log(JSON.stringify({ outDir: OUT, sets: written.length, maxCards: Math.max(...written.map((w) => w.cards)), oversized: over.length, files: written }, null, 2));
