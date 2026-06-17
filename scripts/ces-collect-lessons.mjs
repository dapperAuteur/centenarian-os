// scripts/ces-collect-lessons.mjs
// Collects authored lesson .md files (docs/ces-curriculum/academy-import/_lessons/
// named m<MM>-<nn>-<type>.md) into per-module JSON in the shape drone-lessons-assemble.mjs
// expects: { lessons: [{ n, title, lessonMarkdown, glossary, runTimeSec }] }.
// File-driven: picks up content, review, exam-walkthrough, and practice lessons.
// Title = the first "# " heading. moduleTitle/free come from the manifest by module.
// Glossary is built separately (vocabulary.json), so per-lesson glossary is empty.
// Run: node scripts/ces-collect-lessons.mjs

import fs from 'fs';
import path from 'path';

const SRC = 'docs/ces-curriculum/source';
const LESSONS_DIR = 'docs/ces-curriculum/academy-import/_lessons';
const manifest = JSON.parse(fs.readFileSync(`${SRC}/lesson-manifest.json`, 'utf8'));
const pad = (x) => String(x).padStart(2, '0');

const modInfo = new Map(); // module -> {title, free}
for (const L of manifest.lessons) if (!modInfo.has(L.module)) modInfo.set(L.module, { title: L.moduleTitle, free: L.free });
// modules added later (e.g., 20 resources) can be supplied via manifest too; fallback below.

const files = fs.readdirSync(LESSONS_DIR).filter((f) => /^m\d+-\d+-[a-z-]+\.md$/.test(f));
const byModule = new Map();
for (const f of files) {
  const m = f.match(/^m(\d+)-(\d+)-([a-z-]+)\.md$/);
  const module = parseInt(m[1], 10), n = parseInt(m[2], 10), type = m[3];
  const md = fs.readFileSync(path.join(LESSONS_DIR, f), 'utf8').trim();
  const title = (md.match(/^#\s+(.+)$/m) || [, `Module ${module} Lesson ${n}`])[1].trim();
  const words = md.split(/\s+/).filter(Boolean).length;
  const runTimeSec = Math.max(180, Math.min(600, Math.round((words / 150) * 60)));
  const info = modInfo.get(module) || { title: `Module ${module}`, free: false };
  if (!byModule.has(module)) byModule.set(module, { module, moduleTitle: info.title, free: info.free, lessons: [] });
  byModule.get(module).lessons.push({ n, title, type, lessonMarkdown: md, glossary: [], runTimeSec, words });
}

const summary = [];
for (const [mod, data] of [...byModule.entries()].sort((a, b) => a[0] - b[0])) {
  data.lessons.sort((a, b) => a.n - b.n);
  fs.writeFileSync(`${SRC}/_module${pad(mod)}-lessons.json`, JSON.stringify({ module: mod, moduleTitle: data.moduleTitle, free: data.free, lessons: data.lessons }, null, 2));
  const wc = data.lessons.map((l) => l.words);
  summary.push({ module: mod, lessons: data.lessons.length, types: [...new Set(data.lessons.map((l) => l.type))].join('+'), minW: Math.min(...wc), maxW: Math.max(...wc) });
}
console.log(JSON.stringify({ modulesWritten: summary.length, totalLessons: files.length, summary }, null, 2));
