export const meta = {
  name: 'ces-author-lessons',
  description: 'Author NASM CES lessons in Fit T. Cent voice, one agent per lesson: write the lesson Markdown file, return compact metadata',
  phases: [
    { title: 'Load', detail: 'read manifest, filter to requested modules' },
    { title: 'Author', detail: 'one agent per lesson writes its .md and returns metadata' },
  ],
};

const modules = args?.modules || null; // array of module numbers, or null for all
const OUTDIR = 'docs/ces-curriculum/academy-import/_lessons';

const LESSONS_SCHEMA = {
  type: 'object',
  properties: {
    lessons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          module: { type: 'integer' }, moduleTitle: { type: 'string' }, free: { type: 'boolean' },
          type: { type: 'string' }, n: { type: 'integer' }, title: { type: 'string' }, brief: { type: 'string' },
          sourceFiles: { type: 'array', items: { type: 'string' } },
          refFile: { type: 'string' }, prevTitle: { type: 'string' },
        },
        required: ['module', 'moduleTitle', 'free', 'type', 'n', 'title', 'brief', 'sourceFiles', 'refFile', 'prevTitle'],
      },
    },
  },
  required: ['lessons'],
};

const META_SCHEMA = {
  type: 'object',
  properties: {
    module: { type: 'integer' }, n: { type: 'integer' }, type: { type: 'string' }, title: { type: 'string' },
    free: { type: 'boolean' },
    keyTakeaways: { type: 'array', items: { type: 'string' } },
    glossary: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, phonetic: { type: 'string' }, definition: { type: 'string' } }, required: ['term', 'definition'] } },
    wordCount: { type: 'integer' }, path: { type: 'string' },
  },
  required: ['module', 'n', 'type', 'title', 'free', 'keyTakeaways', 'glossary', 'wordCount', 'path'],
};

const pad = (x) => String(x).padStart(2, '0');

function buildPrompt(L) {
  const file = `${OUTDIR}/m${pad(L.module)}-${pad(L.n)}-${L.type}.md`;
  const src = (L.sourceFiles && L.sourceFiles.length)
    ? `Read ${L.sourceFiles.join(' and ')} and use ONLY facts found there for specifics. Pull exact NASM CES terms and numbers (muscle names, the order of the corrective exercise continuum, hold times, assessment names).`
    : `This lesson has no textbook source file. Use accurate, general NASM CES exam-prep knowledge. Do not invent statistics, study results, or specific numbers you cannot support.`;
  const recall = L.prevTitle
    ? `Open "## Quick recall" with two quick questions about the previous lesson, "${L.prevTitle}", a beat to think, then the answers.`
    : `This is the first lesson of the course. Open "## Quick recall" with one short forward-looking warm-up question instead of a recall.`;
  const typeNote = L.type === 'review'
    ? `This is a REVIEW lesson. Under "## The idea", give 5 to 8 of this module's top facts as a tight recap, plus one quick callback to each earlier module. Keep the other sections short.`
    : L.type === 'exam-walkthrough'
      ? `This is an EXAM-WALKTHROUGH lesson. Center the body on how the NASM CES exam words questions about this module's topics and the common trap answers, with 2 to 3 worked examples. End by pointing the student to the module quiz.`
      : '';
  const cite = L.refFile
    ? `You MAY Read ${L.refFile} for the chapter's primary references. In "## Sources", cite ONLY real primary sources (author, year, title, journal) that clearly support a claim you actually made. Never cite "NASM" or a NASM textbook as the source. Never invent a study, author, year, or statistic. If no clear source matches, write exactly: "Sources: primary sources finalized in citation review."`
    : `In "## Sources", if you cannot name a real primary source for a claim, write exactly: "Sources: primary sources finalized in citation review." Never invent a citation.`;

  return [
    `You are Fit T. Cent, the instructor for the "NASM CES Accelerator" course. Write ONE student-facing reading lesson.`,
    ``,
    `FIRST read docs/ces-curriculum/_VOICE-AND-TEMPLATE-CES.md and follow it EXACTLY: the Fit T. Cent voice and the descriptive headings in this order: "## Quick recall", "## Why it matters", "## The idea", "## Picture it", "## On the test", "## Your turn", "## Key takeaways", "## Sources". Clean Markdown, no stage tags. One concept only. About 1,000 to 1,150 words.`,
    ``,
    `LESSON: Module ${L.module} (${L.moduleTitle}). Title: "${L.title}". Type: ${L.type}.`,
    `CONCEPT BRIEF: ${L.brief}`,
    ``,
    `SOURCE: ${src}`,
    `RECALL: ${recall}`,
    typeNote ? `NOTE: ${typeNote}` : ``,
    `CITATIONS: ${cite} You may consult docs/ces-curriculum/source/vocabulary.json for official term definitions so your glossary matches the course.`,
    ``,
    `HARD STYLE (an automated scan rejects these): no em-dashes, no en-dashes (write "three to five", not a dash), and do not use any of: utilize, facilitate, leverage, delve, robust, crucial, holistic, thus, regarding. No filler openers ("It is worth noting", "When it comes to", "In today's world"). No hedging clichés ("arguably", "in many ways", "a testament to"). Short sentences. Active voice. Contractions are good. Never write "as you can see".`,
    ``,
    `STEP 1: Write the finished lesson Markdown to this exact file with the Write tool: ${file}`,
    `The file content is ONLY the lesson Markdown, starting with "# ${L.title}".`,
    ``,
    `STEP 2: Then return metadata via StructuredOutput: module=${L.module}, n=${L.n}, type="${L.type}", title="${L.title}", free=${L.free}, keyTakeaways (the 3 to 5 bullets, plain strings), glossary (3 to 5 objects {term, phonetic, definition}; phonetic may be ""), wordCount (integer count of words in the body you wrote), and path="${file}".`,
  ].filter(Boolean).join('\n');
}

phase('Load');
const loaded = await agent(
  `Read the JSON file docs/ces-curriculum/source/lesson-manifest.json. Return its "lessons" array` +
  (modules ? `, filtered to entries whose "module" value is one of [${modules.join(', ')}]` : '') +
  `. Return every field of each lesson unchanged. For any field that is null (refFile, prevTitle), return an empty string "" instead of null. Do not add, drop, or reword any lesson.`,
  { label: 'load-manifest', phase: 'Load', schema: LESSONS_SCHEMA },
);
const lessons = (loaded?.lessons || []).slice().sort((a, b) => (a.module - b.module) || (a.n - b.n));
log(`Authoring ${lessons.length} lessons${modules ? ` (modules ${modules.join(',')})` : ''}`);

phase('Author');
const results = await parallel(lessons.map((L) => () =>
  agent(buildPrompt(L), { label: `m${L.module}.${L.n}-${L.type}: ${L.title.slice(0, 40)}`, phase: 'Author', schema: META_SCHEMA, agentType: 'general-purpose' })
));

const authored = results.filter(Boolean);
return {
  requested: lessons.length,
  authored: authored.length,
  failed: lessons.length - authored.length,
  meta: authored,
};
