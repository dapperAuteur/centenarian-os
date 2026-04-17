# CentenarianOS Style Guide

This guide covers **git workflow and collaboration rules**. For code style (Tailwind, a11y, mobile-first, shared-DB rules, etc.), see [CLAUDE.md](CLAUDE.md).

Read CLAUDE.md first, then this file, before starting any task.

---

## 0. The golden rule: branch first, commit last

**Every change — every feature, every bug fix, every chore, every doc edit — begins with creating a new branch off `main`. No exceptions, no direct commits to `main`, no "it's just a tiny fix."**

The workflow for every task, from one-line typo fixes to multi-week features, is:

1. `git checkout main && git pull` (start from latest)
2. `git checkout -b <prefix>/<slug>` (new branch BEFORE any edits)
3. Make the changes.
4. When the work is done, `git commit` with a message that describes the changes actually made (see §3).
5. Push the branch and open a PR (see §4).

If you catch yourself editing files while `git branch --show-current` says `main`, stop, stash the work, branch, pop the stash, and continue. Never commit on `main`.

---

## 1. One branch per logical change

- Every feature, fix, or chore goes on its own branch off `main`.
- One branch = one PR = one merge. Do not stack unrelated work on the same branch.
- If a task turns out to be two things, stop and split the branch before continuing.

---

## 2. Branch naming

Use one of these prefixes followed by a short kebab-case slug:

| Prefix            | Use for                                                       | Example                            |
|-------------------|---------------------------------------------------------------|------------------------------------|
| `feat/`           | New user-facing feature or new capability                     | `feat/academy-360-video`           |
| `fix/` or `bug/`  | Bug fix (interchangeable — pick one and stay consistent)      | `fix/travel-roundtrip-co2`         |
| `docs/`           | Documentation only — STYLE_GUIDE, READMEs, inline doc updates | `docs/style-guide-gitignored-dirs` |
| `chore/`          | Tooling, deps, refactor, non-user-visible cleanup             | `chore/rename-cloudinary-sign-route` |

Rules:
- Lowercase, kebab-case, no spaces or underscores.
- Keep slugs ≤ 5 words. The commit message carries the detail.
- Never commit directly to `main`.

---

## 3. Conventional Commits

**Write the commit message at the end of the work, after everything is done, and describe the changes that were actually made.** Not the intent, not the ticket title, not what was planned — what the commit actually does. If the commit body doesn't match the diff, rewrite the body before pushing.

