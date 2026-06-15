// scripts/drone-lessons-assemble.mjs
//
// Turns a module's lesson JSON (from the drone-moduleN-lessons workflow) into
// Academy import files. Works for any module.
//
// Input JSON shape: { lessons: [ { n, title, lessonMarkdown, keyTakeaways[],
//   glossary: [{term,phonetic,definition}], runTimeSec } ],
//   review: { lessonMarkdown, runTimeSec } }
//
// Output (in docs/drone-curriculum/academy-import/):
//   - course-import.csv   16-column course-import rows (appended across modules).
//   - glossary.csv        term, phonetic, definition, lesson_title (appended).
//   - content/<module-slug>/<nn>-<lesson-slug>-script.md   full lesson SCRIPT files.
//
// Usage:
//   node scripts/drone-lessons-assemble.mjs <inputJson> <outDir> <moduleTitle> <moduleOrder> <free:true|false> <append:true|false>
// Example (Module 2, appended after Module 1):
//   node scripts/drone-lessons-assemble.mjs docs/.../_module2-lessons.json docs/.../academy-import "Module 2: Regulations" 2 false true

import fs from 'fs';
import path from 'path';

const IN = process.argv[2] || 'docs/drone-curriculum/academy-import/_module1-lessons.json';
const OUT = process.argv[3] || 'docs/drone-curriculum/academy-import';
const MODULE_TITLE = process.argv[4] || 'Module 1: Loading and Performance';
const MODULE_ORDER = parseInt(process.argv[5] || '1', 10);
const FREE = (process.argv[6] || 'true') === 'true' ? 'true' : 'false';
const APPEND = (process.argv[7] || 'false') === 'true';

const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const slug = (s) => String(s || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const HEADER = 'module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content';

const data = JSON.parse(fs.readFileSync(IN, 'utf8'));
const lessons = (data.lessons || []).slice().sort((a, b) => a.n - b.n);

const moduleSlug = slug(MODULE_TITLE);
const contentDir = path.join(OUT, 'content', moduleSlug);
fs.mkdirSync(contentDir, { recursive: true });

function lessonRow(order, title, markdown, durationSec) {
  return [
    csvEscape(MODULE_TITLE), MODULE_ORDER, order, csvEscape(title), 'text',
    durationSec || '', FREE, '', csvEscape(markdown), 'markdown',
    '', '', '', '', '', '',
  ].join(',');
}

const newRows = [];
let order = 0;
for (const l of lessons) {
  order = l.n;
  newRows.push(lessonRow(order, l.title, l.lessonMarkdown, l.runTimeSec));
  fs.writeFileSync(path.join(contentDir, `${String(l.n).padStart(2, '0')}-${slug(l.title)}-script.md`), l.lessonMarkdown + '\n');
}
let reviewTitle = null;
if (data.review && data.review.lessonMarkdown) {
  order += 1;
  reviewTitle = `${MODULE_TITLE.replace(/:.*/, '')} Review: ${MODULE_TITLE.split(': ')[1] || ''}`.trim();
  newRows.push(lessonRow(order, reviewTitle, data.review.lessonMarkdown, data.review.runTimeSec));
  fs.writeFileSync(path.join(contentDir, `${String(order).padStart(2, '0')}-${slug(reviewTitle)}-script.md`), data.review.lessonMarkdown + '\n');
}

// ---- write/append course-import.csv ----
const coursePath = path.join(OUT, 'course-import.csv');
if (APPEND && fs.existsSync(coursePath)) {
  const existing = fs.readFileSync(coursePath, 'utf8').replace(/\n+$/, '');
  fs.writeFileSync(coursePath, existing + '\n' + newRows.join('\n') + '\n');
} else {
  fs.writeFileSync(coursePath, [HEADER, ...newRows].join('\n') + '\n');
}

// ---- glossary (dedup within this module; appended across modules) ----
const seen = new Set();
const glossRows = [];
for (const l of lessons) {
  for (const g of (l.glossary || [])) {
    const key = g.term.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    glossRows.push([csvEscape(g.term), csvEscape(g.phonetic || ''), csvEscape(g.definition || ''), csvEscape(l.title)].join(','));
  }
}
const glossPath = path.join(OUT, 'glossary.csv');
if (APPEND && fs.existsSync(glossPath)) {
  const existing = fs.readFileSync(glossPath, 'utf8').replace(/\n+$/, '');
  fs.writeFileSync(glossPath, existing + '\n' + glossRows.join('\n') + '\n');
} else {
  fs.writeFileSync(glossPath, ['term,phonetic,definition,lesson_title', ...glossRows].join('\n') + '\n');
}

console.log(JSON.stringify({
  module: MODULE_TITLE,
  append: APPEND,
  lessons: lessons.length,
  reviewLesson: !!reviewTitle,
  newRows: newRows.length,
  glossaryTermsAdded: glossRows.length,
  contentDir,
}, null, 2));
