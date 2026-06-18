// scripts/ces-quiz-assemble.mjs
// Turns verified CES quiz JSON into Academy import files. CES variant of
// scripts/drone-quiz-assemble.mjs. Module placement comes from explicit per-question
// fields (moduleTitle/moduleOrder/free); the schema uses correctOptionId (option id,
// not an index). passingScore 80, attemptsAllowed -1.
//
// Input JSON: { questions: [ { quizName, moduleTitle, moduleOrder, free,
//   question, options[], correctAnswerText, explanation, citation, qid,
//   verdict: { agree, suggestedCorrectText, confidence, isFigureDependent, notes }, _conflict? } ] }
//
// Output (in <outDir>): quizzes-import.csv, quizzes-NEEDS-REVIEW.md, quizzes-FIGURES.md,
//   flat/<quiz-slug>.csv
// Usage: node scripts/ces-quiz-assemble.mjs [inputJson] [outDir]

import fs from 'fs';
import path from 'path';

const IN = process.argv[2] || 'docs/ces-curriculum/academy-import/_quiz-verified.json';
const OUT = process.argv[3] || 'docs/ces-curriculum/academy-import';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const csvEscape = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const slug = (s) => String(s || 'quiz').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// module placement: prefer explicit fields on the question; else a CES keyword map.
function moduleFor(q) {
  if (q.moduleTitle) return { title: q.moduleTitle, order: Number.isFinite(q.moduleOrder) ? q.moduleOrder : 99, free: !!q.free };
  const s = norm(q.quizName);
  const map = [
    [/orientation|exam overview/, 'Module 0: Orientation', 0, true],
    [/rationale/, 'Module 1: Rationale for Corrective Exercise', 1, false],
    [/human movement|movement science/, 'Module 2: Human Movement Science', 2, false],
    [/inhibit/, 'Module 3: Inhibitory Techniques', 3, false],
    [/lengthen/, 'Module 4: Lengthening Techniques', 4, false],
    [/activat/, 'Module 5: Activation Techniques', 5, false],
    [/integrat/, 'Module 6: Integration Techniques', 6, false],
    [/intake|client/, 'Module 7: Client Intake and Assessment', 7, false],
    [/static/, 'Module 8: Static Assessments', 8, false],
    [/movement assess/, 'Module 9: Movement Assessments', 9, false],
    [/mobility/, 'Module 10: Mobility Assessments', 10, false],
    [/foot|ankle/, 'Module 11: Corrective Strategies: Foot and Ankle', 11, false],
    [/knee/, 'Module 12: Corrective Strategies: Knee', 12, false],
    [/lphc|lumbo|pelvic|hip/, 'Module 13: Corrective Strategies: LPHC', 13, false],
    [/thoracic|shoulder/, 'Module 14: Corrective Strategies: Thoracic Spine and Shoulder', 14, false],
    [/wrist|elbow/, 'Module 15: Corrective Strategies: Wrist and Elbow', 15, false],
    [/cervical|neck/, 'Module 16: Corrective Strategies: Cervical Spine', 16, false],
    [/recovery|self.care/, 'Module 17: Self-Care and Recovery', 17, false],
    [/real.world|programming/, 'Module 18: Real-World Application', 18, false],
    [/practice exam|capstone|final/, 'Module 19: Capstone and Practice Exam', 19, false],
  ];
  for (const [re, title, order, free] of map) if (re.test(s)) return { title, order, free };
  return { title: 'Module 19: Capstone and Practice Exam', order: 19, free: false };
}

const data = JSON.parse(fs.readFileSync(IN, 'utf8'));
const questions = data.questions || [];

const good = [], review = [];
for (const q of questions) {
  const v = q.verdict || {};
  // Figure-dependent questions are NOT shipped: we use no proprietary (NASM) images, so a
  // question that needs a figure goes to review (drop it or reword to be text-answerable).
  const flagged = v.isFigureDependent || (v.agree === false) || v._conflict || q._conflict || (v.confidence === 'low');
  if (flagged) review.push(q); else good.push(q);
}

function toQuizQuestion(q, idx) {
  const id = `q${idx + 1}`;
  const options = (q.options || []).map((text, j) => ({ id: `${id}o${j + 1}`, text: String(text).trim() }));
  let correct = options.find((o) => norm(o.text) === norm(q.correctAnswerText));
  if (!correct) correct = options.find((o) => norm(o.text).includes(norm(q.correctAnswerText)) || norm(q.correctAnswerText).includes(norm(o.text)));
  const cite = q.citation || q.figureRef;
  return {
    obj: {
      id, questionText: String(q.question).trim(), questionType: 'multiple_choice', options,
      correctOptionId: correct ? correct.id : (options[0]?.id || ''),
      explanation: String(q.explanation || '').trim(),
      ...(cite ? { citation: String(cite) } : {}),
      ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}),
    },
    matched: !!correct,
  };
}

