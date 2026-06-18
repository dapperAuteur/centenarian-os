export const meta = {
  name: 'ces-author-assignments',
  description: 'Per-module practice lesson (2 self-checks + model answers) written to _lessons, plus one graded assignment row per module returned for the assignments table',
  phases: [{ title: 'Author', detail: 'one agent per module: write practice .md, return graded assignment' }],
};

const MODULES = [
  { module: 1, title: 'Module 1: Rationale for Corrective Exercise', ref: 'ch01' },
  { module: 2, title: 'Module 2: Human Movement Science', ref: 'ch02' },
  { module: 3, title: 'Module 3: Inhibitory Techniques', ref: 'ch03' },
  { module: 4, title: 'Module 4: Lengthening Techniques', ref: 'ch04' },
  { module: 5, title: 'Module 5: Activation Techniques', ref: 'ch05' },
  { module: 6, title: 'Module 6: Integration Techniques', ref: 'ch06' },
  { module: 7, title: 'Module 7: Client Intake and Assessment', ref: 'ch07' },
  { module: 8, title: 'Module 8: Static Assessments', ref: 'ch08' },
  { module: 9, title: 'Module 9: Movement Assessments', ref: 'ch09' },
  { module: 10, title: 'Module 10: Mobility Assessments', ref: 'ch10' },
  { module: 11, title: 'Module 11: Corrective Strategies: Foot and Ankle', ref: 'ch11' },
  { module: 12, title: 'Module 12: Corrective Strategies: Knee', ref: 'ch12' },
  { module: 13, title: 'Module 13: Corrective Strategies: LPHC', ref: 'ch13' },
  { module: 14, title: 'Module 14: Corrective Strategies: Thoracic Spine and Shoulder', ref: 'ch14' },
  { module: 15, title: 'Module 15: Corrective Strategies: Wrist and Elbow', ref: 'ch15' },
  { module: 16, title: 'Module 16: Corrective Strategies: Cervical Spine', ref: 'ch16' },
  { module: 17, title: 'Module 17: Self-Care and Recovery', ref: 'ch17' },
  { module: 18, title: 'Module 18: Real-World Application', ref: 'ch18' },
  { module: 19, title: 'Module 19: Capstone and Practice Exam', ref: 'ch18', capstone: true },
];
const filter = args?.modules || null;
const mods = filter ? MODULES.filter((m) => filter.includes(m.module)) : MODULES;
const pad = (x) => String(x).padStart(2, '0');
const STYLE = 'No em-dashes, no en-dashes (write "three to five"), and do not use utilize, facilitate, leverage, delve, robust, crucial, holistic, thus, regarding. Plain, active voice.';

const SCHEMA = {
  type: 'object',
  properties: {
    module: { type: 'integer' }, moduleTitle: { type: 'string' },
    assignmentTitle: { type: 'string' }, assignmentDescription: { type: 'string' }, path: { type: 'string' },
  },
  required: ['module', 'moduleTitle', 'assignmentTitle', 'assignmentDescription', 'path'],
};

function prompt(m) {
  const file = `docs/ces-curriculum/academy-import/_lessons/m${pad(m.module)}-80-practice.md`;
  const lessonGlob = `docs/ces-curriculum/academy-import/_lessons/m${pad(m.module)}-*.md`;
  const capstone = m.capstone
    ? `This is the CAPSTONE module. The graded assignment is a full case study: give the student a realistic client (history, posture findings, movement findings) and ask them to build a complete corrective program across all four phases of the continuum for the primary region, with rationale. Make the practice lesson a worked mini-case plus one self-check case of their own.`
    : '';
  return [
    `You are Fit T. Cent. Build the practice and assessment set for "${m.title}" in the NASM CES Accelerator.`,
    `Read this module's lessons (${lessonGlob}) and source (docs/ces-curriculum/source/${m.ref}-l*.md) so your prompts and model answers match the course exactly. ${capstone}`,
    ``,
    `STEP 1: Write a student-facing TEXT lesson in Fit T. Cent voice to this exact file with the Write tool: ${file}`,
    `The lesson starts with "# ${m.capstone ? 'Capstone Practice and Self-Check' : m.title.replace(/^Module \\d+: /, '') + ': Practice and Self-Check'}" and contains, in clean Markdown:`,
    `  - A one-paragraph intro on how to use this (try it before reading the model answer).`,
    `  - "## Self-check 1" then a short open-ended prompt, then "**Model answer**" with a strong 4 to 6 sentence answer.`,
    `  - "## Self-check 2" then a different open-ended prompt, then "**Model answer**" with a strong 4 to 6 sentence answer.`,
    `  - "## Graded assignment" then the assignment prompt and a short "What a strong submission includes" list (this is also submitted through the assignment tool for your teacher to grade).`,
    `  ${STYLE}`,
    ``,
    `STEP 2: Return via StructuredOutput: module=${m.module}, moduleTitle="${m.title}", assignmentTitle (a short title for the graded assignment), assignmentDescription (the full graded-assignment prompt plus the "what a strong submission includes" criteria, as one text block for the assignments table), path="${file}".`,
  ].join('\n');
}

phase('Author');
const results = await parallel(mods.map((m) => () =>
  agent(prompt(m), { label: `assign m${m.module}: ${m.title.slice(0, 32)}`, phase: 'Author', schema: SCHEMA, agentType: 'general-purpose' })
));
const assignments = results.filter(Boolean);
return { modules: mods.length, authored: assignments.length, assignments };
