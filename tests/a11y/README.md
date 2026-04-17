# Accessibility smoke suite

Axe-core on the top 10 public routes. Plan 37.

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

Ten public routes (see [`routes.spec.ts`](routes.spec.ts)):

- `/` landing
- `/pricing`
- `/signup`
- `/login`
- `/academy` — course catalog
- `/recipes` — public recipes hub
- `/blog`
- `/coaching`
- `/features`
- `/tech-roadmap`

Rules: WCAG 2.1 Level A + AA. Best-practice rules will be added later once the Level-A/AA baseline is clean.

## What's NOT scanned (yet)

Authenticated surfaces (dashboard, teacher editor, lesson pages). Adding them needs a scripted-login fixture — **Phase B** per plan 37.

Mobile viewport, reduced-motion, high-contrast, keyboard-only navigation — all future work.

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
