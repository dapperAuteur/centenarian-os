## ⚠️ Ecosystem repo identity (don't confuse these)

When wiring outbox triggers in this repo, fetch and follow https://raw.githubusercontent.com/dapperAuteur/witus-outbox/main/examples/INTEGRATE.md and the per-app recipe at https://raw.githubusercontent.com/dapperAuteur/witus-outbox/main/examples/triggers/witus-online.md.

For ecosystem branding (favicons, logos, ecosystem footer with Rise Wellness), see https://raw.githubusercontent.com/dapperAuteur/witus-online/main/public/brand/README.md and the footer recipe at https://raw.githubusercontent.com/dapperAuteur/witus-online/main/public/brand/footer-recipe.md. The witus repo is the canonical home — update there first when ecosystem branding changes, then absorb into this repo on next touch.

---

## Docs-sync rule — update docs after app changes

When a change adds, alters, or removes an app feature, update the affected docs **in the same branch as the change** — docs are part of the change, not a follow-up. That means: the relevant user-facing guides in `docs/CentenarianAcademy/` (AdminGuide, TeacherGuide, StudentGuide, RecipesGuide, etc.), `README.md`, the in-app help/tutorial content for that area, and any process docs the change affects (e.g. `CourseAuthoringGuide.md` / `CourseProductionPlaybook.md` when course-building changes). Reflect a new feature **everywhere it belongs**, not just one place. State what docs you updated in the handoff/PR. If a doc update is genuinely out of scope for the branch, file it under `./plans/` so it is not lost.

---

# CentenarianOS — Code Style & Quality Guidelines

> **After reading this file, read [STYLE_GUIDE.md](STYLE_GUIDE.md) before making any changes.** It covers git workflow, branch naming, Conventional Commits, and PR rules that apply to every task. CLAUDE.md is the code-style doc; STYLE_GUIDE.md is the collaboration doc. Both are required reading.
>
> **Golden rule:** every change — however small — starts on a new branch off `main`. Never commit directly to `main`. Commit messages describe the changes actually made. See [STYLE_GUIDE.md §0](STYLE_GUIDE.md).

## Theme & Colors

- **CentenarianOS:** `sky` for actions, `fuchsia` for branding, light theme (`bg-gray-50`, `bg-white`)
- Dark theme pages (e.g. teaching dashboard): follow WCAG 2.1 AA contrast (4.5:1 for text, 3:1 for UI)

---

## Mobile-First & Touch Targets

- All interactive elements (buttons, links acting as buttons, icon buttons) must have a **minimum touch target of 44x44px** (`min-h-11 min-w-11`)
- Use `min-h-11` on all `<button>` and `<Link>` elements that act as buttons
- Icon-only buttons: `min-h-11 min-w-11 flex items-center justify-center`
- Stack buttons vertically on mobile, horizontally on desktop: `flex flex-col sm:flex-row`
- Keep primary action buttons within thumb reach (bottom of viewport on mobile)

---

## ARIA & Accessibility

- Every `<button>` without visible text must have `aria-label`
- Decorative icons: `aria-hidden="true"`
- Loading states: `aria-label="Loading..."` or `role="status"` with screen-reader text
- Lists of items: `role="list"` on container when semantic `<ul>` is not used
- Form inputs: always pair with `<label>` using `htmlFor`/`id`
- Error messages: `role="alert"` on error containers
- Expandable menus: `aria-expanded` on toggle buttons

---

---

## Shared Database

This app's Supabase database is shared with other apps (e.g. the Contractor/JobHub app). Keep this in mind at all times:

- **Never drop or rename tables/columns** without checking if other apps depend on them
- **Migrations must be additive** — use `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`
- **The `profiles` table is shared** — columns like `clock_format`, `dashboard_home`, etc. are used across apps. Adding columns is fine; removing or altering existing ones requires coordination
- **RLS policies must stay app-agnostic** — don't write policies that assume a single app context
- **When querying shared tables** (e.g. `profiles`, `auth.users`), don't assume all columns exist in every app's TypeScript types — use optional chaining and defaults

---

## General Code Patterns

- Use `.maybeSingle()` not `.single()` for Supabase queries that may return no rows
- Service role client (`SUPABASE_SERVICE_ROLE_KEY`) for API routes bypassing RLS
- Tailwind v4: `shrink-0` not `flex-shrink-0`, `bg-linear-to-b` not `bg-gradient-to-b`
- Never use `text-neutral-600` or darker on dark backgrounds — this is the single most common contrast bug
- Time formatting: use `formatTime()` from `lib/hooks/useClockFormat` with the user's `clockFormat` preference — never hardcode 12h or 24h

---

<!-- BEGIN:witus-shared-rules v1 -->
<!-- MANAGED BLOCK — do not edit by hand. Source: gemini/witus/docs/shared-rules.md.
     Update the source, then run `node scripts/sync-claude-rules.mjs` in the witus repo. -->

## ⚠️ Ecosystem identity (shared note — don't confuse repos)

Full ecosystem identity + the canonical product index live in `gemini/witus/CLAUDE.md` and
`gemini/witus/lib/products.ts`. Each repo states *which* product it is in its own hand-owned line
above this managed block; don't infer another app's URLs, routes, IDs, env names, or DB schema —
confirm against that app's own code.

