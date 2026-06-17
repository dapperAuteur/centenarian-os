# Centenarian Academy ↔ flashlearn-ai integration spec

> Companion to **`docs/CentenarianAcademy/RotatingQuizAndFlashcards.md`** (the shared
> quiz + flashcard feature guide owned by the CPT build). That doc covers the in-course
> rotating quiz and sketches flashcards; THIS doc is the detailed flashlearn build spec,
> including the two requested features: course results driving flashlearn scheduling
> (Phase 3) and curated/recommended quick-study sets (Phase 4).
>
> **Share this doc with the flashlearn-ai chat/team.** It defines how Centenarian Academy
> courses (NASM CES first, then CPT, CNC) create flashcard sets in flashlearn-ai, read each
> student's spaced-recall progress back into the course dashboard, and (new) feed course
> quiz/exam results into flashlearn's scheduler. Sections marked **[flashlearn builds]** are
> work for the flashlearn side; **[academy builds]** is the Centenarian OS side.

## 0. Architecture (confirmed from the flashlearn codebase)
- Separate databases: Centenarian Academy = **Supabase/Postgres**; flashlearn-ai = **MongoDB**.
  No shared DB. All integration is over flashlearn's **v1 HTTP API** with a Bearer
  developer key (`Authorization: Bearer fl_...`). Keys issued at `/api/developer/keys`;
  key types `public` / `app` / `ecosystem`; tiers gate rate limits.
- Flashlearn already does **SM-2 spaced repetition**. Per card, per student profile it
  stores `mlData { easinessFactor, interval, repetitions, nextReviewDate }` in the
  `studyanalytics` collection. That scheduler is what we want course results to feed.

## 1. Phase 1 — Publish course flashcard sets  [academy builds, uses existing API]
Cards are generated from course content (no new flashlearn work):
- **Quiz/exam questions** → front = the question stem in plain words, back = the correct
  answer plus a one-line why. (We never copy NASM wording; cards use our original text.)
- **Glossary** (169 terms) → front = term, back = definition.
- **Key takeaways** → optional cloze cards.
Publish with the existing endpoint:
```
POST /api/v1/sets   Authorization: Bearer fl_...
{ "title": "NASM CES — Module 8: Static Assessments", "description": "...",
  "isPublic": true,
  "flashcards": [ { "front": "...", "back": "...", "externalId": "ces:m8:q3" } ] }
```
- One set per module (~16 to 20 cards) plus a full-course set.
- **[flashlearn builds — small]** Persist an optional **`externalId`** on each card and
  return it on reads. This is the stable key that lets the course map its quiz questions to
  flashlearn cards for Phases 3 and 4. Today the create endpoint accepts only `{front, back}`.

## 2. Phase 2 — Read progress into the course dashboard  [academy builds]
- `GET /api/v1/study/analytics/[setId]` returns per-card SM-2 (`easinessFactor`, `interval`,
  `repetitions`, `nextReviewDate`, correct/incorrect counts) plus `setPerformance`
  (averageScore, totalStudySessions, time). The course dashboard renders accuracy, cards
  mastered, and cards due.
- **Identity gap:** analytics are scoped to the **API-key owner's profile**, so a single
  server key cannot read per-student progress. Pick one:
  - **(A) Per-student OAuth** — student links their own flashlearn account; course reads
    that student's analytics. Cleanest, no flashlearn change beyond OAuth.
  - **(B) Ecosystem child ids** — **[flashlearn builds]** accept an `externalStudentId`
    (a.k.a. `childId`) on study writes and analytics reads under one `ecosystem` key, so the
    course can write/read results per student. (`/api/v1/mastery/[childId]` already hints at
    this pattern; extend it to flashcard analytics.)

## 3. Phase 3 (NEW) — Course quiz/exam results drive flashlearn scheduling
**Goal (user request):** when a student answers a course quiz or exam question wrong, the
matching flashcard should get scheduled sooner in flashlearn; a confident-correct answer
should push it out. The course already scores quizzes; that signal should reach the SM-2
scheduler so the card library self-prioritizes from real performance.

