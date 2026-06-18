# Rotating Quizzes (Spaced Recall) + Flashcards — Shared Feature Guide

Reference for every Centenarian Academy course build (CPT, CES, CNC, and the rest). It
documents the rotating, spaced-recall quiz feature now live in the shared quiz player, and
the planned flashcard integration with FlashLearn AI. Built on the CPT7 course; the schema
and player are shared, so all courses get it for free.

Status: rotating quiz + spaced recall shipped (branch `feat/nasm-cpt7-fast-track-course`).
Flashcard integration is planned (see the last section).

---

## 1. What changed

Two shared files, both additive and backward compatible:

- **`components/academy/QuizPlayer.tsx`** — instead of showing the whole `questions` array
  in order, it now draws a subset per attempt, weighted by spaced recall, and can shuffle
  option order. A quiz with no new fields behaves exactly as before (shows all questions).
- **`app/api/academy/courses/[id]/lessons/[lessonId]/progress/route.ts`** — scores over the
  questions actually answered this attempt (not the full pool), and stores a per-question
  history so the player can resurface missed items. The GET returns that history as
  `quiz_stats`.

No migration. The history lives inside the existing `lesson_progress.quiz_answers` JSON.

---

## 2. Quiz schema (use this for every course)

`quiz_content` (stored on the quiz lesson row) gains two optional fields:

```json
{
  "passingScore": 80,
  "attemptsAllowed": -1,
  "questionsPerAttempt": 12,
  "shuffleOptions": true,
  "questions": [
    {
      "id": "q1",
      "questionText": "Plain, original question text.",
      "questionType": "multiple_choice",
      "options": [
        { "id": "q1a", "text": "First choice" },
        { "id": "q1b", "text": "Second choice" },
        { "id": "q1c", "text": "Third choice" },
        { "id": "q1d", "text": "Fourth choice" }
      ],
      "correctOptionId": "q1b",
      "explanation": "Why q1b is right, and why each other option is wrong.",
      "citation": "Lesson 5: Phase by Phase"
    }
  ]
}
```

- **`questions`** is now a POOL. Make it larger than what a student sees in one sitting.
- **`questionsPerAttempt`** (optional): how many to draw per attempt. Omit (or set >= pool
  size) to show all. Rule of thumb: pool about 2x the per-attempt count (e.g. 24 in the
  pool, 12 per attempt).
- **`shuffleOptions`** (optional): when true, option order is randomized each render so
  students can't pattern-match positions.
- **`correctOptionId`** is the option `id` string, never an index. Scoring compares ids, so
  shuffling and subsetting are safe.
- **`citation`**: point at the lesson that teaches it (do NOT cite NASM, see section 5).

---

## 3. Spaced recall (how the rotation is weighted)

The player favors questions a student gets wrong and questions they have not seen yet, so
weak spots come back around more often.

- Each question carries a weight: unseen = 3; seen = `1 + 3 * (wrong / seen)`. So a question
  missed every time weighs up to 4, a question always correct weighs 1, and a brand-new
  question weighs 3 (favored for coverage).
- The attempt is a weighted sample without replacement of `questionsPerAttempt` questions.
- History is per student per quiz lesson: `quiz_answers.stats[questionId] = { seen, wrong }`,
  merged on every submit. The player loads it (GET progress) before the first attempt and
  updates it locally after each attempt, so retries reweight immediately.
- Scoring: `score = correct / answered * 100`, where `answered` is the served subset. The
  pass threshold and unlimited-retry behavior are unchanged.

This is course-local spaced recall (good enough for in-quiz rotation). Cross-session,
long-horizon SRS is the job of the flashcard integration below.

---

## 4. Authoring a question pool (per module)

1. Build a verified bank first (extract from source, dedupe, verify each answer against the
   lesson and the subject rules). Flag any figure-dependent item (`imageUrl`).
2. **Reword everything in original language.** Do not copy exam-provider question or option
   phrasing verbatim. Same concept, your words.
3. Write 4 options, exactly one correct, plausible distractors (real student mistakes).
4. Explanation states why right is right and why each wrong option is wrong, then points to
   the lesson.
5. Mix sub-topics across the pool (do not block all of one topic together).
6. Set `questionsPerAttempt` to roughly half the pool, `shuffleOptions: true`,
   `passingScore: 80`, `attemptsAllowed: -1`.
7. Load it onto the quiz lesson's `quiz_content` (service role, scoped to your course id).
   See `scripts/nasm-academy-load.mjs` and the CPT example at
   `docs/nasm-curriculum/ch13-pilot/_quiz-content.json` (24-question pool, 12 per attempt).

---

## 5. Do not cite the certification provider

The cert curriculum is proprietary. Never cite it or reproduce its text or its exact
questions. Cite the open-access peer-reviewed studies in
`docs/CentenarianAcademy/shared-sources/bibliography.json`; in quiz items, the `citation`
points to the lesson. Add a "not affiliated with [provider]" disclaimer somewhere
student-facing.

---

## 6. Planned: flashcards via FlashLearn AI (cross-app)

FlashLearn AI (`/Users/bam/Code_NOiCloud/ai-builds/claude/flashlearn-ai`) already does
long-horizon spaced repetition for flashcards and exposes a public v1 API. Plan:

1. **Generate cards from the question pools.** Each quiz/test question becomes a card
   (front = prompt, back = correct answer + explanation). One FlashLearn set per module, or
   one per course.
2. **Create the set via the API:** `POST /api/v1/sets` (auth with a developer API key from
   FlashLearn `developer/keys`). Cards can also be AI-generated via `/api/v1/generate`.
3. **Students study** in FlashLearn's SRS (`/api/v1/study/due-cards`,
   `/study/evaluate-answer`, `/study/sessions`).
4. **Pull results for the dashboard:** `/api/v1/mastery/[childId]` (and study sessions)
   surface mastery/progress, which Centenarian Academy shows on the student dashboard so a
   learner sees how their understanding is progressing across the course.
5. Reference: FlashLearn `blog/introducing-flashlearn-api.md`,
   `blog/build-study-app-with-flashlearn-api.md`, `app/api/v1/openapi/route.ts`.

Blocked on: a FlashLearn developer API key + base URL for this ecosystem (operator task),
and deciding card granularity (per module vs per course). Until then, the in-course rotating
quiz above carries the spaced-recall load.
