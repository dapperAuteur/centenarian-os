# Accessibility smoke suite

Axe-core on the public routes. Plans 37 (Phase A) + 37B (Phase B).

## Run locally

```bash
# One-time: install Playwright browsers (after `npm install`).
npx playwright install --with-deps chromium

# Terminal 1 — start the dev server
npm run dev

# Terminal 2 — run the suite
npm run test:a11y                # enforces (fails on critical/serious)
npm run test:a11y:baseline       # lists violations without failing
```

HTML report: `playwright-report/a11y/index.html`.

## What's scanned

Eleven public routes (see [`routes.spec.ts`](routes.spec.ts)):

- `/` landing
- `/pricing`
- `/signup`
- `/login`
- `/academy` — course catalog
- `/academy/explore` — BVC commodity map
- `/recipes` — public recipes hub
- `/blog`
- `/coaching`
- `/features`
- `/tech-roadmap`

Each route runs twice — once on desktop Chrome (1280×720) and once on mobile Chrome (Pixel 7 viewport, 393×852). Mobile coverage catches touch-target and stacked-layout violations that only surface below the `sm:` breakpoint.

Rules: WCAG 2.1 Level A + AA. Best-practice rules will be added later once the Level-A/AA baseline is clean.

## Authenticated routes (Phase B)

[`authenticated.spec.ts`](authenticated.spec.ts) scans eight logged-in surfaces: dashboard home, planner, finance, teacher dashboard, teacher course list, my-courses, messages, and life categories. **Skipped by default** — set `A11Y_TEST_EMAIL` and `A11Y_TEST_PASSWORD` env vars to enable.

Create a dedicated test user in Supabase with:
- Verified email address
- Active paid/lifetime subscription
- Teacher role

In CI, add `A11Y_TEST_EMAIL` + `A11Y_TEST_PASSWORD` as GitHub repository secrets and reference them from `.github/workflows/a11y.yml`. Without the secrets the authenticated spec is skipped and the job stays green — no CI regression from merging this scaffolding.

## Still not scanned

Reduced-motion, high-contrast, keyboard-only navigation, screen-reader live-region content.

## First-run baseline

1. `npm run test:a11y:baseline` to list everything without failing.
2. Tag violations critical / serious / moderate / minor.
3. Fix every critical and serious violation. Each fix is its own branch (per STYLE_GUIDE §1).
4. Once the critical/serious count is zero on main, flip the `continue-on-error: true` line in [`.github/workflows/a11y.yml`](../../.github/workflows/a11y.yml) to `false` and enforcement is live.

## Adding routes

Append to the `ROUTES` array in `routes.spec.ts`. Keep the public-only scope until the Phase B login fixture lands.

## Adding rule tags

The `.withTags([…])` call in the spec controls which axe rule set runs. Start minimal; expand once baseline is clean.

## Why a separate config

`playwright.a11y.config.ts` is scoped so future functional tests (component behavior, integration, end-to-end) can have their own config without interfering. Keep a11y as a single-purpose suite.