const byQuiz = new Map();
for (const q of good) {
  const key = q.quizName?.trim() || 'CES Practice Exam';
  if (!byQuiz.has(key)) byQuiz.set(key, []);
  byQuiz.get(key).push(q);
}

const HEADER = 'module_title,module_order,lesson_order,title,lesson_type,duration_seconds,is_free_preview,content_url,text_content,content_format,audio_chapters,transcript_content,map_content,documents,podcast_links,quiz_content';
const rows = [HEADER];
const flatDir = path.join(OUT, 'flat');
fs.mkdirSync(flatDir, { recursive: true });

let unmatched = 0, lessonOrderBase = 90;
const quizNames = [...byQuiz.keys()].sort();
for (const quizName of quizNames) {
  const qs = byQuiz.get(quizName);
  const mod = moduleFor(qs[0]);
  const built = qs.map((q, i) => toQuizQuestion(q, i));
  unmatched += built.filter((b) => !b.matched).length;
  // Rotating library (see docs/CentenarianAcademy/RotatingQuizAndFlashcards.md): the bank
  // is a POOL; the shared player draws a spaced-recall-weighted subset of questionsPerAttempt
  // (~half the pool) and shuffles option order when shuffleOptions is true.
  const isExam = /practice exam/i.test(quizName);
  const ask = isExam ? Math.min(50, Math.round(built.length * 0.8)) : Math.max(8, Math.round(built.length / 2));
  const quizContent = { passingScore: 80, attemptsAllowed: -1, shuffleOptions: true, questions: built.map((b) => b.obj) };
  if (built.length > ask) quizContent.questionsPerAttempt = ask;
  const row = [
    csvEscape(mod.title), mod.order, lessonOrderBase++, csvEscape(quizName), 'quiz',
    qs.length * 30, mod.free ? 'true' : 'false', '', '', 'markdown', '', '', '', '', '',
    csvEscape(JSON.stringify(quizContent)),
  ].join(',');
  rows.push(row);

  const maxOpts = Math.max(4, ...qs.map((q) => (q.options || []).length));
  const optCols = Array.from({ length: maxOpts }, (_, j) => `option_${String.fromCharCode(97 + j)}`);
  const flat = [['question', ...optCols, 'correct_letter', 'explanation', 'subject_tag', 'image_url'].join(',')];
  for (const q of qs) {
    const opts = q.options || [];
    const ci = opts.findIndex((o) => norm(o) === norm(q.correctAnswerText));
    const letter = ci >= 0 ? String.fromCharCode(65 + ci) : '';
    const optCells = Array.from({ length: maxOpts }, (_, j) => csvEscape(opts[j] || ''));
    flat.push([csvEscape(q.question), ...optCells, letter, csvEscape(q.explanation || ''), csvEscape(quizName), csvEscape(q.imageUrl || '')].join(','));
  }
  fs.writeFileSync(path.join(flatDir, `${slug(quizName)}.csv`), flat.join('\n') + '\n');
}
fs.writeFileSync(path.join(OUT, 'quizzes-import.csv'), rows.join('\n') + '\n');

const rev = ['# CES quiz questions that need a human check', '',
  'Flagged during automated verification. Decide each, then add the correct ones to the import.', ''];
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

const figs = good.filter((q) => (q.verdict && q.verdict.isFigureDependent) || q.figureRef);
const figLines = ['# Figure-dependent CES quiz questions (need a hosted image)', '',
  'Each references a figure. Crop it, host on Cloudinary, then set imageUrl.', ''];
for (const q of figs) figLines.push(`- [${q.quizName || 'Exam'}] ${q.figureRef || '(figure)'} — ${q.question.slice(0, 90)}`);
fs.writeFileSync(path.join(OUT, 'quizzes-FIGURES.md'), figLines.join('\n') + '\n');

console.log(JSON.stringify({
  totalQuestions: questions.length, shipped: good.length, needsReview: review.length,
  quizzes: quizNames.length, figureDependent: figs.length, unmatchedCorrectAnswer: unmatched,
}, null, 2));
