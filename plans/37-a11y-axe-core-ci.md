# Plan 37 — Accessibility: axe-core in CI

> **Status:** Backlog. Not blocking BVC Episode 1 launch; should ship before scaling to the full BVC grades-9–12 audience since many schools require WCAG AA compliance.
> **Source:** owner request 2026-04-16 — close "final 10%" of Academy polish. Listed in [`ecosystem/centenarianos-direction.md §3.2`](ecosystem/centenarianos-direction.md) as a minor gap.
> **Effort:** Medium — 2–3 days. 1 day to set up CI + initial baseline scan, 1–2 days to triage and fix critical/serious violations discovered.

---

## 1. Context

The project has strong accessibility conventions in [`CLAUDE.md § ARIA & Accessibility`](../CLAUDE.md) (44×44 touch targets, `aria-label` on unlabeled buttons, `aria-hidden` on decorative icons, contrast floors). Compliance has been maintained by spot-fixes: dark-on-dark contrast sweeps on the teacher editor, `&check;` HTML-entity fix on landing pages, chapter-marker label additions, `aria-label` on PSV players.

What's missing is a **continuous audit** — a check that runs on every PR and catches regressions before they merge. Today a contributor could land a `<button onClick={…} />` with no label or a `color-contrast: 2.5:1` component without anyone noticing.

---

## 2. Scope

**Phase A (ship in this plan):**
- Add `@axe-core/playwright` to `devDependencies`.
- Write Playwright smoke-test specs that load the top 10 routes (landing, signup, pricing, /academy, /academy/[course], lesson page, dashboard home, planner, finance, teacher course editor) and run `AxeBuilder().analyze()`.
- GitHub Actions workflow that runs the suite on every PR against main.
- Baseline pass: run locally, review every violation, categorize (critical / serious / moderate / minor).
- Fix every **critical** and **serious** violation before enabling CI enforcement.
- Enable enforcement: PR blocks merge if critical/serious count > 0.

**Phase B (follow-up plan 37a):**
- Fix moderate/minor violations.
- Extend coverage to authenticated routes (login scripted with a test account).
- Extend to mobile viewport runs.

**Out of scope:**
- Full manual screen-reader pass on every lesson. Manual + automated are complementary; axe catches ~40% of issues.
- Automated color-blindness simulation.
- Keyboard-only navigation recording (can add later with Playwright `keyboard.press` sequences).

---

## 3. Tooling choice

**axe-core** is the industry standard. Two integration paths:

- **`@axe-core/playwright`** — runs inside Playwright specs. Good for loading routes in a real browser, handling Next.js hydration, interacting with UI states (dark mode, modals) before scanning.
- **`@axe-core/cli`** — Node script, points at URLs. Simpler, but less able to interact with UI state.

**Recommendation:** Playwright. The project already has UI worth testing beyond landing routes, and interaction coverage (opening a modal, dark-mode toggle) multiplies the return on the initial setup cost.

**npm-install block warning:** the school dev network blocks `registry.npmjs.org`. Install happens from home or in CI (GitHub runners are unblocked). Provide a minimal `types/axe-core-playwright-shim.d.ts` if local typecheck breaks; remove after first successful install.

---

## 4. CI workflow

`.github/workflows/a11y.yml`:

```yaml
name: Accessibility
on:
  pull_request:
    branches: [main]
jobs:
  axe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm dev &
      - run: npx wait-on http://localhost:3000
      - run: pnpm test:a11y
```

`pnpm test:a11y` runs the Playwright suite. Fails PR if any critical/serious violations.

## 5. Files to add

- `.github/workflows/a11y.yml`
- `tests/a11y/routes.spec.ts` (Playwright test hitting 10 routes)
- `playwright.config.ts` (new, scoped to a11y tests; keep separate from unit/integration tests)

## 6. Files to modify

- `package.json` — add `@axe-core/playwright` + `@playwright/test`, add `test:a11y` script.

## 7. Verification

1. PR with a deliberately broken contrast or missing label → CI fails with a specific violation message pointing at the violating selector.
2. PR that fixes it → CI passes.
3. Baseline local run (`pnpm test:a11y`) lists all current violations grouped by route and severity.
4. Remediation PRs that fix serious violations drop the count visibly.

## 8. Expected baseline violations

Predicted problem areas based on recent spot-fixes:

- Teacher editor: residual dark-on-dark text + placeholder colors (swept before, re-audit).
- Modals: focus trap may miss edge cases.
- Course-card: hover-only color changes without focus equivalents.
- Lesson quiz UI: radio group labeling.
- PSV player controls: color-only state indicators for play/pause.

Budget a day for remediation after the baseline scan.

## 9. Long-term

Once Phase A is stable and the CI is green reliably, consider:
- Lighthouse scores in CI (broader audit including perf + SEO + PWA).
- Storybook + `@storybook/addon-a11y` for component-level audits.
- Rotating manual screen-reader pass monthly.
