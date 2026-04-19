// tests/a11y/authenticated.spec.ts
// Axe-core smoke suite for routes that require a logged-in session —
// dashboard home, planner, finance, teacher course editor. These
// surfaces hold most of the recent spot-fixes (dark-theme contrast,
// teacher-editor placeholders, chapter-marker labels), so putting CI
// eyes on them is where Phase B pays for itself.
//
// Credentials: this spec is skipped unless
// `A11Y_TEST_EMAIL` + `A11Y_TEST_PASSWORD` are set in the environment.
// Create a dedicated test user in Supabase with a verified email, a
// paid/lifetime subscription flag, and teacher role so every surface
// renders as a real logged-in teacher would see it. In CI, expose
// those values as GitHub secrets and add them to the a11y workflow
// `env:` block.

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const EMAIL = process.env.A11Y_TEST_EMAIL;
const PASSWORD = process.env.A11Y_TEST_PASSWORD;
const hasCreds = Boolean(EMAIL && PASSWORD);

const AUTHED_ROUTES: Array<{ path: string; label: string }> = [
  { path: '/dashboard', label: 'dashboard-home' },
  { path: '/dashboard/planner', label: 'planner' },
  { path: '/dashboard/finance', label: 'finance' },
  { path: '/dashboard/teaching', label: 'teacher-dashboard' },
  { path: '/dashboard/teaching/courses', label: 'teacher-courses-list' },
  { path: '/academy/my-courses', label: 'my-courses' },
  { path: '/dashboard/messages', label: 'messages-inbox' },
  { path: '/dashboard/categories', label: 'life-categories' },
];

const ENFORCE = !process.env.SKIP_ENFORCEMENT;

test.describe('authenticated a11y', () => {
  test.skip(!hasCreds, 'Set A11Y_TEST_EMAIL + A11Y_TEST_PASSWORD to run');

  test.beforeEach(async ({ page }) => {
    // Email + password login. If the app later switches to
    // magic-link-only auth, swap to a Supabase admin API token exchange
    // that sets the session cookie directly — form-fill won't work.
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.getByLabel(/email/i).fill(EMAIL!);
    await page.getByLabel(/password/i).fill(PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|academy)/, { timeout: 15_000 });
  });

  for (const route of AUTHED_ROUTES) {
    test(`a11y: ${route.label} (${route.path})`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const critical = results.violations.filter((v) => v.impact === 'critical');
      const serious = results.violations.filter((v) => v.impact === 'serious');
      const moderate = results.violations.filter((v) => v.impact === 'moderate');
      const minor = results.violations.filter((v) => v.impact === 'minor');

      if (results.violations.length > 0) {
        console.log(
          `\n[a11y-auth] ${route.path} — ${critical.length} critical, ${serious.length} serious, ${moderate.length} moderate, ${minor.length} minor:`,
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
});
