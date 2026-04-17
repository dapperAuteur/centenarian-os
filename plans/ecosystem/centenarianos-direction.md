# CentenarianOS — Directional Decisions (2026-04-16)
## `./plans/ecosystem/centenarianos-direction.md`

> **Read this alongside [`README.md`](README.md) and [`centenarianos.md`](centenarianos.md).** The README defines ecosystem-wide scope rules. `centenarianos.md` defines what CentOS owns. **This doc** captures point-in-time directional decisions the owner has made — which way the platform is heading right now.
>
> When these decisions conflict with features you're asked to build, bring the conflict to the owner before coding.

---

## 1. The owner-signed decisions

Decided 2026-04-16 after reviewing the ecosystem docs and the current state of the report at `plans/reports/01-plans-status-2026-04-16.md`.

### 1.1 — Academy shifts from infrastructure to content

Plans 20–27, 29, 26.0 built a full 360°/virtual-tour/offline-capable Academy platform. The headline content for that platform (Better Vice Club Season 1 — Coffee / Tea / Chocolate / Sugar / Guayusa / Kola Nut / Kava + synthesis) has not yet been produced. **New direction: stop adding Academy features; start producing BVC content.**

This does not mean no more Academy bug fixes or quality-of-life polish. It means **no net-new Academy feature flags or routes until BVC Episode 1 is published and real students have used it.**

See §3 below for the infrastructure-completeness audit that backs this decision.

### 1.2 — Plan 26 full is cancelled

Per ecosystem rules, "immersive 360° place-based learning" is Wanderlearn's job. A native Insta360 desktop companion for Academy would cross into Wanderlearn's scope. **Plan 26 "full" (SDK integration, desktop companion app) is formally cancelled.** Plan 26.0 (filename-pattern title hints + aspect-ratio sanity check) is the terminal work — already shipped on `feat/academy-360-upload-hints`.

The research brief at [`../26-academy-insta360-import-research.md`](../26-academy-insta360-import-research.md) remains as historical context. The teacher-camera survey in that brief is still useful for Wanderlearn's planning if that project picks up — not for CentOS.

Plan 26's mobile deep-link was already cancelled for technical reasons (Insta360 app doesn't expose share targets).

### 1.3 — Starter tier stays CentOS-only for now

Pricing ecosystem standard is $10.60/mo + $103.29/yr + $103.29 lifetime across all paid WitUS apps. CentOS's new Starter tier ($5.46/mo + $51.80/yr, pick-3-modules) is a **local experiment** that does not propagate until we have data.

