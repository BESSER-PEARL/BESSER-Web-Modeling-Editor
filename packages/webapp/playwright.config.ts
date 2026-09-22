import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for the BESSER Web Modeling Editor.
 *
 * Run tests:
 *   npm run test:e2e          — headless
 *   npm run test:e2e:ui       — interactive UI mode
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',

  /* Fail the build on CI if you accidentally left test.only in the source. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only. */
  retries: process.env.CI ? 2 : 0,

  /* Run tests in parallel on CI; sequential locally for easier debugging. */
  workers: process.env.CI ? 2 : 1,

  /* Reporter: concise on CI, verbose locally. */
  reporter: process.env.CI ? 'github' : 'list',

  /* Shared settings for all projects below. */
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',

    /* Capture a screenshot on test failure for quick debugging. */
    screenshot: 'only-on-failure',

    /* Collect a trace when retrying a failed test. */
    trace: 'on-first-retry',

    /* Default navigation timeout. */
    navigationTimeout: 30_000,

    /* Default action timeout. */
    actionTimeout: 15_000,
  },

  /* Browser projects — chromium only for now. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the Vite dev server before running tests. */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  /* Output directory for test artifacts (screenshots, traces, videos). */
  outputDir: './tests/e2e/test-results',
});
