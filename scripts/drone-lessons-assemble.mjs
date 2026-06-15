// scripts/drone-lessons-assemble.mjs
//
// Turns the Module 1 lesson JSON (from the drone-module1-lessons workflow) into
// Academy import files.
//
// Input: a JSON file with shape { lessons: [ { n, title, lessonMarkdown,
//   keyTakeaways[], glossary: [{term,phonetic,definition}], runTimeSec } ],
//   review: { lessonMarkdown, runTimeSec } }
//
// Output (in docs/drone-curriculum/academy-import/):
//   - course-import.csv   16-column course-import rows: Module 1 text lessons + review.
//   - glossary.csv        term, phonetic, definition, lesson_title (deduped).
//   - content/<nn>-<slug>.md   each lesson as a standalone markdown file (for editing).
//
// Usage: node scripts/drone-lessons-assemble.mjs [inputJson] [outDir]

import fs from 'fs';
import path from 'path';

const IN = process.argv[2] || 'docs/drone-curriculum/academy-import/_module1-lessons.json';
const OUT = process.argv[3] || 'docs/drone-curriculum/academy-import';
const MODULE_TITLE = 'Module 1: Loading and Performance';
const MODULE_ORDER = 1;
const FREE = 'true'; // Module 1 is the free sample per the course metadata

const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const slug = (s) => String(s || 'lesson').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const data = JSON.parse(fs.readFileSync(IN, 'utf8'));
const lessons = (data.lessons || []).slice().sort((a, b) => a.n - b.n);

const HEADER = 'module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content';
const rows = [HEADER];
const contentDir = path.join(OUT, 'content');
fs.mkdirSync(contentDir, { recursive: true });

function lessonRow(order, title, markdown, durationSec) {
  return [
    csvEscape(MODULE_TITLE), MODULE_ORDER, order, csvEscape(title), 'text',
    durationSec || '', FREE, '', csvEscape(markdown), 'markdown',
    '', '', '', '', '', '',
  ].join(',');
}

let order = 0;
for (const l of lessons) {
  order = l.n;
  rows.push(lessonRow(order, l.title, l.lessonMarkdown, l.runTimeSec));
  fs.writeFileSync(path.join(contentDir, `${String(l.n).padStart(2, '0')}-${slug(l.title)}.md`), l.lessonMarkdown + '\n');
}
if (data.review && data.review.lessonMarkdown) {
  order += 1;
  const title = 'Module 1 Review: Loading and Performance';
  rows.push(lessonRow(order, title, data.review.lessonMarkdown, data.review.runTimeSec));
  fs.writeFileSync(path.join(contentDir, `${String(order).padStart(2, '0')}-module-1-review.md`), data.review.lessonMarkdown + '\n');
}

fs.writeFileSync(path.join(OUT, 'course-import.csv'), rows.join('\n') + '\n');

// ---- glossary (deduped by term, first occurrence wins) ----
const seen = new Set();
const gloss = ['term,phonetic,definition,lesson_title'];
for (const l of lessons) {
  for (const g of (l.glossary || [])) {
    const key = g.term.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    gloss.push([csvEscape(g.term), csvEscape(g.phonetic || ''), csvEscape(g.definition || ''), csvEscape(l.title)].join(','));
  }
}
fs.writeFileSync(path.join(OUT, 'glossary.csv'), gloss.join('\n') + '\n');

console.log(JSON.stringify({
  lessons: lessons.length,
  reviewLesson: !!(data.review && data.review.lessonMarkdown),
  totalRows: rows.length - 1,
  glossaryTerms: gloss.length - 1,
}, null, 2));
