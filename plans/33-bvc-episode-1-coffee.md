# Plan 33 — BVC Episode 1: Coffee

> **Status:** Ship content this branch. Audio recorded separately per the BVC Season 1 recording schedule CSV.
> **Source:** owner decision 2026-04-16 — see direction doc decisions. Master content at [`BVC/BVC_Episode_1_Coffee_MASTER.md`](BVC/BVC_Episode_1_Coffee_MASTER.md).
> **Arc:** revised to match the master doc's subject-lens pedagogical framework (Geography / Social Studies / Economics / ELA) rather than the chronological arc originally proposed.

---

## 1. Context

Academy infrastructure is ~90% complete for BVC needs. This plan ships Episode 1 (Coffee) as a published, enrollable Academy course. **Audio is deferred** — all lessons ship as text + data sheets + maps first; owner records audio on the BVC Season 1 recording schedule and upgrades each lesson's `lesson_type` from `text` to `audio` when the MP3 is ready.

---

## 2. Audience (master-doc framing)

**Primary:** podcast listeners ages 25–45.
**Secondary:** grades 9–12 for educational use (Indiana Academic Standards + Common Core alignment).

Marketing copy, course description, and the Welcome lesson prioritize adult podcast listeners. Teacher resources (activities, rubrics, IAS alignment) are attached as downloadable documents on Lesson 1 so educators can access them without wading through student-facing content.

---

## 3. Content rules (non-negotiable)

Per `plans/ecosystem/centenarianos.md`. Enforced editorially, not in code:

1. No fabricated characters. The master doc uses `[ILLUSTRATIVE EXAMPLE — composite/fictional scenario]` tags around constructed scenarios; keep these tags in rendered content.
2. APA citations with working URLs. Already in master doc.
3. Peer-reviewed sources for scientific claims.
4. Indigenous knowledge treated as valid and rigorous.
5. No sensationalism — present competing evidence, name disagreements.

---

## 4. Revised lesson arc (matches master doc)

| # | Title | Type | Duration | Free preview |
|---|---|---|---|---|
| 1 | **Welcome — The Morning Ritual** | text (audio later) | ~2 min | ✅ |
| 2 | **Geography — Where Coffee Grows** | text + interactive map (audio later) | ~8 min | ✅ |
| 3 | **Social Studies — The Coffeehouse Revolution** | text + primary-source docs (audio later) | ~8 min | — |
| 4 | **Economics — Follow the Money** | text + data tables (audio later) | ~8 min | — |
| 5 | **ELA — Stories in Every Cup** | text + literary excerpts (audio later) | ~8 min | — |
| 6 | **Closing — Your Morning Altar** | text (audio later) | ~3 min | — |
| 7 | **Knowledge Check** | quiz (8 MC questions) | ~10 min | — |
| 8 | **Project — Trace Your Favorite Coffee** | text (describes the 4 project options from master doc Part 4) | ~5 min read + 2–3 weeks work | — |

**Mapping slot:** Lesson 2 — Leaflet `map_content` with Coffee Belt polygon, top 10 producer markers, trade-route polylines.

**Teacher resources:** attached as `lessons.documents` JSONB on Lesson 1 — markdown/PDF bundle of classroom activities (4), knowledge-check answer keys, IAS alignment doc, bibliography.

---

## 5. What ships in this branch (`feat/bvc-coffee-content-load`)

- `content/tutorials/bvc/coffee/` — 8 lesson markdown drafts (source of truth before Academy import).
- `public/templates/bvc-episode-1-coffee-lessons.csv` — ready-to-import CSV with all lesson text, embedded map JSON, embedded quiz JSON, embedded documents JSON.
- `public/templates/bvc-season-1-recording-schedule.csv` — audio recording schedule for planner import (roadmap/goals/milestones/tasks across all 7 Season 1 episodes).

No migrations, no new code, no API endpoints. Everything is content + CSV templates.

---

## 6. Owner import steps (once content is reviewed)