- **[academy builds]** On quiz/exam submission, for each answered question that maps to a
  card (via `externalId`), send a result signal to flashlearn:
```
POST /api/v1/study/external-results   Authorization: Bearer fl_<ecosystem>
{ "setId": "<flashlearn set id>",
  "externalStudentId": "<academy user uuid>",
  "results": [
    { "cardExternalId": "ces:m8:q3", "isCorrect": false, "confidenceRating": 2,
      "source": "course_quiz", "occurredAt": "2026-06-17T05:00:00Z" } ] }
```
- **[flashlearn builds]** A new ingest endpoint `POST /api/v1/study/external-results` that:
  1. resolves `cardExternalId` → card, and `externalStudentId` → (or creates) a profile
     under the calling ecosystem key;
  2. runs the SAME SM-2 update path a study answer uses (so `nextReviewDate`/`interval`/
     `easinessFactor` move), tagging the event `source: course_quiz` for analytics;
  3. is idempotent on `(externalStudentId, cardExternalId, occurredAt)` so retries are safe.
  This is additive: existing study-session flows are untouched.
- **[flashlearn builds — optional]** A webhook back to the course (`webhookUrl` on the API
  key already exists) firing when a student's due-card count crosses a threshold, so the
  course can nudge "you have 10 cards to review."

## 4. Phase 4 (NEW) — Curated and recommended quick-study sets
**Goal (user request):** let a student pick a small set of a course's cards to add to their
flashlearn account, or have the course recommend a 10-card set for quick study.
- All course cards already live in flashlearn (Phase 1). Two flows, both on existing
  `POST /api/v1/sets` (no new flashlearn work beyond `externalId`):
  - **Student-curated:** the course UI lists a module's cards; the student checks the ones
    they want; the course creates a new small set from those `externalId`s.
  - **Course-recommended (10 cards):** the course picks the student's 10 weakest cards
    (lowest quiz accuracy / most-missed questions, optionally intersected with flashlearn
    `GET /api/v1/study/due-cards`) and creates a "Quick Study: your 10 weak spots" set.
- **[flashlearn builds — nice to have]** A "clone subset by externalId" helper so the course
  can say "make a set from these card ids in set X" without resending front/back text.

## 5. Course-side data model  [academy builds — additive Supabase migration]
A new table links course content to flashlearn sets/cards (additive; shared-DB safe):
```
course_flashcard_links (
  id uuid pk, course_id uuid, module_id uuid null,
  flashlearn_set_id text,            -- the set in flashlearn
  question_id text null,             -- course quiz question id (quiz_content.questions[].id)
  card_external_id text,             -- matches flashcard.externalId, e.g. 'ces:m8:q3'
  kind text,                         -- 'quiz' | 'glossary' | 'takeaway'
  created_at timestamptz default now() )
```
Plus a per-student `student_flashlearn_link` (academy user ↔ flashlearn account/childId) once Phase 2 identity is chosen.

## 6. Auth & secrets  [operator task]
- Course server holds a flashlearn **ecosystem** key in env (e.g. `FLASHLEARN_API_KEY`,
  `FLASHLEARN_API_BASE`). Issue at flashlearn `/api/developer/keys`. See the user-task.

## 7. What flashlearn needs to build (summary checklist)
- [ ] Accept + return an optional `externalId` per card on create/read.
- [ ] Accept `externalStudentId` on study writes/reads under an `ecosystem` key (per-student).
- [ ] `POST /api/v1/study/external-results` ingest that feeds SM-2 (Phase 3), idempotent.
- [ ] (optional) due-count webhook to the course.
- [ ] (optional) clone-subset-by-externalId helper (Phase 4).

## Status
- [x] flashlearn API mapped; CES card content available (glossary now; quiz/exam after build).
- [ ] flashlearn: implement the checklist above.
- [ ] academy: card generator (`scripts/ces-flashcards.mjs`), link table migration, dashboard widget, quiz-submit hook. Tracked in `plans/future/`.
