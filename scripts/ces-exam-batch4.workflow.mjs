export const meta = {
  name: 'ces-exam-batch4',
  description: 'Author + independently verify the missing practice-exam batch (regional corrective strategies), 12 original questions',
  phases: [{ title: 'Author' }, { title: 'Verify' }],
};

const STYLE = 'No em-dashes, no en-dashes (write "three to four"), and do not use utilize, facilitate, leverage, delve, robust, crucial, holistic, thus, regarding. Plain language. Every question must be answerable from text alone: no figure/image dependence, and never reference a NASM image. Write ORIGINAL questions in your own words; do not copy NASM wording.';

const Q_SCHEMA = { type: 'object', properties: { questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, correctAnswerText: { type: 'string' }, explanation: { type: 'string' }, citation: { type: 'string' } }, required: ['question', 'options', 'correctAnswerText', 'explanation'] } } }, required: ['questions'] };
const V_SCHEMA = { type: 'object', properties: { questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, correctAnswerText: { type: 'string' }, explanation: { type: 'string' }, citation: { type: 'string' }, verdict: { type: 'object', properties: { agree: { type: 'boolean' }, suggestedCorrectText: { type: 'string' }, confidence: { type: 'string' }, isFigureDependent: { type: 'boolean' }, notes: { type: 'string' } }, required: ['agree', 'confidence', 'isFigureDependent'] } }, required: ['question', 'options', 'correctAnswerText', 'explanation', 'verdict'] } } }, required: ['questions'] };

phase('Author');
const authored = await agent(
  [`You are writing batch 4 of a NASM CES full PRACTICE EXAM. Focus: regional corrective strategies (foot and ankle, knee, LPHC, shoulder and thoracic spine, wrist and elbow, cervical spine).`,
   `Read the relevant lessons in docs/ces-curriculum/academy-import/_lessons/ (the m11- through m16- files) for facts.`,
   `Write 12 application-style multiple-choice questions, 4 options each, exactly one correct, mixed difficulty, blending recall and client scenarios.`,
   `For each: question, options (4 plain strings), correctAnswerText (exact text of the correct option), explanation (why right + why each wrong), citation (point to the lesson, e.g. "Module 12: Corrective Strategies: Knee: ...", never NASM). ${STYLE}`,
   `Return via StructuredOutput { questions: [...] }.`].join('\n'),
  { label: 'exam:author b4', phase: 'Author', schema: Q_SCHEMA, agentType: 'general-purpose' });

phase('Verify');
const verified = await agent(
  [`Independently verify these NASM CES practice-exam questions. Be skeptical. For EACH, decide if correctAnswerText is the single best answer; read the m11- through m16- lessons in docs/ces-curriculum/academy-import/_lessons/ if unsure.`,
   `Return each question unchanged plus verdict { agree, suggestedCorrectText, confidence ("high"|"low"), isFigureDependent, notes }. Set agree:false if the answer is wrong or two options are defensible. ${STYLE}`,
   `Questions (JSON): ${JSON.stringify(authored?.questions || [])}`,
   `Return via StructuredOutput { questions: [...] }.`].join('\n'),
  { label: 'exam:verify b4', phase: 'Verify', schema: V_SCHEMA, agentType: 'general-purpose' });

const out = (verified?.questions || []).map((q) => ({ ...q, quizName: 'CES Full Practice Exam', moduleTitle: 'Module 19: Capstone and Practice Exam', moduleOrder: 19, free: false }));
return { count: out.length, agreed: out.filter((q) => !q.verdict || q.verdict.agree).length, questions: out };
