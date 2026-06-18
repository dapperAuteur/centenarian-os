// scripts/ces-build-resources-csv.mjs
// Builds Module 20 (Resources and Downloads): 4 free-preview text lessons, each with its
// Cloudinary-hosted PDF attached as a downloadable document. Reads the upload manifest.
// Run: node scripts/ces-build-resources-csv.mjs

import fs from 'fs';

const AI = 'docs/ces-curriculum/academy-import';
const uploads = JSON.parse(fs.readFileSync(`${AI}/resources/pdf/_uploads.json`, 'utf8'));
const csvEscape = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const HEADER = 'module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content';
const MODULE = 'Module 20: Resources and Downloads';

const LESSONS = [
  { n: 1, pdf: 'study-plan.pdf', title: 'Your CES Study Plan', docTitle: 'CES Study Plan (PDF)',
    body: '# Your CES Study Plan\n\nThis is your map to the exam. Pick the eight-week or four-week path, build the audio-first habit, and quiz yourself often. Download the full plan below and keep it somewhere you will see it.' },
  { n: 2, pdf: 'exam-day-checklist.pdf', title: 'Exam-Day Checklist', docTitle: 'Exam-Day Checklist (PDF)',
    body: '# Exam-Day Checklist\n\nTest day is 100 questions in 90 minutes, about 54 seconds each, and you pass at a scaled score of 70. This checklist keeps the day calm so your studying can do its job. Download it and run through it the night before.' },
  { n: 3, pdf: 'complete-cheat-sheet.pdf', title: 'The Complete Cheat Sheet', docTitle: 'Complete Cheat Sheet (PDF)',
    body: '# The Complete Cheat Sheet\n\nEvery key fact from the course, in order, on one printable sheet. The spine is the Corrective Exercise Continuum: inhibit, lengthen, activate, integrate. Download it and review it in the last week before your exam.' },
  { n: 4, pdf: 'glossary-reference.pdf', title: 'Glossary Reference', docTitle: 'Glossary Reference (PDF)',
    body: '# Glossary Reference\n\nPlain-language definitions of every term in the course. Skim it before a quiz, or search it when a term trips you up. Download the full glossary below.' },
];

const rows = [HEADER];
for (const L of LESSONS) {
  const url = uploads[L.pdf];
  if (!url) { console.error(`Missing upload for ${L.pdf}`); process.exit(1); }
  const documents = JSON.stringify([{ id: L.pdf.replace('.pdf', ''), url, title: L.docTitle, description: 'Downloadable PDF' }]);
  rows.push([
    csvEscape(MODULE), 20, L.n, csvEscape(L.title), 'text', '', 'true', '',
    csvEscape(L.body), 'markdown', '', '', '', csvEscape(documents), '', '',
  ].join(','));
}
fs.writeFileSync(`${AI}/resources-import.csv`, rows.join('\n') + '\n');
console.log(JSON.stringify({ lessons: LESSONS.length, out: `${AI}/resources-import.csv` }, null, 2));
