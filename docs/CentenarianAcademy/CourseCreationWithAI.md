# Building a Course With AI (give this to your AI)

Hand this to the AI you are using to build a Centenarian Academy course. It is the short
version of our standards. The three full references are:

- `CourseAuthoringGuide.md` (how to write a lesson so it teaches and imports cleanly)
- `CourseProductionPlaybook.md` (the end-to-end process)
- `CitationIntegrityGuide.md` (how to handle sources and never ship a fake citation)

---

## Ready-to-paste master prompt

```
You are building a course for the Centenarian Academy. Follow these standards exactly.

VOICE AND STRUCTURE
- Audio-first. Every lesson is a script meant to be heard while walking or driving.
- One concept per lesson, about 6 to 8 minutes (roughly 900 to 1150 spoken words).
- Open each lesson by recalling the previous one (two quick questions, a beat, the answers).
- End with how the idea shows up in practice (or "on the test" for exam courses).
- Translate every term: plain words first, the official term once in parentheses, then plain
  words. Say numbers the way a person speaks them.

NO AI TELLS (this is checked)
- No em-dashes, no en-dashes. Use a comma, a period, parentheses, or "to" for ranges.
- No rare words when a common word works (no utilize, facilitate, leverage, delve, robust,
  crucial, holistic). No filler openers (no "It is worth noting", "In today's world").
- Short sentences, active voice, contractions are fine.

SOURCES AND CITATIONS
- Verify every citation against Crossref before using it. Never invent a study, author, year,
  journal, or statistic. If a claim has no verifiable source, state it generally with no
  citation and flag it. See CitationIntegrityGuide.md for the full method.

QUIZZES (use the real schema)
- { passingScore: 80, attemptsAllowed: -1, questions: [ { id, questionText,
  questionType: "multiple_choice", options: [ {id, text} ], correctOptionId, explanation,
  citation?, imageUrl? } ] }
- correctOptionId matches an option id, never an index. Explanations say why the right answer
  is right and why each wrong answer is wrong. Independently verify every answer.

PROCESS
1. Map the source material to a module and lesson plan; confirm it before authoring.
2. Author lessons (one writer per lesson works well), then scan for AI tells and fix to zero.
3. Build quizzes; verify every answer against the source.
4. Add a graded assignment plus two self-check prompts (with model answers) per module.
5. Build a resources module: study plan, cheat sheet, glossary reference, and lead-magnet
   PDFs hosted and attached as free downloads.
6. Verify and download every source; produce the four source artifacts (see below).
7. Load it into the course additively (create mode, scoped to the course id), then verify
   lessons render, quizzes score, downloads resolve, and modules are in order.
```

---

## The four source artifacts to produce

1. **Master source and usage map**: every verified source with APA, a link, the PDF, and the
   lessons that cite it.
2. **Teacher evidence ledger** (in the course `teacher/` folder): each cited claim, the
   source's abstract as evidence, and the exact lesson it appears in.
3. **Sources still needed**: claims with no verified source yet, with search hints.
4. **Fake claims audit**: what was wrong in the drafts and how you caught it.

---

## Quick checklist before you ship

- [ ] Module and lesson map confirmed
- [ ] Lessons one concept each, recall opener, audio-first
- [ ] AI-tell scan clean (no em or en dashes, no filler)
- [ ] Quizzes in the real schema, every answer verified
- [ ] Assignment plus two self-checks per module
- [ ] Resources module with free downloads
- [ ] Every citation verified, the four source artifacts produced
- [ ] Loaded additively and verified end to end

---

A worked example of all of this is the "Read Your Body's Data" course:
`docs/CentOS Courses/FDA and Metrics CentOS version/`.
