#!/usr/bin/env node
// scripts/generate-bvc-episode-csv.mjs <episode-slug>
//
// Generalized BVC importer-CSV generator. Reads the source-of-truth lessons +
// JSON assets under plans/BVC/ver1/<slug>/ and writes an import-ready 16-column
// CSV to public/templates/. Tracked record + teacher-UI reimport path; the
// authoritative live import is scripts/bvc-academy-load.mjs (which also preserves
// the recorded audio lesson and loads glossary, maps, and the assignment).
//
// Run: node scripts/generate-bvc-episode-csv.mjs coffee|tea

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = '/Users/bam/Code_NOiCloud/ai-builds/gemini/centenarian-os';
// Per episode: number, module title/order, and lesson spec mirroring bvc-academy-load.mjs.
const EPISODES = {
  coffee: {
    ep: 1, moduleTitle: 'Episode 1: Coffee — The Daily Global Connection', moduleOrder: 1,
    lessons: [
      [2, '02-intro.md', 'Coffee, and Why a Cup Is a Classroom', 'text', 180, 'true', null, ['teacher-resources']],
      [3, '03-geo-coffee-belt.md', 'The Coffee Belt: Where Coffee Grows and Why', 'text', 360, 'true', null, []],
      [4, '04-geo-producers.md', 'The Big Producers and Their Terroir', 'text', 420, 'false', 'map-geography.json', []],
      [5, '05-geo-climate.md', 'Climate Change Is Redrawing the Map', 'text', 360, 'false', null, ['bunn-2015']],
      [6, '06-social-coffeehouse.md', 'The Coffeehouse Revolution', 'text', 480, 'false', null, ['royal-proclamation-1675', 'womens-petition-1674', 'mens-answer-1674']],
      [7, '07-social-two-truths.md', 'Two Truths: Democracy and Colonial Labor', 'text', 420, 'false', 'map-trade.json', ['colonial-plantation-records']],
      [8, '08-econ-bean-to-cup.md', 'Follow the Money: Bean to Cup', 'text', 420, 'false', null, []],
      [9, '09-econ-trade-models.md', 'Fair Trade, Direct Trade, and Commodity', 'text', 420, 'false', null, []],
      [10, '10-econ-price-shocks.md', 'Price Shocks and Why You Keep Buying', 'text', 420, 'false', null, []],
      [11, '11-ela-words.md', 'The Words Coffee Carries', 'text', 360, 'false', null, []],
      [12, '12-ela-ceremony.md', 'The Ethiopian Ceremony as Story', 'text', 360, 'false', null, []],
      [13, '13-ela-ads.md', 'Reading a Coffee Ad', 'text', 420, 'false', null, []],
      [14, '14-key-terms.md', 'Key Terms: Coffee', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Coffee', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Coffee', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Coffee', 'quiz', 720, 'false', null, []],
    ],
  },
  tea: {
    ep: 2, moduleTitle: 'Episode 2: Tea — The Way of Tea', moduleOrder: 2,
    lessons: [
      [2, '02-intro.md', 'Tea, and the Plant Behind Every Cup', 'text', 180, 'true', null, []],
      [3, '03-geo-climate-zones.md', 'The Tea Plant and Its Climate Zones', 'text', 420, 'true', null, []],
      [4, '04-geo-producers.md', 'The Big Producers and the First Flush', 'text', 360, 'false', 'map-geography.json', []],
      [5, '05-geo-trade-routes.md', 'The Roads Tea Traveled', 'text', 420, 'false', 'map-trade.json', []],
      [6, '06-social-origins-ceremony.md', 'From Medicine to Ceremony', 'text', 480, 'false', null, []],
      [7, '07-social-boston-tea-party.md', 'The Boston Tea Party', 'text', 420, 'false', null, ['boston-tea-party-loc']],
      [8, '08-social-who-grows-tea.md', 'Who Grows the Tea', 'text', 360, 'false', null, []],
      [9, '09-econ-one-leaf-many-teas.md', 'One Leaf, Many Teas', 'text', 420, 'false', null, []],
      [10, '10-econ-who-gets-paid.md', 'Who Gets Paid, Tea and Coffee Compared', 'text', 420, 'false', null, []],
      [11, '11-ela-cha-and-te.md', 'Cha and Te', 'text', 360, 'false', null, []],
      [12, '12-ela-classic-and-way.md', 'The Classic of Tea and the Way of Tea', 'text', 360, 'false', null, ['okakura-book-of-tea', 'classic-of-tea']],
      [13, '13-ela-tea-ad.md', 'Reading a Tea Ad', 'text', 420, 'false', null, ['orwell-nice-cup-of-tea']],
      [14, '14-key-terms.md', 'Key Terms: Tea', 'text', 300, 'false', null, []],
      [15, '15-review.md', 'Cumulative Review: Tea', 'text', 360, 'false', null, []],
      [16, '16-references.md', 'Sources and Further Reading: Tea', 'text', 180, 'false', null, []],
      [17, '17-quiz.md', 'Knowledge Check: Tea', 'quiz', 720, 'false', null, []],
    ],
  },
};
const slug = process.argv[2];
if (!slug || !EPISODES[slug]) { console.error(`usage: generate-bvc-episode-csv.mjs <episode-slug>`); process.exit(1); }
const { ep, moduleTitle, moduleOrder, lessons } = EPISODES[slug];
const SRC = join(ROOT, 'plans/BVC/ver1', slug);
const OUT = join(ROOT, 'public/templates', `bvc-episode-${ep}-${slug}-lessons.csv`);

const HEADER = 'module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content';
function esc(v) { if (v === null || v === undefined || v === '') return ''; const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function body(file) {
  const raw = readFileSync(join(SRC, file), 'utf8'); const lines = raw.split('\n'); let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i]?.startsWith('# ')) { i++; while (i < lines.length && lines[i].trim() === '') i++; }
  return lines.slice(i).join('\n').trim();
}
function jmin(file) { return JSON.stringify(JSON.parse(readFileSync(join(SRC, file), 'utf8'))); }
function isHttps(u) { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } }

const docs = JSON.parse(readFileSync(join(SRC, 'documents.json'), 'utf8'));
const docById = new Map(docs.filter((d) => isHttps(d.url)).map((d) => [d.id, { title: d.title, description: d.description, url: d.url, source_url: d.source_url ?? null }]));

const rows = lessons.map(([order, file, title, type, dur, free, mapFile, docIds]) => {
  const map = mapFile && existsSync(join(SRC, mapFile)) ? jmin(mapFile) : '';
  const quiz = type === 'quiz' ? jmin('quiz.json') : '';
  const attach = docIds.map((id) => docById.get(id)).filter(Boolean);
  const documents = attach.length ? JSON.stringify(attach) : '';
  return [moduleTitle, moduleOrder, order, title, type, dur, free, '', body(file), 'markdown', '', '', map, documents, '', quiz];
});

const csv = [HEADER, ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n';
writeFileSync(OUT, csv, 'utf8');
console.log(`Wrote ${OUT} (${rows.length} lessons; audio lesson preserved separately by bvc-academy-load.mjs)`);
