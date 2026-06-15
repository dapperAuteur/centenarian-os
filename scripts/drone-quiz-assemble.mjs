// scripts/drone-quiz-assemble.mjs
//
// Turns the verified FAA Part 107 quiz JSON (produced by the drone-quiz-extract-verify
// workflow) into Academy import files.
//
// Input: a JSON file with shape { questions: [ { quizName, question, options[],
//   correctAnswerText, explanation, figureRef, qid, verdict: { agree,
//   suggestedCorrectText, confidence, isFigureDependent, notes } , _conflict? } ] }
//
// Output (written next to the input, in docs/drone-curriculum/academy-import/):
//   - quizzes-import.csv        16-column course-import rows, one quiz lesson per quiz,
//                               quiz_content as JSON. Only verified-good questions.
//   - quizzes-NEEDS-REVIEW.md   every flagged question (verifier disagreed, low
//                               confidence, source conflict) with both answers.
//   - flat/<quiz>.csv           per-quiz flat CSV (question, option_a..d, correct_letter,
//                               explanation, subject_tag, image_url) for editor paste.
//
// Usage: node scripts/drone-quiz-assemble.mjs [inputJson] [outDir]

import fs from 'fs';
import path from 'path';

const IN = process.argv[2] || 'docs/drone-curriculum/academy-import/_quiz-verified.json';
const OUT = process.argv[3] || 'docs/drone-curriculum/academy-import';

