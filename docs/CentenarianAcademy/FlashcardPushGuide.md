# Push course flashcards to FlashLearn AI — how-to (CPT, CES, CNC)

Proven on the NASM CNC build (pushed 27 sets / 1,842 cards, 2026-06-18). This is the academy-side
procedure; the raw API recipe is `plans/ecosystem/flashlearn-ai/flashcard-integration.md`.

## Prereqs
- **Key:** `FLASHLEARN_ECO_API_KEY` in `.env.local`. It must have `sets:read`, `sets:write`,
  `study:*`. The `fl_eco_` prefix routing is fixed; a key minted before that fix carries the OLD
  defaults (`generate`+`kids:*` only) and returns `403 "API key lacks the 'sets:write' permission."`
  If you see that 403, FlashLearn must update that key's stored permissions (give them the key
  prefix + the requestId from the error). 401 "Invalid API key prefix" means the key isn't
  recognized at all. Base URL: `https://flashlearnai.witus.online/api/v1`.
- Course already loaded (lessons with glossary + quiz_content).

## Step 1 — Build one card set per module
Cards come from each module's **glossary terms** (front = term, back = definition) and **quiz
questions** (front = question, back = correct option + explanation). Give every card a **stable
`externalId`** so you can later feed quiz results back per student:
- term card: `<course>:ch<N>:term:<slug>` (e.g. `cnc:ch6:term:amino-acids`)
- quiz card: `<course>:ch<N>:q<n>` (e.g. `cnc:ch6:q3`)

CNC reference: `nasm-cnc-build.mjs flashcards <manifestDirOrFile>` writes
`docs/<course>-curriculum/flashcards/<module-slug>.json` as
`{ title, description, isPublic, source, cards:[{front,back,externalId}] }`. One set per module
(Start Here, each chapter, Bonus, Final Review). Empty sets (e.g. a Resources module with no
glossary/quiz) are skipped. Keep the "Not affiliated with NASM" line in each description.

**Cap each set at 20 cards.** A module's cards are split into balanced sets of `<=20`
(`Math.ceil(n/20)` groups), named `"<Module> - Flashcards (k of n)"` with file suffix `-pNN`.
Smaller decks study better and avoid oversized sets. CNC went from 27 sets to ~104 after capping.
The `externalId` stays the same per card regardless of which sub-set it lands in.

## Step 2 — Push the sets
`POST /api/v1/sets` with `{ title, description, isPublic, flashcards:[{front,back,externalId}] }`.
A whole set's cards ride in one request body (a 114-card set is one call), so ~25 sets is a short
loop. Stay under the ecosystem burst limit (60 req/min).

CNC reference: `node --env-file=.env.local docs/<course>-curriculum/scripts/nasm-cnc-flashlearn-push.mjs`
- Reads the built `flashcards/*.json`, skips empty sets, POSTs each, and records
  `file -> {setId,title,cards}` in `flashcards/_setmap.json` (idempotent: re-runs skip
  already-pushed sets). Stops only on `401/403` (auth).
- **Throttle + backoff:** ecosystem Free is **60 requests/minute**. The script sleeps ~1.2s
  between calls and, on a `429`, backs off 62s and retries; network/5xx errors retry too. With
  ~100 sets you WILL hit 429 once or twice (deletes + posts share the budget) — the backoff
  handles it; just let it run (or re-run, it resumes from `_setmap.json`).
- **`--reset`** deletes every set in `_setmap.json` first (use when re-splitting an already-pushed
  course), then pushes fresh. To edit one pushed set's cards instead, `PATCH /api/v1/sets/<id>`.
- Clone/rename per course; the only course-specific bits are the flashcards dir and the
  `externalId` prefix.

## Step 3 — (optional) per-student progress + quiz-driven scheduling
- Read SM-2 state: `GET /api/v1/study/analytics/<setId>?externalStudentId=<academy user id>`
  and `GET /api/v1/study/due-cards?externalStudentId=...`. Omit `externalStudentId` for the key
  owner's own progress.
- Feed course-quiz results into SM-2: `POST /api/v1/study/external-results` with
  `{ setId, externalStudentId, results:[{ cardExternalId, isCorrect, confidenceRating?, source, occurredAt }] }`.
  Cards addressed by the `externalId` you set in Step 1. Idempotent on
  `(externalStudentId, cardExternalId, occurredAt)`; unknown ids return in
  `unresolvedCardExternalIds`. This is how a dashboard shows "mastered / due" per student.

## Gotchas
- Card body is `{front, back, externalId}` only — no authored multiple-choice options yet
  (`plans/future` item on the FlashLearn side); put the answer in `back`, report via external-results.
- `externalId`s must stay stable across re-pushes (don't regenerate slugs differently), or the
  SM-2 history won't line up.
- Re-running the push is safe (the `_setmap.json` dedup). To update a pushed set's cards, use
  `PATCH /api/v1/sets/<id>` instead of re-POSTing.

## References
- **Authored multiple-choice + media cards:** `docs/CentenarianAcademy/FlashcardMC-and-Media.md`
- Raw API recipe: `plans/ecosystem/flashlearn-ai/flashcard-integration.md`
- Fix history / capabilities: `plans/ecosystem/flashlearn-ai/FlashLearn-response-to-CES.md`
- Machine spec: `GET /api/v1/openapi`
- Broader CNC build decisions: `docs/CentenarianAcademy/NASM-CNC-Build-Decisions.md`
