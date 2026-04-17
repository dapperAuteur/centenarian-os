# Plan 33 — BVC Episode 1: Coffee

> **Status:** Draft, awaiting approval.
> **Source:** owner decision 2026-04-16 — see [`ecosystem/centenarianos-direction.md §1.1`](ecosystem/centenarianos-direction.md).
> **Effort:** Content-heavy. Estimate 3–5 days of concentrated writing + sourcing + recording + a half day of Academy publishing + QA. Breaks roughly 80% content production, 20% Academy configuration.
> **Dependencies:** Academy infra is ~90% complete per the direction doc's §3 audit — ship Episode 1 against what exists; fix gaps only if encountered.

---

## 1. Context

The Academy exists to host Better Vice Club Season 1 — a seven-episode series covering Coffee, Tea, Chocolate, Sugar, Guayusa, Kola Nut, and Kava, plus a synthesis. Season 1's target audience is **US high school grades 9–12 plus adult podcast listeners**. Infrastructure has been built over plans 20–27, 29, 26.0. No episode content has been shipped.

This plan ships Episode 1 (Coffee) end-to-end as a published, enrollable Academy course so we can validate the infrastructure with real students and gather feedback before scaling to Episodes 2–7.

---

## 2. Scope

**In scope:**
- One complete Academy course titled *Better Vice Club: Coffee* (Season 1 Episode 1).
- 6–10 lessons covering the pedagogical arc (see §4).
- 15–25 glossary terms specific to Coffee (subset of the 65-term Season 1 glossary).
- 1 interactive map lesson with at least 5 markers (origin regions, trade routes, or historical sites).
- 1 assignment per 2–3 lessons with rubric.
- 1 graded quiz (5–10 questions) at end of course.
- At least 2 primary-source documents attached to lessons.
- APA-formatted citations with working URLs on every factual claim.
- Indiana Academic Standards alignment tags per lesson (Geography, Economics, Social Studies, ELA).
- Common Core alignment where relevant (ELA reading, writing standards).
- Free preview on first 1–2 lessons; paid course otherwise (price TBD).
- Course published to `/academy` catalog under new "Better Vice Club" category.

**Out of scope (explicitly):**
- Episodes 2–7 and synthesis (separate plans after Episode 1 validates).
- Teacher analytics dashboard beyond what exists.
- Certificate generation (handle as a backlog item after first real student completes the course).
- Classroom bulk-enrollment features (wait for real teacher demand).
- FlashLearnAI deck export (separate plan — Academy→FlashLearnAI glossary sync).
- Wanderlearn preview blocks embedded in lessons (separate plan — Academy→Wanderlearn integration).

---

## 3. Content rules (non-negotiable, per ecosystem doc)

These come from [`ecosystem/centenarianos.md §"Rules for Academy content"`](ecosystem/centenarianos.md). Enforce at editorial review, not at code level:

1. **NO fabricated characters.** No Rosa, Mrs. Chen, Uncle Keoni, Elena, Dr. Martinez. Use real historical figures, named contemporary experts (with citations), or general second-person narration ("you") only.
2. **APA citations with working URLs.** Every factual claim — dates, figures, quotes, trade statistics — cites a source. URLs checked within 48 hours of publish.
3. **Peer-reviewed sources only** for scientific claims (chemistry of caffeine, metabolic effects, etc.). Journalism and reputable secondary sources acceptable for historical narrative.
4. **Indigenous knowledge treated as valid and rigorous.** When covering Ethiopian / Yemeni / Kaldi origin narratives, coffee ceremonies, or indigenous farming practices, cite indigenous scholars, oral histories, and cultural-institution sources with the same weight as peer-reviewed papers.
5. **No sensationalism.** Coffee's health effects, its labor history, and its environmental footprint are all legitimately complex. Present competing evidence; name the disagreement explicitly rather than picking a side.

---

## 4. Proposed lesson arc

Draft sequence — owner confirms before content drafting starts:

| # | Lesson | Type | Duration estimate |
|---|---|---|---|
| 1 | **Welcome — why coffee, and why this matters** | text + short audio intro | 3–5 min |
| 2 | **Origins: Ethiopia, Yemen, and what "discovery" actually means** | audio + interactive map (markers: Kaffa province, Sufi monasteries, first coffeehouses) | 15–20 min |
| 3 | **Chemistry of coffee — caffeine, crema, and flavor** | video + text (no fabricated characters; animate the molecule if needed) | 10–15 min |
| 4 | **The colonial trade — who profited, who suffered** | audio + primary-source documents (Dutch East India, Haitian plantation records) | 20–25 min |
| 5 | **The modern cup — specialty, fair trade, and what those words actually mean** | text + data tables (price breakdown from bean to cup) | 10–15 min |
| 6 | **Your body on coffee — effects, tolerance, dependence** | text + linked studies | 10–15 min |
| 7 | **Assignment: trace your favorite coffee** | assignment (research + write 500 words tracing one specific coffee from origin to cup) | 2–3 hr student work |
| 8 | **Quiz — Coffee Season 1 knowledge check** | quiz (8–10 questions spanning all lessons) | 15 min |

