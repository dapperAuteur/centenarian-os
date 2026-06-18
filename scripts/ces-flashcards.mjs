// scripts/ces-flashcards.mjs
// Generates flashlearn-ai set-create bodies from course content: a glossary set (from the
// vocabulary) and one quiz set per module (from _quiz-verified.json once quizzes exist).
// Each card carries a stable externalId so course quiz results can later drive flashlearn
// scheduling (see docs/CentenarianAcademy/FlashlearnIntegrationSpec.md). Output files are
// ready to POST to flashlearn /api/v1/sets. Run: node scripts/ces-flashcards.mjs

import fs from 'fs';
import path from 'path';

const SRC = 'docs/ces-curriculum/source';
const AI = 'docs/ces-curriculum/academy-import';
const OUT = `${AI}/flashcards`;
fs.mkdirSync(OUT, { recursive: true });

const deDash = (s) => String(s || '').replace(/(\d)\s*[‒–—―]\s*(\d)/g, '$1 to $2').replace(/\s*[‒–—―]\s*/g, ', ').replace(/\s+,/g, ',').trim();
const slug = (s) => String(s || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const written = [];

// 1) Glossary set
if (fs.existsSync(`${SRC}/vocabulary.json`)) {
  const vocab = JSON.parse(fs.readFileSync(`${SRC}/vocabulary.json`, 'utf8')).filter((e) => e.term && e.definition);
  const set = {
    title: 'NASM CES Accelerator — Glossary',
    description: 'Key terms for the NASM CES exam, from the Corrective Exercise Specialist Accelerator.',
    isPublic: true,
    flashcards: vocab.map((e) => ({ front: deDash(e.term), back: deDash(e.definition), externalId: `ces:glossary:${slug(e.term)}` })),
  };
  fs.writeFileSync(`${OUT}/glossary-set.json`, JSON.stringify(set, null, 2));
  written.push({ file: 'glossary-set.json', cards: set.flashcards.length });
}

// 2) Per-module quiz sets (once _quiz-verified.json exists)
if (fs.existsSync(`${AI}/_quiz-verified.json`)) {
  const questions = (JSON.parse(fs.readFileSync(`${AI}/_quiz-verified.json`, 'utf8')).questions || [])
    .filter((q) => !q.verdict || q.verdict.agree); // only verified-good
  const byModule = new Map();
  for (const q of questions) {
    const key = q.moduleOrder ?? 99;
    if (!byModule.has(key)) byModule.set(key, { title: q.moduleTitle || `Module ${key}`, qs: [] });
    byModule.get(key).qs.push(q);
  }
  for (const [order, data] of [...byModule.entries()].sort((a, b) => a[0] - b[0])) {
    const set = {
      title: `NASM CES Accelerator — ${data.title} Flashcards`,
      description: `Recall cards drawn from the ${data.title} quiz pool.`,
      isPublic: true,
      flashcards: data.qs.map((q, i) => ({
        front: deDash(q.question),
        back: deDash(`${q.correctAnswerText}. ${q.explanation || ''}`.trim()),
        externalId: `ces:m${order}:q${i + 1}`,
      })),
    };
    fs.writeFileSync(`${OUT}/m${String(order).padStart(2, '0')}-quiz-set.json`, JSON.stringify(set, null, 2));
    written.push({ file: `m${String(order).padStart(2, '0')}-quiz-set.json`, cards: set.flashcards.length });
  }
} else {
  console.log('(no _quiz-verified.json yet — quiz flashcard sets will generate after quizzes are built)');
}

console.log(JSON.stringify({ outDir: OUT, sets: written }, null, 2));