1. **Create the course** via `/dashboard/teaching/[username]/courses/new`:
   - Title: *Better Vice Club: Coffee*
   - Category: *Better Vice Club*
   - Navigation: `cyoa` (students pick subject-order)
   - Price: TBD (suggested $19.99 one-time, or included with paid tiers)
   - Cover image: high-quality origin-region or extraction photograph (not a stock mug shot)
2. **Import lessons** via the course editor's CSV import, selecting `public/templates/bvc-episode-1-coffee-lessons.csv`. Mode: `create` (first run) or `upsert` (subsequent reruns).
3. **Attach teacher resources** — the CSV already embeds the documents JSON on Lesson 1. Verify it rendered.
4. **Add glossary** via `/dashboard/teaching/[username]/courses/[id]/glossary` — 21 terms drawn from the master doc's Pronunciation Quick Reference + Geography vocabulary.
5. **Set free preview** on Lessons 1 and 2 (already flagged in CSV via `is_free_preview`).
6. **Publish** — toggle `is_published = true`.
7. **Import recording schedule** via `/dashboard/data/import/planner`, selecting `public/templates/bvc-season-1-recording-schedule.csv`.

---

## 7. Audio upgrade path (post-recording)

When each segment's audio is ready:

1. Upload the MP3 to Cloudinary folder `academy/bvc/coffee/`.
2. Edit the relevant lesson in the Academy course editor:
   - Change `lesson_type` from `text` → `audio`.
   - Paste Cloudinary secure URL into `content_url`.
   - Paste chapter markers (format: `[[seconds, "Chapter title"]]` or use the chapter-editor UI).
   - Paste synced transcript into `transcript_content`.
   - `text_content` (the data sheet) stays as a sidebar for visual learners.

No migration, no redeploy.

---

## 8. Verification

1. Visit `/academy` → *Better Vice Club: Coffee* appears in the catalog.
2. Visit the course detail page → Lessons 1 and 2 show "Free preview" badge.
3. Enroll (test account) → all 8 lessons accessible.
4. Open Lesson 2 → interactive map renders; hover/click markers show country data.
5. Open Lesson 7 → 8 MC quiz questions render; answering shows per-question explanation + citation.
6. Open Lesson 1 → documents section lists teacher resources as downloadable links.
7. As owner (teacher role): the downloads exist and are readable.
8. Planner: roadmap "BVC Season 1 Recording" appears with 7 episode goals.

---

## 9. Success criteria (unchanged)

Episode 1 is "done" when:
1. Course is published and enrollable.
2. At least 1 real student (not the owner) completes ≥ Lessons 1–3, provides unsolicited feedback.
3. All citation URLs resolve 14 days after publish.
4. No a11y regressions in 30 days.
5. First audio segment uploaded (proves the upgrade path).

Do NOT start Episode 2 content import until (1)–(4) are met AND at least one full episode's audio has been uploaded through the upgrade-path workflow.

---

## 10. Relationship to Season 2 + 3

Master docs for Episodes 8–14 (Season 2) + 15–21 (Season 3) live at [`BVC/BVC Season 2 and 3/`](BVC/BVC%20Season%202%20and%203/). All follow the same 4-subject-lens structure. Gap analysis at [`BVC/BVC Season 2 and 3/BVC_CentenarianOS_Gap_Analysis.md`](BVC/BVC%20Season%202%20and%203/BVC_CentenarianOS_Gap_Analysis.md) predates most of the Academy infra we shipped — most listed gaps (audio chapters, transcript sync, interactive maps, document viewer, podcast linking) are already closed.

Remaining not-yet-closed gap from that doc:
- **GAP 2: Threaded discussion per lesson.** The codebase has `LessonDiscussion` component — needs verification it's per-lesson (not per-assignment only). If gap remains, plan 35 covers it.
- **GAP 5: Course reviews + star ratings.** `courses.avg_rating` and `review_count` exist; needs verification the review flow is complete. If gap remains, plan 35 covers it.

Don't scope Season 2 import until Episode 1 has run through the success criteria loop.