**CYOA option:** enable `course.navigation_mode='cyoa'` so students can take Chemistry (3) before Colonial Trade (4) or vice versa. Keep Welcome (1) as the fixed entry point and Quiz (8) as the terminal.

---

## 5. Production pipeline

### 5.1 — Authoring (owner / content producer)

Per lesson, the content producer delivers:
- Final text (as Markdown, or Tiptap JSON)
- Audio file if applicable (MP3, 320kbps preferred; chapter markers as [ss.s, "Chapter title"] array)
- Transcript (auto-generated via Whisper or manual, paired to audio)
- List of documents to attach (URL + title + description)
- Podcast URL if the lesson mirrors a BVC podcast episode
- For map lessons: GeoJSON-ready markers/lines with title + description per feature
- Citation block (APA, formatted)

### 5.2 — Academy publishing (one person, ~1 day once content is in hand)

1. Create course: `/dashboard/teaching/[username]/courses/new` → title "Better Vice Club: Coffee", category "Better Vice Club", `navigation_mode = 'cyoa'`.
2. Set cover image (Cloudinary upload) — use a visually arresting origin-region photo, not a stock mug-of-coffee shot.
3. Write course description (~200 words). APA-cited if it makes any factual claims.
4. Create Module 1 "Season 1: Coffee" — single module for Episode 1; Episodes 2–7 will be additional modules in the same course or separate courses (decide then).
5. Add lessons in order, one per §4 row:
   - Set `lesson_type` correctly (`text` / `audio` / `video` / `quiz`)
   - Upload media (audio/video via Cloudinary widget)
   - Paste transcript + chapters (existing UI supports this)
   - Attach documents (existing UI)
   - For map lessons, paste GeoJSON via the map editor UI
   - Set `is_free_preview` on lessons 1 + 2
6. Add glossary terms: 15–25 entries via `/dashboard/teaching/[username]/courses/[id]/glossary`.
7. Add quiz questions via quiz editor.
8. Publish course: `courses.is_published = true`.
9. Set price (owner decides — suggest $19.99 one-time or included in all paid tiers).

### 5.3 — QA before launch

- Read every lesson end-to-end. Sanity check every citation link.
- On a fresh-Incognito unauthenticated session, confirm free preview works.
- As a test-enrolled student, complete the quiz and get a grade.
- Complete the assignment, upload the write-up, confirm teacher can review.
- Accessibility pass: keyboard-navigate every lesson, VoiceOver-read a sample.
- Contrast check: ensure no dark-on-dark text on any lesson.

---

## 6. Success criteria

Episode 1 is "done" when:

1. Course is published and enrollable.
2. At least 1 real student (not the owner's test account) has completed at least the first 3 lessons, provided unsolicited feedback.
3. All citation URLs still resolve 14 days after publish (URL rot check).
4. No accessibility issues reported in the first 30 days of public availability.

Do NOT start Episode 2 until these are met.

---

## 7. Files that will be touched

Mostly content (markdown + media uploads); minimal code.

**Likely code touches (only if gaps surface):**
- `components/academy/course-editor/CurriculumTab.tsx` — if some lesson-type editing proves clunky in practice.
- `lib/academy/citation-format.ts` — small helper to validate/render APA citations consistently in lessons, if the current plain-text rendering looks poor.
- New: `content/tutorials/bvc/coffee/*.md` — source-of-truth markdown drafts for each lesson before they go into the Academy DB (mirrors the pattern in [`content/tutorials/academy/`](../../content/tutorials/academy/)).

**Likely no-code:**
- Cloudinary folder: `academy/bvc/coffee/` for audio, images, document PDFs.

---

## 8. Risks + mitigations

- **Risk: primary sources behind paywalls.** Mitigation: lean on open-access databases (JSTOR Open, Africana, university archives) and well-sourced encyclopedia-style tertiary sources when primaries are gated. Note the gate in the citation ("paywalled") so students can seek school library access.
- **Risk: indigenous knowledge sources are harder to find in APA-citable form.** Mitigation: cite cultural institutions (National Museum of Ethiopia, Specialty Coffee Association cultural-heritage resources), indigenous scholars' published work, oral-history transcripts from reputable archives.
- **Risk: content production time blows out.** Mitigation: publish Episode 1 as "beta" with a visible note, gather feedback, iterate before other episodes ramp. Don't let perfect block real-user feedback.
- **Risk: Academy UX issue not caught in earlier plans.** Mitigation: the owner goes through the full student flow (not just the teacher flow) before publish. Report any blockers to a `plans/33a-bvc-academy-polish.md` spillover, handle only what's blocking.

---

## 9. Next actions for the human

1. Owner confirms the lesson arc in §4 (or revises).
2. Owner decides pricing for the course.
3. Content producer (owner or delegate) starts drafting Lesson 1 and 2 content.
4. When first two lessons are in hand, Claude helps wire them into the Academy (lessons are data, not code — Claude's role is mostly CSV-import assistance + troubleshooting).
5. Iterate to publish within 2–3 weeks from content-start.
