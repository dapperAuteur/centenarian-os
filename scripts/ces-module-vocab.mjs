// scripts/ces-module-vocab.mjs
// Builds a per-module "Key Terms" vocabulary lesson for each chapter module (1-18) from the
// official CES vocabulary, mapping each term to its chapter(s) via the term's refs
// ("Chapter N/Lesson M/Page P"). A term that spans chapters appears in each relevant module.
// Writes m<NN>-70-vocabulary.md into _lessons (collected/assembled/loaded by the normal flow).
// The full course-wide glossary stays in the extras module (M20). Run: node scripts/ces-module-vocab.mjs

import fs from 'fs';

const SRC = 'docs/ces-curriculum/source';
const LESSONS = 'docs/ces-curriculum/academy-import/_lessons';
const vocab = JSON.parse(fs.readFileSync(`${SRC}/vocabulary.json`, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(`${SRC}/lesson-manifest.json`, 'utf8'));
const modTitle = new Map();
for (const L of manifest.lessons) if (!modTitle.has(L.module)) modTitle.set(L.module, L.moduleTitle);

const deDash = (s) => String(s || '').replace(/(\d)\s*[‒–—―]\s*(\d)/g, '$1 to $2').replace(/\s*[‒–—―]\s*/g, ', ').replace(/\s+,/g, ',');
const PLAIN = [[/\butilization\b/gi, 'use'], [/\butiliz(e|es|ed|ing)\b/gi, 'use'], [/\bholistic\b/gi, 'whole-person'], [/\bthus\b/gi, 'so'], [/\bregarding\b/gi, 'about'], [/\brobust\b/gi, 'strong'], [/\bcrucial\b/gi, 'key']];
const plain = (s) => PLAIN.reduce((acc, [re, w]) => acc.replace(re, w), deDash(s));

const chapRe = /Chapter\s+(\d+)\s*\//gi;
const byChap = new Map();
for (const e of vocab) {
  if (!e.term || !e.definition) continue;
  const refs = (e.refs || []).join(' ');
  const chaps = new Set();
  let m; chapRe.lastIndex = 0;
  while ((m = chapRe.exec(refs)) !== null) chaps.add(parseInt(m[1], 10));
  for (const c of chaps) { if (!byChap.has(c)) byChap.set(c, []); byChap.get(c).push(e); }
}

const summary = [];
for (const [chap, terms] of [...byChap.entries()].sort((a, b) => a[0] - b[0])) {
  if (chap < 1 || chap > 18) continue;
  const title = (modTitle.get(chap) || `Module ${chap}`).replace(/^Module \d+: /, '');
  terms.sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()));
  const md = [`# ${title}: Key Terms`, '',
    `The vocabulary that matters for this part of the curriculum. ${terms.length} terms. The full course glossary lives in the Resources module.`, ''];
  for (const t of terms) md.push(`**${plain(t.term)}:** ${plain(t.definition)}`, '');
  fs.writeFileSync(`${LESSONS}/m${String(chap).padStart(2, '0')}-70-vocabulary.md`, md.join('\n'));
  summary.push({ module: chap, terms: terms.length });
}
console.log(JSON.stringify({ vocabLessons: summary.length, summary }, null, 2));
