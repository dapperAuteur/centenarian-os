# FlashLearn cards: authored multiple-choice + media (for CPT and CES)

Two new, optional, backward-compatible card capabilities are live on the FlashLearn v1 API:
**authored multiple-choice options** and **images/video**. A plain `{front, back}` card is
unchanged. Full vendor spec: `plans/ecosystem/flashlearn-ai/FlashLearn-cards-options-images-for-CES.md`.
Proven on CNC 2026-06-19: 104 sets carry **907 authored-MC cards + 935 traditional cards**.

## Card shape (the new optional fields)
```json
{
  "front": "Which monosaccharide is bound in milk sugar?",
  "back": "Galactose. Lactose is glucose + galactose.",
  "externalId": "cnc:ch7:q12",
  "options": [
    { "id": "q12o1", "text": "Galactose" },
    { "id": "q12o2", "text": "Fructose" },
    { "id": "q12o3", "text": "Glucose" },
    { "id": "q12o4", "text": "Maltose" }
  ],
  "correctOptionId": "q12o1",
  "frontImage": "https://res.cloudinary.com/.../x.png", "frontImageAlt": "screen-reader text"
}
```
- `options`: ≥2 `{id,text}`, unique ids. `correctOptionId` required with options and must match an
  id (else `400 INVALID_INPUT` fails the whole create). MC study serves exactly your options and
  scores by id. Cards without `options` still work (study auto-generates distractors).
- Images: `frontImage`/`backImage` must be **https**; always send `frontImageAlt`/`backImageAlt`.
  Video later: `frontVideo`/`backVideo` + alts. Upload via `POST /api/v1/media` (returns the URL),
  or use your own CDN. **CNC deferred images/video** — MC only for now.
- `external-results`, `analytics`, `due-cards`, `externalStudentId` are unchanged — still report
  `isCorrect` per card by `externalId`.

## How we did it (mirror for CPT/CES)
1. **Map quiz → MC for free.** Your `quiz_content.questions` already are `{options:[{id,text}],
   correctOptionId}` — the exact MC shape. In the flashcard builder, quiz-derived cards pass
   `options` + `correctOptionId` straight through; **glossary cards stay traditional `{front,back}`**
   (they get auto-distractors in MC study). CNC builder: `nasm-cnc-build.mjs flashcards`.
2. **Probe before bulk.** Feature ships in `bundle/card-media-and-mc-2026-06-19`; hold live calls
   until BAM confirms merged + deployed. To verify it's live: PATCH ONE set with options, then
   `GET /api/v1/sets/{id}` and confirm `options` come back. (CNC probe: 200 + 12 options round-tripped.)
3. **Update sets in place with PATCH, don't delete.** If your sets are already pushed, add MC by
   `PATCH /api/v1/sets/{setId}` with the regenerated cards — this **preserves the setId** (and any
   student history), unlike delete+recreate. CNC push script gained an `--update` mode that PATCHes
   every set in `_setmap.json`. New courses: just include `options` on the initial `POST`.
4. **Same throttle/backoff** as before (60/min; 1.2s spacing + 62s backoff on 429). ~100 PATCHes is
   a few minutes.

## Gotchas
- Option ids only need to be unique **within a card** (our quiz ids like `q12o1` already are).
- Keep `back` populated even on MC cards (classic study mode + the answer reveal use it).
- Re-run is idempotent; PATCH replaces a set's full card list, so always PATCH the complete set.

## References
- Vendor spec: `plans/ecosystem/flashlearn-ai/FlashLearn-cards-options-images-for-CES.md`
- Push how-to + ≤20 cap: `docs/CentenarianAcademy/FlashcardPushGuide.md`
- Build patterns: `docs/CentenarianAcademy/NASM-CNC-Build-Decisions.md`
- Machine spec: `GET /api/v1/openapi`
