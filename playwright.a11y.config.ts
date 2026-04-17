// playwright.a11y.config.ts
// Playwright config scoped to the a11y axe-core smoke suite (plan 37).
// Kept separate from any future functional-test config so the a11y run
// can evolve (mobile viewport matrix, auth fixtures, etc.) without
// affecting other test scopes.

import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ?? '3000';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

// Phase A runs on a locally-started dev server.
// The CI workflow starts `pnpm dev` + `wait-on` before the test step.
export default defineConfig({
  testDir: './tests/a11y',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/a11y', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
