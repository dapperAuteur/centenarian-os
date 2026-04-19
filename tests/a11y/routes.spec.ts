// tests/a11y/routes.spec.ts
// Axe-core smoke suite — loads the public routes, runs axe, asserts no
// critical/serious violations. Moderate/minor violations are logged
// with counts but not enforced (yet).
//
// SKIP_ENFORCEMENT=1 lists violations without failing — used for the
// initial baseline scan. CI enforces by default.
//
// Runs once per Playwright project (see playwright.a11y.config.ts) —
// Phase B adds a mobile-Chrome project alongside the desktop one so
// the same routes are scanned at a 390×844 viewport too.

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES: Array<{ path: string; label: string }> = [
  { path: '/', label: 'landing' },
  { path: '/pricing', label: 'pricing' },
  { path: '/signup', label: 'signup' },
  { path: '/login', label: 'login' },
  { path: '/academy', label: 'academy-catalog' },
  { path: '/academy/explore', label: 'academy-explore-map' },
  { path: '/recipes', label: 'recipes-hub' },
  { path: '/blog', label: 'blog-index' },
  { path: '/coaching', label: 'coaching' },
  { path: '/features', label: 'features' },
  { path: '/tech-roadmap', label: 'tech-roadmap' },
];

const ENFORCE = !process.env.SKIP_ENFORCEMENT;

for (const route of ROUTES) {
  test(`a11y: ${route.label} (${route.path})`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      // Include WCAG 2.1 A + AA rules. Best-practice rules are
      // noisier — enable once the spec rules are clean.
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical');
    const serious = results.violations.filter((v) => v.impact === 'serious');
    const moderate = results.violations.filter((v) => v.impact === 'moderate');
    const minor = results.violations.filter((v) => v.impact === 'minor');

    // Always log so devs see violations even when we don't enforce.
    if (results.violations.length > 0) {
      console.log(
        `\n[a11y] ${route.path} — ${critical.length} critical, ${serious.length} serious, ${moderate.length} moderate, ${minor.length} minor:`,
      );
      for (const v of results.violations) {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
        console.log(`    ${v.helpUrl}`);
        for (const node of v.nodes.slice(0, 3)) {
          console.log(`    selector: ${node.target.join(' ')}`);
        }
      }
    }

    if (ENFORCE) {
      expect(critical, 'no critical a11y violations').toHaveLength(0);
      expect(serious, 'no serious a11y violations').toHaveLength(0);
    }
  });
}
