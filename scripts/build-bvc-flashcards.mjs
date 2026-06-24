#!/usr/bin/env node
// scripts/build-bvc-flashcards.mjs <episode-slug>
//
// Builds FlashLearn card sets for a Better Vice Club episode from its
// glossary.csv (term cards) and quiz.json (authored multiple-choice cards),
// following docs/CentenarianAcademy/FlashcardPushGuide.md + FlashcardMC-and-Media.md.
//
// Recall science:
//  - Quiz-derived cards keep the authored options + correctOptionId, so study is
//    retrieval practice (a re-test), not re-reading.
//  - Every card carries a STABLE externalId so quiz results can later feed
//    FlashLearn's SM-2 scheduler (wrong answers resurface). See bvc-flashlearn-feedback.mjs.
//      term card:  bvc:ep<N>:term:<slug>
//      quiz card:  bvc:ep<N>:<questionId>   (questionId is "q1".."q36")
//  - Sets are capped at 20 cards each (smaller decks study better).
//
// Output: plans/BVC/ver1/<slug>/flashcards/*.json  +  reads back nothing.
// Run: node scripts/build-bvc-flashcards.mjs coffee

import fs from 'fs';
import path from 'path';

const EPISODES = {
  coffee: { ep: 1, label: 'Coffee' },
  tea: { ep: 2, label: 'Tea' },
  chocolate: { ep: 3, label: 'Chocolate' },
  sugar: { ep: 4, label: 'Sugar' },
  'forest-wisdom': { ep: 5, label: 'Forest Wisdom' },
  kava: { ep: 6, label: 'Kava' },
  synthesis: { ep: 7, label: 'Season Synthesis' },
  beer: { ep: 8, label: 'Beer' },
  wine: { ep: 9, label: 'Wine' },
  whiskey: { ep: 10, label: 'Whiskey' },
};

const slug = process.argv[2];
if (!slug || !EPISODES[slug]) {
  console.error(`usage: build-bvc-flashcards.mjs <episode-slug>  (known: ${Object.keys(EPISODES).join(', ')})`);
  process.exit(1);
}
const { ep, label } = EPISODES[slug];
const ROOT = '/Users/bam/Code_NOiCloud/ai-builds/gemini/centenarian-os';
const SRC = path.join(ROOT, 'plans/BVC/ver1', slug);
const OUT = path.join(SRC, 'flashcards');

function termSlug(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// minimal CSV row parser (handles quoted fields + escaped quotes)
function parseRow(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function chunk(arr, size) {
  const out = [];
  const groups = Math.max(1, Math.ceil(arr.length / size));
  const per = Math.ceil(arr.length / groups); // balance the sets
  for (let i = 0; i < arr.length; i += per) out.push(arr.slice(i, i + per));
  return out;
}

// ---- term cards from glossary.csv ----
const gloss = fs.readFileSync(path.join(SRC, 'glossary.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
const header = parseRow(gloss[0]); // term,phonetic,definition,lesson_title
const termCards = gloss.slice(1).map((line) => {
  const [term, phonetic, definition] = parseRow(line);
  const front = phonetic ? `${term} (${phonetic})` : term;
  return { front, back: definition, externalId: `bvc:ep${ep}:term:${termSlug(term)}` };
});

// ---- quiz cards from quiz.json (authored multiple-choice) ----
const quiz = JSON.parse(fs.readFileSync(path.join(SRC, 'quiz.json'), 'utf8'));
const quizCards = quiz.questions.map((q) => {
  const correct = q.options.find((o) => o.id === q.correctOptionId);
  return {
    front: q.questionText,
    back: `${correct ? correct.text : ''}. ${q.explanation}`.trim(),
    externalId: `bvc:ep${ep}:${q.id}`,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
    correctOptionId: q.correctOptionId,
  };
});

fs.mkdirSync(OUT, { recursive: true });
// clear old built sets (but keep _setmap.json so pushed ids survive)
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json') && f !== '_setmap.json') fs.unlinkSync(path.join(OUT, f));

function writeSets(cards, kind, fileKind) {
  const groups = chunk(cards, 20);
  groups.forEach((cs, i) => {
    const n = groups.length;
    const title = n > 1 ? `${label} ${kind} (${i + 1} of ${n})` : `${label} ${kind}`;
    const set = {
      title,
      description: `${kind} for Better Vice Club, Episode ${ep}: ${label}. Part of the WitUS Centenarian Academy.`,
      isPublic: true,
      cards: cs,
    };
    const file = n > 1 ? `${slug}-${fileKind}-p${String(i + 1).padStart(2, '0')}.json` : `${slug}-${fileKind}.json`;
    fs.writeFileSync(path.join(OUT, file), JSON.stringify(set, null, 2));
    console.log(`  ${file}: ${cs.length} cards  "${title}"`);
  });
}

console.log(`Episode ${ep} (${label}): ${termCards.length} term cards, ${quizCards.length} quiz cards`);
writeSets(termCards, 'Key Terms', 'keyterms');
writeSets(quizCards, 'Quiz Practice', 'quiz');
console.log(`Wrote sets to ${OUT}`);
