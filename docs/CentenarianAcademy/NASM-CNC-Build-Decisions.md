# NASM CNC build — decisions and reusable patterns (for the CPT and CES chats)

From the CNC course build (course `ca413569-…`, "Pass the NASM CNC … by Fit T. Cent 4.0").
These are the cross-cutting decisions and tooling worth sharing across the three NASM courses.
Tooling lives in `docs/nasm-cnc-curriculum/scripts/` (gitignored working dir, like CPT/CES).

## 1. Citation integrity (important — adopt this)
- The shared corpus `docs/CentenarianAcademy/shared-sources/bibliography.json` has **no author
  names**. When agents wrote inline cites, they *recalled* authors and got them wrong and
  inconsistent: the SAME DOI `10.1186/1475-2891-11-57` was attributed to "Foster" in one lesson
  and "Lemon" in another. That is exactly the invent-an-author failure the rule forbids.
- Fix we shipped: **rebuild every Sources section deterministically from the DOIs**, formatted
  `Title (Year). Journal. https://doi.org/<doi>` with **no author**, and **strip inline
  author-year cites from the body**. The DOI is the only verifiable anchor; don't print authors
  the corpus can't back. Reusable: `nasm-cnc-build.mjs rebuildcites` (corpus-grounded; idempotent).
- Recommendation for CPT/CES: run the same rebuild over your loaded lessons. Check for the
  recalled-author problem; ours was course-wide (156 lessons).

## 2. AI-tells gate — three gotchas
- **Citation-aware scan:** exclude the `## Sources` section and any line with `doi.org`/`http`
  before scanning, or real paper titles ("…Perspectives Regarding…") false-trip the em-dash/word
  scan. 
- **Inline DOI dumps:** agents sometimes dumped a full reference inline with an empty `(2012)`
  author, including nested parens like `(Engel et al. (2018). … url)`. Strip any parenthetical
  containing a URL/DOI (allow one nested paren). Reusable: `cleanCitations` in `nasm-cnc-build.mjs`.
- **Quiz text isn't run through the lesson fixer.** Auto-heal it on load with safe synonym swaps
  (regarding→about, thus→so, utilize→use, em/en-dash→comma/"to"). Reusable: `fixQuizText`.

## 3. Quiz pattern (matches RotatingQuizAndFlashcards.md)
- Rotating pools: ~30 per chapter (final exam ~50→90), `questionsPerAttempt` ≈ half,
  `shuffleOptions:true`, `passingScore:80`, `attemptsAllowed:-1`. Quiz `citation` = the lesson
  title (never NASM, never a DOI). Original questions only.
- **Batched verification, NOT one agent per question.** We started with one verifier per question
  (30/chapter) and it blew the 5-hour usage limit fast. Switched to **one verifier agent per
  chapter** that judges all questions and returns a verdicts array. Cut ~40 agents/chapter to ~11.
  Ship only questions a verifier marks `agree===true`.

## 4. Per-module Key Terms (adopted the CES generator)
- Followed `PerModuleVocabGenerator.md`: a `"<Module>: Key Terms"` lesson per chapter, full
  glossary stays in Resources. We grouped terms by the module each term's lesson belongs to
  (`course_glossary_terms.lesson_id → module_id`) rather than re-parsing refs.
- **Placement:** inserted **after content, before the Module Review** (we shift review/on-the-test/
  quiz order +1; safe because progress is keyed by lesson_id, not order). Reusable:
  `nasm-cnc-module-vocab.mjs`. 25 Key Terms lessons added, 0 AI-tells.

## 5. Flashcards + FlashLearn status
- Built one set per module (glossary + quiz cards) with a stable **`externalId` per card**
  (`cnc:ch<N>:term:<slug>`, `cnc:ch<N>:q<n>`) so per-card SM-2 + `/study/external-results` work.
- FlashLearn 401 ("Invalid API key prefix") is **fixed** (eco keys now reach `/sets` + `/study/*`).
  Re-tested 2026-06-18: the `fl_eco_` key now returns **403 "lacks sets:write"** — the prefix fix
  is live but the existing key's **stored permissions still need updating** (BAM action, per
  `plans/ecosystem/flashlearn-ai/FlashLearn-response-to-CES.md`). Push script ready:
  `nasm-cnc-flashlearn-push.mjs` (records setId→set in `_setmap.json`, idempotent). Base URL
  `https://flashlearnai.witus.online/api/v1`; body `{title,description?,isPublic?,flashcards:[{front,back,externalId}]}`.

## 6. Session-limit reality (5-hour usage window)
- The account hit a rolling ~5-hour usage limit repeatedly. Mitigations that worked: batched
  verification (above), **3 chapters per batch** (not 5+), and `quiz-only`/`assignments` mini-
  workflows (2 agents/chapter) to fill gaps without re-authoring. A mid-batch limit hit leaves
  empty/partial manifests — re-run those chapters fresh after the window resets.

## 7. Pricing (flag a discrepancy)
- CNC market research: **$97 solo** (anchor $147), **$197** for a 3-course bundle. The suite-bundle
  user-task (28) lists **$379–$399**. Someone should reconcile bundle pricing before launch.

## 8. Conflict isolation (what kept the three chats from colliding)
- All build files in gitignored `docs/<course>-curriculum/` + `plans/`; **no git branch/commit
  ops** (the shared checkout bounced between CPT/CES branches with uncommitted WIP). DB writes
  scoped to the course id, create-mode/additive, module-order-0-safe parse. Deliverable is the
  loaded course in Supabase, not git.

## Reusable scripts (CNC working dir; clone/rename per course)
`nasm-cnc-build.mjs` (assemble | scan | load | validate | flashcards | cleancites | rebuildcites |
upsertquiz | loadassignments) · `nasm-cnc-author-chapter.js` (self-planning per-chapter Workflow) ·
`nasm-cnc-quiz-only.js` · `nasm-cnc-assignments.js` · `nasm-cnc-module-vocab.mjs` ·
`nasm-cnc-flashlearn-push.mjs` · `nasm_cnc_extract.py` (textbook+vocab PDF extraction).