Every commit message follows [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

optional body

optional footer
```

**Types we use:**

| Type       | When                                               |
|------------|----------------------------------------------------|
| `feat`     | New feature                                        |
| `fix`      | Bug fix                                            |
| `chore`    | Tooling, deps, infra                               |
| `docs`     | Documentation only                                 |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                            |
| `test`     | Adding or fixing tests                             |
| `style`    | Formatting only (no logic change)                  |

**Scope** is the module or area touched: `academy`, `travel`, `finance`, `planner`, `workouts`, `equipment`, `auth`, `stripe`, `deps`, etc.

**Subject** is imperative, lowercase, no trailing period, ≤ 72 chars:

- `feat(academy): add 360 video lesson type`
- `fix(travel): correct round-trip co2 calc`
- `chore(deps): bump photo-sphere-viewer to 5.13`
- `docs(style): add style guide`

**Body** (when needed) explains the why, wraps at ~72 chars, and references the plan file if one exists:

```
feat(academy): add 360 video lesson type

Adds a new lesson_type '360video' that renders an equirectangular
MP4 via Photo Sphere Viewer. Teachers can upload through Cloudinary
or paste an external URL.

Implements plans/academy-360-video.md
```

---

## 4. One PR per branch

- Every branch lands on `main` through a PR. No direct pushes to `main`.
- PR title mirrors the branch: `feat(academy): add 360 video lesson type`.
- PR description includes:
  - **Summary** — 1-3 bullets of what changed
  - **Test plan** — checklist of how to verify (dev, staging, real device if UI)
  - **Screenshots / screen recordings** for any UI change
- CI must pass (typecheck, lint, build) before merge.
- Use a **merge commit** (not squash, not rebase) so the branch history is preserved on `main`.

---

## 5. Git safety rules

These apply everywhere, always:

- **Never** `git push --force` to `main` or any shared branch. Force-push only to your own feature branch, and only when necessary.
- **Never** `git commit --no-verify`. If a hook fails, fix the underlying issue.
- **Never** `git commit --amend` a commit that has been pushed.
- **Never** `git reset --hard` without first confirming your working tree is expendable.
- **Never** drop or rename tables/columns in migrations — migrations must be additive (see [CLAUDE.md § Shared Database](CLAUDE.md)).

---

## 5a. Status reports are updated after every branch

Every shipped branch **must** append a section to the active status report at `plans/reports/NN-plans-status-YYYY-MM-DD.md` describing what just landed. No exceptions — even bug fixes and docs-only branches get a section.

- The report section is part of the same branch as the code. Don't split it into a follow-up "docs: update report" branch; reviewers and future readers benefit from diff-reading the report alongside the work.
- One section per branch, numbered sequentially (`## N. Title — branch-name (commit-sha)`).
- Include: files added/modified, behavior delivered, merge order, verification steps, and any remaining backlog changes.
- If there's no active report, start one: `plans/reports/01-plans-status-YYYY-MM-DD.md` with today's date.
- Reports live under `plans/` which is gitignored — use `git add -f` to track them. This is the one exception to §7.

Why: conversations get summarized and context is lost; the report is the durable record of what actually shipped, in what order, and with what caveats. A future Claude (or human) reading only the report should be able to reconstruct the branch chain.

---

## 6. Plan files

Non-trivial work starts with a plan file in `plans/NN-slug.md` where `NN` is the next unused sequential number. For throwaway fixes, skip the plan file.

- `plans/` is **gitignored** — these files are local-only. They are not committed, not shared, and not referenced by any production code path.
- Numbering is strictly sequential. Never reuse a number, even if the original plan was abandoned — leave the gap.
- Sub-plans that belong to a parent plan use the letter-suffix form: `04a-…`, `04b-…`.
- Reference the plan in the commit body when it shaped the work: `Implements plans/NN-slug.md`. The reference is for local context only; readers without the plans directory will just ignore it.

---

## 6a. Ecosystem + direction docs are required reading before proposing features

Before proposing or scoping any new feature, read the relevant docs in **`plans/ecosystem/`** to confirm the feature belongs in this app at all.

**Mandatory reads for CentenarianOS work:**

- [`plans/ecosystem/README.md`](plans/ecosystem/README.md) — the ecosystem-wide scope rules and "one job" principle. Includes the Redundancy Test — before building a new feature, answer: does another WitUS app already own this data or workflow?
- [`plans/ecosystem/centenarianos.md`](plans/ecosystem/centenarianos.md) — what CentOS owns and what it explicitly does NOT own. If a proposed feature falls under "not owned," link to the correct app instead of building here.
- [`plans/ecosystem/centenarianos-direction.md`](plans/ecosystem/centenarianos-direction.md) — point-in-time directional decisions the owner has made (cancelled plans, strategic pivots, what's next). Overrides older plans when in conflict.

When a proposed feature conflicts with anything in these docs, surface the conflict to the owner before coding. Do not build first and resolve later — by then you've already invested time in the wrong place.

These three docs live in `plans/` which is gitignored; force-add (`git add -f`) is required when committing updates.

---

## 7. Gitignored working directories

These directories exist in the repo but are **gitignored** — files inside them are local-only and will never appear in a commit or PR:

- `plans/` — implementation plan files (see §6). Exceptions that are force-added (`git add -f`) because they must ship with the code:
  - Status reports under `plans/reports/` (see §5a)
  - Ecosystem + direction docs under `plans/ecosystem/` (see §6a)
- `content/` — tutorial scripts and other authoring drafts (`content/tutorials/<module>/NN-slug.md`)

When you create a file in one of these directories you will not see it in `git status`. That is expected. If you want a file tracked, put it somewhere else — or open a separate decision to remove the directory from `.gitignore`, which has wider implications.

A branch that only modifies files inside a gitignored directory will produce an empty commit. Don't push it — delete the local branch instead.
