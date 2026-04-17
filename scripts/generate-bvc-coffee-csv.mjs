#!/usr/bin/env node
// scripts/generate-bvc-coffee-csv.mjs
//
// Generates public/templates/bvc-episode-1-coffee-lessons.csv from the
// source-of-truth markdown + JSON files under content/tutorials/bvc/coffee/.
// Re-run whenever the content there changes to refresh the import-ready CSV.
//
// Usage: node scripts/generate-bvc-coffee-csv.mjs

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const SRC_DIR = join(process.cwd(), 'content/tutorials/bvc/coffee');
const OUT = join(process.cwd(), 'public/templates/bvc-episode-1-coffee-lessons.csv');

const HEADER = 'module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content';

function esc(val) {
  if (val === null || val === undefined || val === '') return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function readMd(name) {
  const raw = await readFile(join(SRC_DIR, name), 'utf8');
  return raw.trim();
}

async function readJsonMinified(name) {
  const raw = await readFile(join(SRC_DIR, name), 'utf8');
  return JSON.stringify(JSON.parse(raw));
}

async function main() {
  const [welcome, geography, social, economics, ela, closing, quizBlurb, project, mapJson, quizJson, docsJson] = await Promise.all([
    readMd('01-welcome.md'),
    readMd('02-geography.md'),
    readMd('03-social-studies.md'),
    readMd('04-economics.md'),
    readMd('05-ela.md'),
    readMd('06-closing.md'),
    readMd('07-quiz.md'),
    readMd('08-project.md'),
    readJsonMinified('map.json'),
    readJsonMinified('quiz.json'),
    readJsonMinified('documents.json'),
  ]);

  const MODULE = 'Season 1 — Coffee';
  // Columns: module_title, module_order, lesson_order, title, lesson_type,
  // duration_seconds, is_free_preview, content_url, text_content, content_format,
  // audio_chapters, transcript_content, map_content, documents, podcast_links, quiz_content
  const rows = [
    [MODULE, 1, 1, 'Welcome — The Morning Ritual', 'text', 120, 'true', '', welcome, 'markdown', '', '', '', docsJson, '', ''],
    [MODULE, 1, 2, 'Geography — Where Coffee Grows', 'text', 480, 'true', '', geography, 'markdown', '', '', mapJson, '', '', ''],
    [MODULE, 1, 3, 'Social Studies — The Coffeehouse Revolution', 'text', 480, 'false', '', social, 'markdown', '', '', '', '', '', ''],
    [MODULE, 1, 4, 'Economics — Follow the Money', 'text', 480, 'false', '', economics, 'markdown', '', '', '', '', '', ''],
    [MODULE, 1, 5, 'ELA — Stories in Every Cup', 'text', 480, 'false', '', ela, 'markdown', '', '', '', '', '', ''],
    [MODULE, 1, 6, 'Closing — Your Morning Altar', 'text', 180, 'false', '', closing, 'markdown', '', '', '', '', '', ''],
    [MODULE, 1, 7, 'Knowledge Check — Coffee', 'quiz', 600, 'false', '', quizBlurb, 'markdown', '', '', '', '', '', quizJson],
    [MODULE, 1, 8, 'Project — Trace Your Favorite Coffee', 'text', 300, 'false', '', project, 'markdown', '', '', '', '', '', ''],
  ];

  const csv = [HEADER, ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n';
  await writeFile(OUT, csv, 'utf8');
  console.log(`Wrote ${OUT} (${rows.length} lessons)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
