// scripts/ces-cheatsheet.mjs
// Builds resources/complete-cheat-sheet.md from the "## Key takeaways" sections of the
// authored content lessons. Run AFTER lessons are authored. Output is the lead-magnet
// source for the cheat-sheet PDF. Run: node scripts/ces-cheatsheet.mjs

import fs from 'fs';
import path from 'path';

const SRC = 'docs/ces-curriculum/source';
const LESSONS_DIR = 'docs/ces-curriculum/academy-import/_lessons';
const OUT = 'docs/ces-curriculum/academy-import/resources/complete-cheat-sheet.md';
const manifest = JSON.parse(fs.readFileSync(`${SRC}/lesson-manifest.json`, 'utf8'));
const modTitle = new Map();
for (const L of manifest.lessons) if (!modTitle.has(L.module)) modTitle.set(L.module, L.moduleTitle);

function takeaways(md) {
  const m = md.match(/##\s*Key takeaways\s*\n([\s\S]*?)(\n##\s|$)/i);
  if (!m) return [];
  return m[1].split('\n').map((l) => l.replace(/^\s*[-*]\s+/, '').trim()).filter((l) => l.length > 3);
}

const files = fs.readdirSync(LESSONS_DIR).filter((f) => /^m\d+-\d+-content\.md$/.test(f)).sort();
const byModule = new Map();
for (const f of files) {
  const mm = f.match(/^m(\d+)-(\d+)-content\.md$/);
  const module = parseInt(mm[1], 10), n = parseInt(mm[2], 10);
  const md = fs.readFileSync(path.join(LESSONS_DIR, f), 'utf8');
  const title = (md.match(/^#\s+(.+)$/m) || [, ''])[1].trim();
  const tks = takeaways(md);
  if (!byModule.has(module)) byModule.set(module, []);
  byModule.get(module).push({ n, title, tks });
}

const out = ['# CES Complete Cheat Sheet', '',
  'Every key fact from the course in one place, in order. The spine of it all is the Corrective Exercise Continuum: inhibit, lengthen, activate, integrate. Read this the week before your exam.', ''];
let totalFacts = 0;
for (const [module, lessons] of [...byModule.entries()].sort((a, b) => a[0] - b[0])) {
  out.push(`## ${modTitle.get(module) || `Module ${module}`}`, '');
  for (const l of lessons.sort((a, b) => a.n - b.n)) {
    if (!l.tks.length) continue;
    out.push(`**${l.title}**`, '');
    for (const t of l.tks) { out.push(`- ${t}`); totalFacts++; }
    out.push('');
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.join('\n'));
console.log(JSON.stringify({ modules: byModule.size, lessons: files.length, facts: totalFacts, out: OUT }, null, 2));