The site **brandanthonymcdonald.com** (BAM's personal portfolio) lives in `claude/bam-landing-page/`
— **NOT** `projects/bam-portfolio/` (the retired legacy static site). Target `bam-landing-page`.

## Operator-task rule — capture user actions in `./plans/user-tasks/`

When Claude proposes work that needs BAM to do something outside the editor (account signup, API
key, DNS change, vendor dashboard, env-var rotation, secret generation, PR review/merge, etc.),
Claude MUST create a `./plans/user-tasks/NN-slug.md` file in this repo. **No exceptions for "small"
steps.** Required sections: **Scope tag** · **What + why** (with explicit *what this blocks* detail
and any hard deadline) · **Steps** · **What Claude will use** · **How to mark done** · **Related**.
Keep `./plans/user-tasks/00-descriptions.md` updated with columns `# | Title | Scope | Blocks |
Status` — the `Blocks` column is the one BAM scans. Ecosystem-wide tasks (Keap, IRL events, retros,
cross-product decisions) live in the canonical witus queue at `gemini/witus/plans/user-tasks/`;
repo-local tasks live here. Read the witus queue at session start before dependent work. Full rule:
`gemini/witus/CLAUDE.md` §"Operator-task rule".

## Branch hygiene — BAM merges, between sessions by default

**Half 1.** Branch → commit → push → stop. Claude does not run `git checkout main && git merge`.
Never `--force` to shared branches. Before every commit run `git branch --show-current`; if it is
`main`/`master`, branch first (`feat/ fix/ chore/ docs/`). After push, hand back the branch name +
summary and stop.

**Half 2.** BAM merges pushed branches via the GitHub UI between sessions. Mid-session, after a
push, BAM may merge in a separate window and the local checkout silently fast-forwards to `main` —
so re-check `git branch --show-current` before **every** commit, not just at branch creation, or you
risk landing follow-up commits directly on `main`.

**Half 3.** Keep branches small (one concern each). When a session produces multiple branches,
consolidate them into one `bundle/<slug>-YYYY-MM-DD` via `git merge --no-ff` (preserves per-concern
history — no squash), resolve conflicts during bundling, run `tsc + lint + build` against the
bundle, push, and file ONE `./plans/user-tasks/NN-merge-bundle-<slug>.md`. BAM does one merge, not N.

**Commit often.** Commit at every working checkpoint — a passing build, a finished sub-step, a green
test — not just at the end. A usage-limit cutoff, a dropped connection, or a crashed session must
never lose more than the last few minutes of work. Small frequent commits on the feature branch keep
the branch un-merged (Half 1 still holds) and give BAM clean per-step history to drill into.

A checked-in `.githooks/pre-commit` guard refuses commits made directly on `main`/`master`. Activate
once per clone: `git config core.hooksPath .githooks`. Full rule: `gemini/witus/CLAUDE.md`
§"Branch-hygiene rule".

## Docs-sync rule — a change isn't done until its docs are current

When a change adds, alters, or removes a user-visible feature/route/scope, update the affected docs
**in the same branch**: README (feature list, env examples, scripts), in-app help/tutorial content,
`ROADMAP.md` **and** any public roadmap page, API/OpenAPI docs, and STYLE_GUIDE/CONTRIBUTING when a
convention changed. State which docs you touched in the handoff. Never leave an aspirational ✅ on a
roadmap — downgrade it with a one-line reason. If a doc update is genuinely out of scope, file it as
a `./plans/` task rather than skipping silently. A Stop hook in `.claude/settings.json` gates on
this: if the session diff changed feature/route files but touched no docs, it blocks once and asks
you to update-or-defer. Schema-only migrations, refactors, perf, and dev-tooling changes don't
trigger it.

## Plans convention

All implementation plans live in `./plans/` as `NN-description-of-plan.md` (two-digit prefix,
kebab-case, next available number, don't skip). Sub-queues: `./plans/user-tasks/NN-slug.md`
(operator tasks), `./plans/bugs/`, `./plans/future/`. (`plans/` is typically gitignored.)

## Citation rule

Anything publishable, teachable, or partner-facing (curriculum, teaching-oriented help articles,
white papers, grant/sponsor/partner writing) uses APA 7 in-line citations with a `## References`
section. Code docs, internal notes, and `plans/user-tasks/*` are out of scope. Full rule:
`gemini/witus/CLAUDE.md` §"Citation rule".

## Authoritative-values rule — never assert guessed external values

When a value is owned by an external system (DNS/registrar, a host like Vercel, a third-party API,
or another ecosystem app's URLs/routes/IDs/env/schema), read it from the authoritative source; don't
hardcode a guessed default and present it as correct. If you must ship a fallback, label it as a
fallback in both UI copy and a code comment. Verify by behavior (does the flow work?), not by
exact-match against a guess. When unsure, flag or ask — never assert. Full rule:
`gemini/witus/CLAUDE.md` §"Authoritative-values rule".

## Coding conventions

UI/UX/DX conventions (a11y, component patterns, TypeScript, microcopy, git-commit vocabulary, the
default Neon+Drizzle+pnpm+Vitest stack) are consolidated in `gemini/witus/docs/shared-ui-ux-dx.md`.
Read it before writing UI or API code. Two repos are grandfathered on Supabase+Jest and documented
there as exceptions.

<!-- END:witus-shared-rules v1 -->
