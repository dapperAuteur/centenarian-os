# Course Production Playbook (for AI agents)

This doc explains how the FAA Part 107 course was built in Centenarian Academy, so you
can repeat the method for a new class or fix an existing one. It is written for an AI
agent. Read it, then use the ready-to-paste prompt at the bottom.

Pair this with `docs/CentenarianAcademy/CourseAuthoringGuide.md`, which is the writing
and structure standard. This playbook is the process; the guide is the craft.

---

## 1. The standard (non-negotiable)

- **Audio-first.** Every lesson is a script meant to be heard. One concept per lesson,
  about 6 to 8 minutes. Open with a recall of the previous lesson, end with how it shows
  up on the test.
- **No AI tells.** No em-dashes anywhere (use a comma, period, or colon). No en-dashes
  (use "to" for ranges). No rare words when a common word works. No filler openers. Short
  sentences, active voice. This is enforced with an automated em-dash scan after every
  generation step; fix any hit before saving.
- **Accuracy is checked, not assumed.** Every quiz answer is independently verified
  against the source material and the domain rules before it ships.
- **Sources are verified, not trusted.** Every citation is resolved against Crossref or
  PubMed before it ships. AI-drafted source material routinely contains fabricated studies,
  mis-attributed authors, and inflated statistics. If a claim has no verifiable source, state
  it generally with no citation, or cut it. Never attach a real citation to a claim it does
  not support, and never invent one. Full method and the artifacts to produce (master usage
  map, teacher evidence ledger, sources-still-needed, fake-claims audit) are in
  `CitationIntegrityGuide.md`. A teacher can also verify and add sources in-app from the
  course editor's Sources tab.

## 2. The pipeline that produced the course

1. **Map the source to modules.** Turn the raw material (transcripts, a textbook, a
   syllabus) into a canonical module and lesson map. Lock it in a plan file so later work
   does not drift. Long chapters split into several short lessons.
2. **Author lessons in parallel.** Run one writer per lesson (a workflow with one agent
   per lesson), each grounded in its source section and the authoring guide. Each returns
   the lesson script, key takeaways, a small glossary, and a run-time estimate.
3. **Gate for AI tells.** After each batch, scan the output for em-dashes and rare-word
   filler. Auto-fix and re-scan to zero before saving.
4. **Assemble with a script.** `scripts/drone-lessons-assemble.mjs` turns the lesson JSON
   into `course-import.csv` (16-column academy format), `glossary.csv`, and per-lesson
   `-script.md` files in per-module folders. It is module-generic: pass module title,
   order, free flag, and an append flag.
5. **Quizzes: extract, dedupe, verify.** If quizzes come from messy sources, extract
   verbatim, dedupe, then run an independent verifier over every answer (a second agent
   that checks each marked answer against the rules and the source, flags disagreements
   and figure-dependent items). `scripts/drone-quiz-assemble.mjs` builds the real
   `quiz_content` JSON.
6. **Expand assessments.** Generate more multiple-choice questions per module (same
   verify gate), plus open-ended items: one graded assignment and two self-check prompts
   with model answers per module.
7. **Resources and lead magnets.** Assemble a study plan, an exam-day checklist, a
   cheat sheet (from the key takeaways), and a glossary reference. Render them to PDF and
   host them, then attach as downloadable documents. Mark the best few as free previews.

## 3. The academy data model (what the content lands in)

- **Hierarchy:** course, module, lesson. Lessons sort by `order`; modules by `order`.
- **Lesson types:** `text` (markdown body), `audio` (mp3 plus chapters and transcript),
  `quiz` (quiz_content JSON). Markdown renders via marked, so images and tables work in
  text lessons.
- **Quiz schema (use this, not the old docs):**
  `{ passingScore, attemptsAllowed, questions: [{ id, questionText, questionType:
  "multiple_choice", options: [{id,text}], correctOptionId, explanation, citation?,
  imageUrl? }] }`. Scoring matches the chosen option id to `correctOptionId`. An index
  number does not work. `attemptsAllowed: -1` is unlimited. `imageUrl` shows a hosted
  figure above the question.
- **Assignments feature:** the `assignments` table supports course, module, or lesson
  scope. Students submit text or a file; teachers grade with feedback. This is the home
  for open-ended (essay and short-answer) work, since the quiz player only auto-scores
  multiple choice.
- **Glossary:** `course_glossary_terms`, upsert on (course, term), columns term,
  phonetic, definition, lesson_id.
