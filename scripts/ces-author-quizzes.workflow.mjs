export const meta = {
  name: 'ces-author-quizzes',
  description: 'Author + independently verify NASM CES module quizzes (real schema, correctOptionId) from lessons, source, and the NASM workbook/answer key',
  phases: [
    { title: 'Author', detail: 'one agent per module writes MCQs grounded in lessons + workbook' },
    { title: 'Verify', detail: 'a second agent independently checks every answer' },
  ],
};

// module configs (match the lesson manifest). nQuestions per module quiz.
// n = bank size per module (a rotating library; the player draws ~10 per attempt).
const MODULES = [
  { module: 0, title: 'Module 0: Orientation and How to Pass the CES Exam', order: 0, free: true, n: 8, ref: '' },
  { module: 1, title: 'Module 1: Rationale for Corrective Exercise', order: 1, free: false, n: 16, ref: 'ch01' },
  { module: 2, title: 'Module 2: Human Movement Science', order: 2, free: false, n: 18, ref: 'ch02' },
  { module: 3, title: 'Module 3: Inhibitory Techniques', order: 3, free: false, n: 16, ref: 'ch03' },
  { module: 4, title: 'Module 4: Lengthening Techniques', order: 4, free: false, n: 14, ref: 'ch04' },
  { module: 5, title: 'Module 5: Activation Techniques', order: 5, free: false, n: 14, ref: 'ch05' },
  { module: 6, title: 'Module 6: Integration Techniques', order: 6, free: false, n: 12, ref: 'ch06' },
  { module: 7, title: 'Module 7: Client Intake and Assessment', order: 7, free: false, n: 16, ref: 'ch07' },
  { module: 8, title: 'Module 8: Static Assessments', order: 8, free: false, n: 16, ref: 'ch08' },
  { module: 9, title: 'Module 9: Movement Assessments', order: 9, free: false, n: 18, ref: 'ch09' },
  { module: 10, title: 'Module 10: Mobility Assessments', order: 10, free: false, n: 12, ref: 'ch10' },
  { module: 11, title: 'Module 11: Corrective Strategies: Foot and Ankle', order: 11, free: false, n: 16, ref: 'ch11' },
  { module: 12, title: 'Module 12: Corrective Strategies: Knee', order: 12, free: false, n: 16, ref: 'ch12' },
  { module: 13, title: 'Module 13: Corrective Strategies: LPHC', order: 13, free: false, n: 16, ref: 'ch13' },
  { module: 14, title: 'Module 14: Corrective Strategies: Thoracic Spine and Shoulder', order: 14, free: false, n: 16, ref: 'ch14' },
  { module: 15, title: 'Module 15: Corrective Strategies: Wrist and Elbow', order: 15, free: false, n: 16, ref: 'ch15' },
  { module: 16, title: 'Module 16: Corrective Strategies: Cervical Spine', order: 16, free: false, n: 16, ref: 'ch16' },
  { module: 17, title: 'Module 17: Self-Care and Recovery', order: 17, free: false, n: 16, ref: 'ch17' },
  { module: 18, title: 'Module 18: Real-World Application', order: 18, free: false, n: 12, ref: 'ch18' },
];
// Capstone practice exam: several author calls aggregate into one large exam.
const EXAM = { module: 19, title: 'Module 19: Capstone and Practice Exam', order: 19, free: false, batches: 5, perBatch: 12 };

const filter = args?.modules || null; // optional array of module numbers
const mods = filter ? MODULES.filter((m) => filter.includes(m.module)) : MODULES;
const doExam = !filter || filter.includes(19);

const pad = (x) => String(x).padStart(2, '0');
const Q_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctAnswerText: { type: 'string' },
          explanation: { type: 'string' },
          citation: { type: 'string' },
        },
        required: ['question', 'options', 'correctAnswerText', 'explanation'],
      },
    },
  },
  required: ['questions'],
};
const V_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } },
          correctAnswerText: { type: 'string' }, explanation: { type: 'string' }, citation: { type: 'string' },
          verdict: {
            type: 'object',
            properties: { agree: { type: 'boolean' }, suggestedCorrectText: { type: 'string' }, confidence: { type: 'string' }, isFigureDependent: { type: 'boolean' }, notes: { type: 'string' } },
            required: ['agree', 'confidence', 'isFigureDependent'],
          },
        },
        required: ['question', 'options', 'correctAnswerText', 'explanation', 'verdict'],
      },
    },
  },
  required: ['questions'],
};

const STYLE = 'No em-dashes, no en-dashes (write "three to four"), and do not use utilize, facilitate, leverage, delve, robust, crucial, holistic, thus, regarding. Plain language. Every question must be answerable from text alone: do NOT write a question that requires viewing a figure, chart, or image, and never reference or depend on a NASM image. If a concept is visual, describe it in words.';

