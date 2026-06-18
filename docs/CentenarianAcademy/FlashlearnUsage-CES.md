# How the NASM CES course will use FlashLearn AI (for the FlashLearn bot)

Share this with the FlashLearn AI chat to troubleshoot the integration. It states exactly
what the Centenarian Academy (NASM CES course) side plans to call, what it has, and what it
needs back. Full build spec: `docs/CentenarianAcademy/FlashlearnIntegrationSpec.md`.

## Current status / the blocker
- **Base URL (found):** `https://flashlearnai.witus.online/api/v1` (from FlashLearn's own
  blog posts). The endpoint is live: a request returns a clean JSON error envelope.
- **Key:** `FLASHLEARN_ECO_API_KEY` in `.env.local`, prefix `fl_eco_`, length 50, no
  whitespace, sent as `Authorization: Bearer <key>`.
- **BLOCKER (a FlashLearn bug, not the key):** `GET /api/v1/sets` returns
  **`401 {"error":{"code":"UNAUTHORIZED","message":"Invalid API key prefix."}}`**.
  Root cause: `lib/api/authenticateApiKey.ts` → `detectKeyType()` only handles
  `fl_admin_`, `fl_adm_pub_`, `fl_app_`, `fl_pub_`. It has **no `fl_eco_` (ecosystem)
  case**, even though `keyGenerator` + `API_KEY_PREFIXES.ecosystem` mint keys with the
  `fl_eco_` prefix. So every ecosystem key falls through to "Invalid API key prefix."

### The fix (FlashLearn side, one line)
Add the ecosystem prefix to `detectKeyType()` in `lib/api/authenticateApiKey.ts`:
```ts
if (key.startsWith('fl_eco_')) return 'ecosystem';
```
(Best: derive `detectKeyType` from `API_KEY_PREFIXES` so prefixes can't drift again.) After
that ships, confirm the `fl_eco_…` key is **active** with perms `sets:read`, `sets:write`,
`study:read` (+ `study:write` later). Then I run Step 1 below and report the real response.

## What I will do, in order

### Step 1 — Create flashcard sets (now)
One set per content type. First test = the **glossary set (169 cards)**.
```bash
curl -X POST "$FLASHLEARN_API_BASE/api/v1/sets" \
  -H "Authorization: Bearer $FLASHLEARN_ECO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NASM CES Accelerator — Glossary",
    "description": "Key terms for the NASM CES exam.",
    "isPublic": true,
    "flashcards": [
      { "front": "Abduction", "back": "A body segment is moving away from the midline of the body.", "externalId": "ces:glossary:abduction" }
      /* …169 cards… */
    ]
  }'
```
I expect back `data.id` (the set id) and `data.cardCount`. **Question:** does the create
endpoint accept and persist a per-card **`externalId`**? I need it so course quiz questions
map to cards later (for Steps 3 to 4). If not supported yet, that is the first thing to add.

Then one set per module from the quiz pools (front = question, back = answer + why), same shape.

### Step 2 — Read a student's progress (for the course dashboard)
```bash
curl "$FLASHLEARN_API_BASE/api/v1/study/analytics/<setId>" \
  -H "Authorization: Bearer $FLASHLEARN_ECO_API_KEY"
curl "$FLASHLEARN_API_BASE/api/v1/study/due-cards?setId=<setId>" \
  -H "Authorization: Bearer $FLASHLEARN_ECO_API_KEY"
```
I want per-card SM-2 (`easinessFactor`, `interval`, `repetitions`, `nextReviewDate`,
correct/incorrect) + set `averageScore` to show "mastered / due" on the student dashboard.
**Question (key identity issue):** analytics appear scoped to the API-key owner's profile.
To show a **specific** student's progress under one ecosystem key, can the API accept an
`externalStudentId` (childId) on study reads/writes? If not, the alternative is per-student
OAuth ("sign in with FlashLearn"). Tell me which path you want.

### Step 3 — (next) Course quiz results drive scheduling
When a student misses a question in the course quiz, I want the matching card to be
scheduled sooner. Proposed new endpoint on your side:
```
POST /api/v1/study/external-results
{ "setId": "...", "externalStudentId": "<academy user id>",
  "results": [ { "cardExternalId": "ces:m8:q3", "isCorrect": false, "confidenceRating": 2,
                 "source": "course_quiz", "occurredAt": "<iso>" } ] }
```
It should feed the same SM-2 update path a study answer uses, idempotent on
`(externalStudentId, cardExternalId, occurredAt)`. Details in the full spec, section 3.

### Step 4 — (later) Curated / recommended quick-study sets
Create small sets from chosen cards or the student's 10 weakest (existing `POST /api/v1/sets`).

## Troubleshooting checklist for the FlashLearn bot
- [ ] Confirm the base URL and give it to me.
- [ ] Confirm `fl_eco…` key: active, type `ecosystem`, perms `sets:write` + `study:read`.
- [ ] Confirm `POST /api/v1/sets` body (`title`, `isPublic`, `flashcards:[{front,back,externalId?}]`) and that `externalId` is stored + returned.
- [ ] Confirm `GET /api/v1/study/analytics/[setId]` response shape and whether `externalStudentId` can scope it per student.
- [ ] Note any rate limit I should respect for a one-time 20-set bulk create.

Once you send the base URL (and confirm the key perms), I will run Step 1 and report the
real response.