- **Free preview as lead magnet:** a lesson with `is_free_preview = true` is viewable on
  the public course page without paying. Attach a hosted PDF via the lesson `documents`
  array (absolute https URLs only) and prospective students can download it.
- **Import path:** the HTTP import route needs a logged-in session, so bulk loads are
  done by replicating its insert logic with the service-role Supabase client, in create
  mode (additive, no deletes), scoped to the course id.

## 4. Gotchas captured this build

- `docs/` and `plans/` are gitignored, so course content is local. Tracked docs (guides,
  this playbook) live in `docs/CentenarianAcademy/` and are force-added.
- `module_order = 0` needs a real integer parse. The import route's `parseInt(x) ||
  fallback` drops 0, so a "Module 0" lands in the wrong spot. Parse so 0 is kept.
- Set navigation to **linear**, not cyoa, for a course whose lessons recall the previous
  one in order.
- Downloadable PDFs need a working upload path. Here the signed key lacked upload
  permission, so the unsigned upload preset (`raw/upload`) was used.
- Keep webhook and notification side effects non-blocking (fire in `after()`), mirroring
  `lib/feedback/inbox-mirror.ts`.

## 5. Repeatable checklist for a new class

- [ ] Build the canonical module and lesson map; save it in a plan file.
- [ ] Author lessons in parallel against the authoring guide.
- [ ] Run the em-dash and AI-tell scan; fix to zero.
- [ ] Assemble the course-import CSV, glossary, and per-lesson scripts.
- [ ] Build quizzes; verify every answer independently.
- [ ] Expand assessments (more MC, plus graded assignments and self-check prompts).
- [ ] Build the resources module and pick the free-preview lead magnets.
- [ ] Generate and host the downloadable PDFs; attach as documents.
- [ ] Create the course in the editor, then import (service-role, create mode).
- [ ] Verify: lessons render, quizzes score, downloads resolve, modules ordered.

---

## 6. Ready-to-paste prompt: create a new class

Copy this, fill the blanks, and give it to your agent.

```
You are building a new course in the Centenarian Academy LMS. Follow the two reference
docs exactly: docs/CentenarianAcademy/CourseAuthoringGuide.md (writing and structure
standard) and docs/CentenarianAcademy/CourseProductionPlaybook.md (the process).

Course: <course title>
Audience: <who it is for, assume no prior knowledge>
Source material: <paths to transcripts, textbook, syllabus, or notes>
Goal for the learner: <what they can do or pass after the course>

Do this:
1. Read both reference docs. Build a canonical module and lesson map from the source and
   save it in a plan file. Confirm the map with me before authoring.
2. Author the lessons audio-first, one concept per lesson, about 6 to 8 minutes each,
   opening with a recall of the previous lesson. Use parallel agents, one per lesson.
3. Enforce NO AI tells: no em-dashes, no en-dashes, no rare-word filler. Run an automated
   scan after every batch and fix to zero before saving.
4. Build quizzes in the real quiz_content schema (correctOptionId, options with ids).
   Independently verify every answer against the source and the subject rules. Flag any
   question that needs an image.
5. Add per-module graded assignments and self-check prompts with model answers.
6. Build a resources module: study plan, key-fact cheat sheet, glossary reference. Render
   the lead magnets to PDF, host them, attach as downloadable documents, and mark the best
   few as free previews.
7. Assemble everything into the academy import format and load it (service-role insert,
   create mode, scoped to the course id I give you). Then verify: lessons render, quizzes
   score, downloads resolve, modules are ordered.

Constraints: the database is shared, so writes must be additive and scoped to this course.
Keep all notification side effects non-blocking. Ask me for the course id; do not create
the course row yourself unless I tell you to.
```

## 7. Ready-to-paste prompt: fix an existing class

```
You are improving an existing Centenarian Academy course using the best practices in
docs/CentenarianAcademy/CourseAuthoringGuide.md and CourseProductionPlaybook.md.

Course id: <id>

Do this:
1. Audit the course against the authoring guide: lesson length, one-concept rule, recall
   openers, the "on the test" framing, and AI tells (scan for em-dashes and filler).
2. Audit the quizzes: confirm they use the real quiz_content schema (correctOptionId, not
   an index), and independently verify every answer is correct. List every wrong or weak
   item.
3. Report a prioritized fix list before changing anything. Then, on my go-ahead, apply
   fixes additively: rewrite weak lessons to the standard, correct quiz answers, add
   missing assignments, cheat sheets, and free-preview lead magnets.
4. Verify after each batch: lessons render, quizzes score, downloads resolve. Keep writes
   additive and scoped to this course id.
```