// ---- module mapping: quizName -> { module, order, free } ----
function moduleFor(quizName) {
  const q = (quizName || '').toLowerCase();
  if (/performance/.test(q)) return { title: 'Module 1: Loading and Performance', order: 1, free: true };
  if (/regulation/.test(q)) return { title: 'Module 2: Regulations', order: 2, free: false };
  if (/airport/.test(q)) return { title: 'Module 3: Airport Operations', order: 3, free: false };
  if (/radio/.test(q)) return { title: 'Module 4: Radio Communications', order: 4, free: false };
  if (/airspace/.test(q)) return { title: 'Module 5: Airspace', order: 5, free: false };
  if (/chart/.test(q)) return { title: 'Module 6: Sectional Charts', order: 6, free: false };
  if (/weather theory/.test(q)) return { title: 'Module 7: Weather Theory', order: 7, free: false };
  if (/weather service/.test(q)) return { title: 'Module 8: Weather Services', order: 8, free: false };
  if (/(aeronautical|decision|adm)/.test(q)) return { title: 'Module 9: Aeronautical Decision Making', order: 9, free: false };
  if (/(physiolog|night)/.test(q)) return { title: 'Module 10: Physiology and Night Operations', order: 10, free: false };
  if (/procedure/.test(q)) return { title: 'Module 11: Procedures and Maintenance', order: 11, free: false };
  return { title: 'Module 12: Practice Exam', order: 12, free: false };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const slug = (s) => String(s || 'quiz').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const data = JSON.parse(fs.readFileSync(IN, 'utf8'));
const questions = data.questions || [];

// ---- classify each question ----
const good = [];        // ship in clean import
const review = [];       // human must look (disagreement / low conf / conflict)
for (const q of questions) {
  const v = q.verdict || {};
  const flagged = (v.agree === false && !v.isFigureDependent) || v._conflict || q._conflict ||
    (v.confidence === 'low' && !v.isFigureDependent);
  if (flagged) review.push(q); else good.push(q);
}

// ---- build a quiz_content question object ----
function toQuizQuestion(q, idx) {
  const id = `q${idx + 1}`;
  const options = (q.options || []).map((text, j) => ({ id: `${id}o${j + 1}`, text: String(text).trim() }));
  // resolve correct option by exact-ish text match against the marked correct answer
  let correct = options.find((o) => norm(o.text) === norm(q.correctAnswerText));
  if (!correct) correct = options.find((o) => norm(o.text).includes(norm(q.correctAnswerText)) || norm(q.correctAnswerText).includes(norm(o.text)));
  return {
    obj: {
      id,
      questionText: String(q.question).trim(),
      questionType: 'multiple_choice',
      options,
      correctOptionId: correct ? correct.id : (options[0]?.id || ''),
      explanation: String(q.explanation || '').trim(),
      ...(q.figureRef ? { citation: q.figureRef } : {}),
    },
    matched: !!correct,
  };
}

// ---- group good questions by quiz, then by module ----
const byQuiz = new Map();
for (const q of good) {
  const key = q.quizName && q.quizName.trim() ? q.quizName.trim() : 'FAA Practice Exam';
  if (!byQuiz.has(key)) byQuiz.set(key, []);
  byQuiz.get(key).push(q);
}

const HEADER = 'module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content';
const rows = [HEADER];
const flatDir = path.join(OUT, 'flat');
fs.mkdirSync(flatDir, { recursive: true });

let unmatched = 0;
let lessonOrderBase = 90; // quizzes sit after content lessons
const quizNames = [...byQuiz.keys()].sort();
for (const quizName of quizNames) {
  const qs = byQuiz.get(quizName);
  const mod = moduleFor(quizName);
  const built = qs.map((q, i) => toQuizQuestion(q, i));
  unmatched += built.filter((b) => !b.matched).length;
  const quizContent = {
    passingScore: 80,
    attemptsAllowed: -1,
    questions: built.map((b) => b.obj),
  };
  const lessonOrder = lessonOrderBase++;
  // 16-column row; only module/title/type/preview/quiz_content populated
  const row = [
    csvEscape(mod.title), mod.order, lessonOrder, csvEscape(quizName), 'quiz',
    qs.length * 30, mod.free ? 'true' : 'false',
    '', '', 'markdown', '', '', '', '', '',
    csvEscape(JSON.stringify(quizContent)),
  ].join(',');
  rows.push(row);

  // flat per-quiz CSV for the editor paste path
  const flat = ['question,option_a,option_b,option_c,option_d,correct_letter,explanation,subject_tag,image_url'];
  for (const q of qs) {
    const opts = q.options || [];
    const ci = opts.findIndex((o) => norm(o) === norm(q.correctAnswerText));
    const letter = ['A', 'B', 'C', 'D'][ci] || '';
    flat.push([
      csvEscape(q.question), csvEscape(opts[0] || ''), csvEscape(opts[1] || ''),
      csvEscape(opts[2] || ''), csvEscape(opts[3] || ''), letter,
      csvEscape(q.explanation || ''), csvEscape(quizName), '',
    ].join(','));
  }
  fs.writeFileSync(path.join(flatDir, `${slug(quizName)}.csv`), flat.join('\n') + '\n');
}

fs.writeFileSync(path.join(OUT, 'quizzes-import.csv'), rows.join('\n') + '\n');

// ---- needs-review report ----
const rev = ['# Quiz questions that need a human check', '',
  'These were flagged during automated verification. Decide each, then add the',
  'correct ones to the import (the per-quiz flat CSVs in `flat/` are the easiest place).',
  ''];
for (const q of review) {
  const v = q.verdict || {};
  rev.push(`## ${q.quizName || 'Exam'} — ${q.question}`);
  rev.push(`- Options: ${(q.options || []).map((o) => `"${o}"`).join(' | ')}`);
  rev.push(`- Source marked correct: "${q.correctAnswerText}"`);
  if (v.agree === false) rev.push(`- Verifier disagrees. Suggests: "${v.suggestedCorrectText}" (confidence ${v.confidence}). ${v.notes || ''}`);
  else if (v.confidence === 'low') rev.push(`- Verifier low confidence. ${v.notes || ''}`);
  if (q._conflict) rev.push(`- Source conflict: ${q._conflict}`);
  rev.push(`- Explanation: ${q.explanation || ''}`);
  rev.push('');
}
fs.writeFileSync(path.join(OUT, 'quizzes-NEEDS-REVIEW.md'), rev.join('\n'));

// ---- figure-dependent list (need a Cloudinary image) ----
const figs = good.filter((q) => (q.verdict && q.verdict.isFigureDependent) || q.figureRef);
const figLines = ['# Figure-dependent quiz questions (need a hosted image)', '',
  'Each of these references an FAA figure. Crop it from the FAA Testing Supplement,',
  'host on Cloudinary, then set the question\'s image URL (image_url column / imageUrl field).', ''];
for (const q of figs) figLines.push(`- [${q.quizName || 'Exam'}] ${q.figureRef || '(figure)'} — ${q.question.slice(0, 90)}`);
fs.writeFileSync(path.join(OUT, 'quizzes-FIGURES.md'), figLines.join('\n') + '\n');

console.log(JSON.stringify({
  totalQuestions: questions.length,
  shipped: good.length,
  needsReview: review.length,
  quizzes: quizNames.length,
  figureDependent: figs.length,
  unmatchedCorrectAnswer: unmatched,
}, null, 2));
