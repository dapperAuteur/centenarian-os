# CentenarianOS Style Guide

This guide covers **git workflow and collaboration rules**. For code style (Tailwind, a11y, mobile-first, shared-DB rules, etc.), see [CLAUDE.md](CLAUDE.md).

Read CLAUDE.md first, then this file, before starting any task.

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

## 6. Plan files (write the plan BEFORE you write code)

Non-trivial work starts with a plan file at `plans/NN-slug.md`, where `NN` is the next unused sequential number. **Write the plan file first**, in the project's `plans/` directory — not in `~/.claude/plans/`, not in your head, not in chat scrollback. If the plan isn't written down in the project before coding starts, nothing else in this guide is being followed.

For throwaway fixes (one-line tweaks, typos), skip the plan.

**Rules:**

- `plans/` is **gitignored** — these files are local-only. They are not committed, not shared, and not referenced by any production code path.
- Numbering is strictly sequential. Never reuse a number, even if the original plan was abandoned — leave the gap.
- Sub-plans that belong to a parent plan use the letter-suffix form: `04a-…`, `04b-…`.
- Reference the plan in the commit body when it shaped the work: `Implements plans/NN-slug.md`. The reference is for local context only; readers without the plans directory will just ignore it.
- If Claude Code's plan mode wrote a plan to `~/.claude/plans/<random-slug>.md`, **copy it to `plans/NN-slug.md` before any code is written**. The auto-generated path is a working draft; the project path is the source of truth.

**Every plan file must have a matching validation file** at `plans/validate/NN-slug.md` (same number, same slug). The validation file is a manual checklist the human can run after the work merges, to prove the feature actually works end-to-end. It contains:

- Prerequisites (env vars, migrations, fixtures)
- Numbered checks with checkboxes (`- [ ] ...`)
- Each check is something a person can do in a browser, terminal, or DB shell
- A failure-modes section (what should happen when things go wrong)
- A sign-off table at the bottom

Both files (`plans/NN-slug.md` and `plans/validate/NN-slug.md`) are written **at the same time, before coding begins**. The validation file is the "definition of done" — if you can't write the checks before you start, you don't yet understand what success looks like.

---

## 7. Gitignored working directories

These directories exist in the repo but are **gitignored** — files inside them are local-only and will never appear in a commit or PR:

- `plans/` — implementation plan files (see §6)
- `content/` — tutorial scripts and other authoring drafts (`content/tutorials/<module>/NN-slug.md`)

When you create a file in one of these directories you will not see it in `git status`. That is expected. If you want a file tracked, put it somewhere else — or open a separate decision to remove the directory from `.gitignore`, which has wider implications.

A branch that only modifies files inside a gitignored directory will produce an empty commit. Don't push it — delete the local branch instead.