Re-evaluate after 90 days of Starter subscriber data:
- If Starter conversion to Pro is ≥20% within 90 days → validate and consider propagating the pattern (in each app's own module shape) to Work.WitUS, Tour Manager OS, Fly.WitUS.
- If Starter total revenue net of Pro-downgrades is negative → deprecate Starter before it spreads.
- If stable but unremarkable → leave as-is, CentOS-only, don't propagate.

Until then, marketing copy must not claim "WitUS pricing" for the $5.46 tier. CentOS-specific language only.

### 1.4 — Magic-link auth is a priority, not blocking

Ecosystem target: single WitUS account across all apps, magic-link only. CentOS is currently email/password + OTP. **Every new auth-touching change must move toward magic-link, not further away.** A full migration ships as plan 34 when it reaches the top of the queue.

### 1.5 — DB-sharing with Work.WitUS: flagged architectural debt

Ecosystem README: "Each app has its OWN instance. Never share databases across apps."
CentOS [`CLAUDE.md`](../../CLAUDE.md) (line ~65): "This app's Supabase database is shared with other apps (e.g. the Contractor/JobHub app)."

These describe different moments — the README is the target architecture, CLAUDE.md is present-state reality. This is **architectural debt to revisit, not a decision to make today.** Keep treating the shared DB as shared per CLAUDE.md's rules (additive migrations, app-agnostic RLS policies, optional-chain-on-profile-columns) until the owner decides whether to split.

---

## 2. What to do instead of Academy features

Active priorities in rough order:

| Plan | What | Why |
|---|---|---|
| **33** | BVC Episode 1 (Coffee) content production + verification | Academy's reason for existing |
| **34** | Magic-link auth migration | Ecosystem alignment debt |
| **30** | Stripe fee calculator on price inputs | Small QoL owner requested; 1–2 hrs |
| **31** | i18n EN+ES + SEO metadata | Phased, 1–2 weeks total |
| **32** | Admin email verification dashboard | Shipped |
| Starter-tier ops | Monitor first 90 days of Starter data | Feeds §1.3 decision |

Post-BVC-Episode-1 future work (not planned yet, don't start until after Episode 1 ships):
- BVC Episodes 2–7 (Tea, Chocolate, Sugar, Guayusa, Kola Nut, Kava)
- BVC Season 1 synthesis / assessment
- Integration: Academy glossary → FlashLearnAI deck per course
- Integration: Academy → Wanderlearn preview blocks
- Integration: Academy teacher profile ↔ witus.online/learn

---

## 3. Academy infrastructure — completeness audit

Answering the owner's question: **how close is Academy infrastructure to being complete?**

Short answer: **>90% complete for BVC Episode 1 needs.** The gaps that remain are content-production pipeline polish, not missing capabilities. We should ship Episode 1 content against current infrastructure, and only fix infra that's actually broken by the attempt.

### 3.1 — Shipped (adequate for BVC)

- **Lesson types:** text, video, audio, slides, quiz, 360video, photo_360, virtual_tour. Coffee episode will mostly use audio + text + maps.
- **Audio chapters + transcript sync:** migration 071 + `TranscriptPanel` component (plan 24).
- **Interactive maps per lesson:** migration 074 — `lessons.map_content` JSONB (center, zoom, markers, lines, polygons).
- **Documents per lesson:** same migration — `lessons.documents` JSONB gallery.
- **Podcast linking per lesson:** same migration — `lessons.podcast_url`.
- **Quizzes:** migration 070 — full question/answer/grade flow.
- **Assignments:** shipped earlier, scoped to course / module / lesson.
- **Glossary:** infra shipped; 65-term Season 1 glossary is content to be authored.
- **CYOA navigation:** opt-in per course (`courses.navigation_mode`).
- **Semantic crossroads:** `lesson_embeddings` via Gemini 768-dim + `/api/academy/courses/[id]/lessons/[lessonId]/crossroads`.
- **Live sessions:** generic iframe embed (Viloud.tv etc.).
- **Discussions:** per-lesson threads.
- **Student ↔ teacher messaging:** shipped.
- **Bulk CSV course import:** shipped + templates at `/public/templates/course-import.csv`.
- **Offline caching:** plans 25a–c — 360° media + page-shell SW + enrollment-revocation purge.
- **Free preview + Stripe-Connect payouts:** shipped.
- **Error handling + toasts:** plan 29.
- **Media library + picker:** plans 27a–b.

### 3.2 — Minor gaps (won't block BVC, fix if encountered)

- **Completion certificates:** no `course_completions` → certificate PDF generation pipeline. High-schooler audience may want this; not strictly required for Episode 1 launch.
- **Teacher analytics dashboard:** student-progress-by-lesson heatmap doesn't exist. Workable with current per-student progress view; refine later.
- **Course category taxonomy:** freeform category field with a datalist of suggestions. BVC needs its own "Better Vice Club" category — just add to the datalist when Episode 1 goes up.
- **Accessibility audit:** no single pass. Spot-fixes have happened as issues arose (dark-on-dark contrast sweeps, checkmark bug). A full axe-core CI check is backlog.
- **Sub-account / family plan:** not built. High-school teachers might want classroom bulk-enrollment. Backlog after Episode 1.

### 3.3 — Content-production pipeline (what Episode 1 actually needs)

- **Episode authoring workflow:** currently each teacher uses the course editor → add lessons → one at a time. **Adequate for Episode 1 (single owner authoring).** Bulk CSV import is an escape hatch.
- **Citation format:** plan 33 must enforce APA with working links per ecosystem rules. This is a content-quality gate, not infrastructure.
- **Indigenous-knowledge sourcing policy:** plan 33 must lay this out — treated as rigorous and citable alongside peer-reviewed sources.
- **No-fabrication rule enforcement:** plan 33 must prohibit invented characters (no Rosa, Mrs. Chen, Uncle Keoni, Elena, Dr. Martinez). This is an editorial guardrail, not code.

### 3.4 — Conclusion

Ship Episode 1 against what exists. If a real gap surfaces during content production, fix it then — not preemptively.

---

## 4. How this doc gets used

- **Claude (coding agent):** [STYLE_GUIDE §8](../../STYLE_GUIDE.md) makes reading this doc and the ecosystem directory mandatory before proposing any new feature. If a feature idea conflicts with §1 here, surface the conflict before coding.
- **Owner:** update this doc when the direction changes. Don't edit in place — append a dated "Revision" section so prior decisions stay discoverable.
- **Review cadence:** quarterly, or whenever a major plan ships.

---

## 5. Pointers

- Ecosystem master: [`README.md`](README.md)
- CentOS platform doc: [`centenarianos.md`](centenarianos.md)
- Plan 26 research (cancelled plan, historical): [`../26-academy-insta360-import-research.md`](../26-academy-insta360-import-research.md)
- Plan 33 (active): [`../33-bvc-episode-1-coffee.md`](../33-bvc-episode-1-coffee.md)
- Plan 34 (backlog): [`../34-auth-magic-link-migration.md`](../34-auth-magic-link-migration.md)
- Live status report: [`../reports/01-plans-status-2026-04-16.md`](../reports/01-plans-status-2026-04-16.md)