function authorPrompt(m) {
  const lessonGlob = `docs/ces-curriculum/academy-import/_lessons/m${pad(m.module)}-*.md`;
  const refLine = m.ref ? `the source file docs/ces-curriculum/source/${m.ref}-l1.md (and the other ${m.ref}-l*.md files), ` : '';
  return [
    `You are writing the module quiz for "${m.title}" in the NASM CES Accelerator.`,
    `Read this module's lessons (the files matching ${lessonGlob}); their "## Key takeaways" sections are EXACTLY what the quiz must test. You may read ${refLine}and docs/ces-curriculum/source/workbook-qa.md ONLY to see which concepts NASM tests.`,
    `IMPORTANT: write ORIGINAL questions in your own words. Do NOT copy, reword lightly, or paraphrase any NASM question, answer option, or wording from the workbook or textbook. Build fresh questions and fresh answer options that test the same underlying concept. Scenario and application questions are best.`,
    `Write ${m.n} multiple-choice questions (this is a rotating pool, so quantity and variety matter). NASM uses FOUR options per question, exactly one correct. Mix the subtopics through the quiz; do not block all of one subtopic together.`,
    `For each question return: question (plain text), options (array of 4 plain strings), correctAnswerText (the exact text of the correct option), explanation (say why the right answer is right AND why each wrong option is wrong), citation (point to the lesson that teaches it, e.g. "${m.title}: <lesson title>"; never cite NASM).`,
    `Distractors must be believable mistakes a real student makes, the way NASM writes them. Test understanding, not trivia. ${STYLE}`,
    `Return via StructuredOutput { questions: [...] }. Do not invent a citation or a fact.`,
  ].join('\n');
}

function verifyPrompt(authored, m) {
  return [
    `Independently verify a NASM CES quiz for "${m.title}". Be skeptical. For EACH question, decide whether correctAnswerText is truly the single best answer under NASM CES rules.`,
    `If you are unsure, read the module source files (docs/ces-curriculum/source/${m.ref || 'ch01'}-l*.md) and the lessons (docs/ces-curriculum/academy-import/_lessons/m${pad(m.module)}-*.md).`,
    `Return EACH question unchanged plus a verdict: { agree (true if the marked answer is correct), suggestedCorrectText (the correct option text if you disagree, else ""), confidence ("high" or "low"), isFigureDependent (true if the question needs an image to answer), notes (one line) }.`,
    `Set agree:false when the marked answer is wrong, when two options are both defensible, or when the question is ambiguous. ${STYLE}`,
    `Questions to verify (JSON): ${JSON.stringify(authored.questions || [])}`,
    `Return via StructuredOutput { questions: [...] }.`,
  ].join('\n');
}

phase('Author');
const moduleResults = await pipeline(
  mods,
  (m) => agent(authorPrompt(m), { label: `quiz:author m${m.module}`, phase: 'Author', schema: Q_SCHEMA, agentType: 'general-purpose' }),
  (authored, m) => agent(verifyPrompt(authored || { questions: [] }, m), { label: `quiz:verify m${m.module}`, phase: 'Verify', schema: V_SCHEMA, agentType: 'general-purpose' })
    .then((v) => ({ m, questions: (v?.questions || []) })),
);

// Practice exam (capstone): author in batches, then verify each batch.
let examQuestions = [];
if (doExam) {
  const domains = ['rationale and human movement science', 'inhibitory, lengthening, activation, and integration techniques', 'client intake, static, movement, and mobility assessments', 'regional corrective strategies (foot/ankle, knee, LPHC, shoulder, wrist, neck)', 'self-care, recovery, and real-world programming'];
  const batches = Array.from({ length: EXAM.batches }, (_, i) => i);
  const examResults = await pipeline(
    batches,
    (i) => agent(
      [`You are writing batch ${i + 1} of a NASM CES full PRACTICE EXAM. Focus this batch on: ${domains[i]}.`,
        `Read the relevant lessons in docs/ces-curriculum/academy-import/_lessons/ and source in docs/ces-curriculum/source/. You may glance at docs/ces-curriculum/source/workbook-qa.md ONLY to see which concepts are tested.`,
        `IMPORTANT: write ORIGINAL questions in your own words. Do NOT copy or lightly reword any NASM question or answer wording. Build fresh scenario and application questions.`,
        `Write ${EXAM.perBatch} application-style multiple-choice questions, 4 options each, exactly one correct, mixed difficulty, the way the real exam blends recall and scenario. Same return shape as a module quiz. ${STYLE}`,
        `Return via StructuredOutput { questions: [...] } with question, options(4), correctAnswerText, explanation, citation (point to the lesson, never NASM).`].join('\n'),
      { label: `exam:author b${i + 1}`, phase: 'Author', schema: Q_SCHEMA, agentType: 'general-purpose' }),
    (authored, i) => agent(verifyPrompt(authored || { questions: [] }, { title: 'CES Practice Exam', module: 19, ref: 'ch09' }), { label: `exam:verify b${i + 1}`, phase: 'Verify', schema: V_SCHEMA, agentType: 'general-purpose' })
      .then((v) => (v?.questions || [])),
  );
  examQuestions = examResults.flat().filter(Boolean);
}

// flatten + attach module metadata + quizName
const all = [];
for (const r of moduleResults.filter(Boolean)) {
  const m = r.m;
  const quizName = `${m.title} Quiz`;
  for (const q of r.questions) all.push({ ...q, quizName, moduleTitle: m.title, moduleOrder: m.order, free: m.free });
}
for (const q of examQuestions) all.push({ ...q, quizName: 'CES Full Practice Exam', moduleTitle: EXAM.title, moduleOrder: EXAM.order, free: EXAM.free });

const agreed = all.filter((q) => q.verdict ? q.verdict.agree : true).length;
return { totalQuestions: all.length, agreed, flagged: all.length - agreed, questions: all };
