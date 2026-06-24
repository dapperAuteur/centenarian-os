#!/usr/bin/env node
// scripts/bvc-flashlearn-feedback.mjs <episode-slug> [--apply]
//
// Closes the recall-science loop: feeds Academy quiz results into FlashLearn's
// SM-2 scheduler so questions a student gets WRONG resurface as due flashcards.
// This is FlashcardPushGuide Step 3 / flashcard-integration.md Step 4, run as a
// batch job (no live-route change). Default is a dry run; pass --apply to POST.
//
// How it works:
//  1. Build cardExternalId -> setId from flashcards/_setmap.json + the set files.
//  2. Read the episode's quiz pool (quiz.json) for correctOptionId per question.
//  3. Read every student's attempt from lesson_progress.quiz_answers on the quiz
//     lesson, compute isCorrect per answered question, and map questionId "qN" to
//     cardExternalId "bvc:ep<E>:qN".
//  4. POST /study/external-results per (student, set). Idempotent on
//     (externalStudentId, cardExternalId, occurredAt); occurredAt = the progress
//     row's updated_at so re-runs do not double-count.
//
// Run: node --env-file=.env.local scripts/bvc-flashlearn-feedback.mjs coffee [--apply]

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const ROOT = '/Users/bam/Code_NOiCloud/ai-builds/gemini/centenarian-os';
const BASE = 'https://flashlearnai.witus.online/api/v1';
const COURSE_ID = 'ca047c66-f03c-4924-9ebe-16e6bf076a85';
const EPISODES = {
  coffee: { ep: 1, quizTitle: 'Knowledge Check: Coffee' },
  tea: { ep: 2, quizTitle: 'Knowledge Check: Tea' },
  chocolate: { ep: 3, quizTitle: 'Knowledge Check: Chocolate' },
  sugar: { ep: 4, quizTitle: 'Knowledge Check: Sugar' },
  'forest-wisdom': { ep: 5, quizTitle: 'Knowledge Check: Forest Wisdom' },
  kava: { ep: 6, quizTitle: 'Knowledge Check: Kava' },
  synthesis: { ep: 7, quizTitle: 'Knowledge Check: Season Synthesis' },
  beer: { ep: 8, quizTitle: 'Knowledge Check: Beer' },
  wine: { ep: 9, quizTitle: 'Knowledge Check: Wine' },
};

const slug = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!slug || !EPISODES[slug]) { console.error(`usage: bvc-flashlearn-feedback.mjs <episode-slug> [--apply]`); process.exit(1); }
const { ep, quizTitle } = EPISODES[slug];
const KEY = process.env.FLASHLEARN_ECO_API_KEY;
const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY || !sUrl || !sKey) { console.error('Missing FLASHLEARN_ECO_API_KEY or Supabase env'); process.exit(1); }
const db = createClient(sUrl, sKey, { auth: { persistSession: false } });
const DIR = path.join(ROOT, 'plans/BVC/ver1', slug, 'flashcards');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. cardExternalId -> setId
const setmap = JSON.parse(fs.readFileSync(path.join(DIR, '_setmap.json'), 'utf8'));
const cardToSet = new Map();
for (const [file, info] of Object.entries(setmap)) {
  const set = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  for (const c of set.cards) cardToSet.set(c.externalId, info.setId);
}

async function main() {
  // 2. quiz pool
  const quiz = JSON.parse(fs.readFileSync(path.join(ROOT, 'plans/BVC/ver1', slug, 'quiz.json'), 'utf8'));
  const correctById = new Map(quiz.questions.map((q) => [q.id, q.correctOptionId]));

  // 3. find the quiz lesson + read all students' progress
  const { data: lesson } = await db.from('lessons').select('id').eq('course_id', COURSE_ID).eq('title', quizTitle).eq('lesson_type', 'quiz').maybeSingle();
  if (!lesson) { console.error('Quiz lesson not found:', quizTitle); process.exit(1); }
  const { data: progress } = await db.from('lesson_progress').select('user_id, quiz_answers, updated_at').eq('lesson_id', lesson.id).not('quiz_answers', 'is', null);
  console.log(`Quiz lesson ${lesson.id}: ${progress?.length ?? 0} student attempt record(s).`);
  if (!progress?.length) { console.log('No quiz attempts yet. Nothing to feed. (Re-run after students take the quiz.)'); return; }

  // group results per (student, set)
  const payloads = []; // { setId, externalStudentId, results:[...] }
  for (const row of progress) {
    const answers = row.quiz_answers?.answers;
    if (!Array.isArray(answers)) continue;
    const occurredAt = row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString();
    const bySet = new Map();
    for (const a of answers) {
      const correct = correctById.get(a.questionId);
      if (correct === undefined) continue;
      const cardExternalId = `bvc:ep${ep}:${a.questionId}`;
      const setId = cardToSet.get(cardExternalId);
      if (!setId) continue;
      const isCorrect = a.selectedOptionId === correct;
      if (!bySet.has(setId)) bySet.set(setId, []);
      bySet.get(setId).push({ cardExternalId, isCorrect, source: 'academy-quiz', occurredAt });
    }
    for (const [setId, results] of bySet) payloads.push({ setId, externalStudentId: row.user_id, results });
  }
  const totalResults = payloads.reduce((n, p) => n + p.results.length, 0);
  const wrong = payloads.reduce((n, p) => n + p.results.filter((r) => !r.isCorrect).length, 0);
  console.log(`Prepared ${payloads.length} payload(s), ${totalResults} card results (${wrong} wrong -> will resurface sooner).`);

  if (!APPLY) { console.log('[DRY RUN] pass --apply to POST to FlashLearn.'); return; }

  let applied = 0, dup = 0, fail = 0;
  for (const p of payloads) {
    try {
      const res = await fetch(`${BASE}/study/external-results`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { applied += j.applied ?? 0; dup += j.duplicates ?? 0; if (j.unresolvedCardExternalIds?.length) console.log('  unresolved:', j.unresolvedCardExternalIds.join(', ')); }
      else { fail++; console.error(`  HTTP ${res.status}:`, JSON.stringify(j).slice(0, 160)); if (res.status === 401 || res.status === 403) break; }
    } catch (e) { fail++; console.error('  net err:', e.message); }
    await sleep(1200);
  }
  console.log(`done. applied=${applied} duplicates=${dup} failed=${fail}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
