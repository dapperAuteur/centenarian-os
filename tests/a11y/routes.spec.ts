// tests/a11y/routes.spec.ts
// Axe-core smoke suite — loads the top 10 public routes, runs axe,
// asserts no critical/serious violations.
//
// Phase A (plan 37): baseline-only enforcement. Set env
// SKIP_ENFORCEMENT=1 to list violations without failing the run
// (useful for the initial scan before remediation). CI uses
// enforcement by default once the baseline is clean.
//
// Covers only PUBLIC routes. Authenticated surfaces (dashboard,
// teacher editor) come in Phase B — needs a scripted-login fixture.

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES: Array<{ path: string; label: string }> = [
  { path: '/', label: 'landing' },
  { path: '/pricing', label: 'pricing' },
  { path: '/signup', label: 'signup' },
  { path: '/login', label: 'login' },
  { path: '/academy', label: 'academy-catalog' },
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

    // Always log so devs see violations even when we don't enforce.
    if (results.violations.length > 0) {
      console.log(
        `\n[a11y] ${route.path} — ${critical.length} critical, ${serious.length} serious, ${results.violations.length} total:`,
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
