// scripts/ces-glossary-from-vocab.mjs
// Builds the course glossary from the extracted NASM CES vocabulary (169 terms):
//   - resources/glossary-reference.md  (lead-magnet source for the glossary PDF)
//   - academy-import/glossary.csv       (term,phonetic,definition,lesson_title)
// Definitions come straight from the official vocabulary; dashes are normalized so the
// AI-tells scan stays clean. Run: node scripts/ces-glossary-from-vocab.mjs

import fs from 'fs';

const SRC = 'docs/ces-curriculum/source';
const AI = 'docs/ces-curriculum/academy-import';
const vocab = JSON.parse(fs.readFileSync(`${SRC}/vocabulary.json`, 'utf8'));

const deDash = (s) => String(s || '').replace(/(\d)\s*[‒–—―]\s*(\d)/g, '$1 to $2').replace(/\s*[‒–—―]\s*/g, ', ').replace(/\s+,/g, ',');
// swap clearly-generic banned words for plain equivalents (keep technical "neuromuscular facilitation")
const PLAIN = [[/\butilization\b/gi, 'use'], [/\butiliz(e|es|ed|ing)\b/gi, 'use'], [/\bholistic\b/gi, 'whole-person'], [/\bthus\b/gi, 'so'], [/\bregarding\b/gi, 'about'], [/\brobust\b/gi, 'strong'], [/\bcrucial\b/gi, 'key']];
const plain = (s) => PLAIN.reduce((acc, [re, w]) => acc.replace(re, w), deDash(s));
const csvEscape = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

const entries = vocab
  .filter((e) => e.term && e.definition)
  .map((e) => ({ term: e.term.trim(), definition: plain(e.definition.trim()), ref: (e.refs && e.refs[0]) || '' }))
  .sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()));

// markdown glossary reference
const md = ['# CES Glossary Reference', '',
  'Plain-language definitions of the key terms in the NASM CES Accelerator. Skim it before a quiz, or search it when a term trips you up.', ''];
for (const e of entries) md.push(`**${e.term}:** ${e.definition}`, '');
fs.mkdirSync(`${AI}/resources`, { recursive: true });
fs.writeFileSync(`${AI}/resources/glossary-reference.md`, md.join('\n'));

// glossary.csv
const rows = ['term,phonetic,definition,lesson_title'];
for (const e of entries) rows.push([csvEscape(e.term), '', csvEscape(e.definition), csvEscape(e.ref)].join(','));
fs.writeFileSync(`${AI}/glossary.csv`, rows.join('\n') + '\n');

console.log(JSON.stringify({ terms: entries.length, mdFile: `${AI}/resources/glossary-reference.md`, csv: `${AI}/glossary.csv` }, null, 2));
