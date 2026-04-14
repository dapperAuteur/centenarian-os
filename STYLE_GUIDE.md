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

| Prefix            | Use for                                                  | Example                     |
|-------------------|----------------------------------------------------------|-----------------------------|
| `feat/`           | New user-facing feature or new capability                | `feat/academy-360-video`    |
| `fix/` or `bug/`  | Bug fix (interchangeable — pick one and stay consistent) | `fix/travel-roundtrip-co2`  |
| `chore/`          | Tooling, deps, docs, refactor, non-user-visible cleanup  | `chore/style-guide`         |

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

## 6. Plan files

Non-trivial work starts with a plan file in `plans/NN-slug.md` where `NN` is the next unused sequential number. For throwaway fixes, skip the plan file.

- `plans/` is **gitignored** — these files are local-only. They are not committed, not shared, and not referenced by any production code path.
- Numbering is strictly sequential. Never reuse a number, even if the original plan was abandoned — leave the gap.
- Sub-plans that belong to a parent plan use the letter-suffix form: `04a-…`, `04b-…`.
- Reference the plan in the commit body when it shaped the work: `Implements plans/NN-slug.md`. The reference is for local context only; readers without the plans directory will just ignore it.
