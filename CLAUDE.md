## ⚠️ Ecosystem repo identity (don't confuse these)

The site **brandanthonymcdonald.com** (BAM's personal portfolio) lives in `/Users/bam/Code_NOiCloud/ai-builds/claude/bam-landing-page/` — **NOT** `bam-portfolio`. A stray directory at `/Users/bam/Code_NOiCloud/projects/bam-portfolio/` exists from a prior misplaced `Write` call (parent dirs auto-created); it is not a real repo. When asked to work on the brandanthonymcdonald.com codebase, target `bam-landing-page`.

This mistake has been made more than once. If you're about to write a file under `projects/bam-portfolio/` or refer to it as the BAM portfolio repo, stop and re-read this note.

---

## Operator-task rule — capture user actions in `./plans/user-tasks/`

When Claude proposes work that needs BAM to do something outside the editor (account signup, API key, DNS change, vendor dashboard, env-var rotation, secret generation, PR review/merge, etc.), Claude MUST create a `./plans/user-tasks/NN-slug.md` file in this repo. **No exceptions for "small" steps.**

Required sections per task file: **Scope tag** · **What + why** (with explicit *what this blocks* detail and any hard deadline) · **Steps** · **What Claude will use** · **How to mark done** · **Related**.

Update `./plans/user-tasks/00-descriptions.md` index with columns `# | Title | Scope | Blocks | Status`. The `Blocks` column is non-negotiable — that's the column BAM scans to triage the queue.

Full rule with rationale and reference task: `/Users/bam/Code_NOiCloud/ai-builds/gemini/witus/CLAUDE.md` §"Operator-task rule".

**Ecosystem-wide tasks** (Keap, IRL events, weekly retros, consultant reconciliation, cross-product decisions, shared-DB migrations) live in the canonical witus queue at `gemini/witus/plans/user-tasks/`. **Repo-local tasks** (CentOS deploy, env vars, Stripe / Supabase / Gemini vendor work) live in this repo's own `./plans/user-tasks/`. Read the witus queue at session start before starting dependent work.

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
