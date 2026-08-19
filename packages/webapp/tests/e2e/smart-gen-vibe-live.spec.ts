import { test, expect } from '@playwright/test';

/**
 * FULL vibe E2E, no mocks: describe an app in plain words so the agent MODELS a
 * class diagram, then SPEC-DRIVEN GENERATE an app from it on the keyless FREE
 * tier — every step driven through the real UI + real backend + real agent.
 *
 * This is the "describe an app -> get an app, with no API key" demo path, end to
 * end. It is SLOW and non-deterministic (two real agent round-trips plus a
 * ~2-5 min free generation on a shared GPU) and depends on the deployed stack,
 * so it is a GATED live smoke — never part of normal CI. Run it explicitly:
 *
 *   RUN_LIVE_E2E=1 npx playwright test smart-gen-vibe-live --project=chromium
 *
 * Targets the deployed stack by default; override with LIVE_E2E_BASE_URL.
 */

const BASE = process.env.LIVE_E2E_BASE_URL || 'https://experimental.besser-pearl.org';

test.describe('live: vibe-model then spec-driven free generation', () => {
  test.skip(!process.env.RUN_LIVE_E2E, 'live e2e — set RUN_LIVE_E2E=1 to run');
  test.use({ baseURL: BASE });

  test('describe an app -> model it -> generate it on the free tier', async ({ page }) => {
    test.setTimeout(9 * 60_000); // modeling + a long free generation

    // ---- boot -------------------------------------------------------
    await page.goto('/');
    await page.evaluate(() => {
      try {
        localStorage.setItem(
          'besser_analytics_consent',
          JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }),
        );
      } catch {
        /* ignore */
      }
    });
    await page.reload();

    // ---- create a project ------------------------------------------
    const hub = page.getByRole('dialog');
    await expect(hub.getByText('Create Blank')).toBeVisible({ timeout: 25_000 });
    await hub.getByText('Create Blank').click();
    await page.waitForTimeout(1500);
    const nameField = page.getByLabel(/name/i);
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill('E2E_Vibe').catch(() => {});
      await page.getByRole('button', { name: /^create|next|continue/i }).first().click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    // ---- 1) VIBE MODEL — dual path -----------------------------------
    // The fresh-context entry is inconsistent: sometimes a "Describe Your App"
    // wizard, sometimes straight to an empty editor. Model the app via whichever
    // is present — both hand the description to the agent, which draws the
    // class diagram.
    const describeBox = page.getByPlaceholder(/build a library app to track books/i);
    if (await describeBox.isVisible().catch(() => false)) {
      await describeBox.fill('Build a library app to track books, authors, members and loans.');
      await page.getByRole('button', { name: /start building/i }).click();
    } else {
      await page.evaluate(() => window.dispatchEvent(new Event('besser:toggle-agent-widget')));
      const c = page.locator('textarea[aria-label="Write your prompt here"]:visible').first();
      await expect(c).toBeVisible({ timeout: 15_000 });
      await c.fill(
        'Create a class diagram for a library system with Book, Author, Member ' +
          'and Loan classes and the relationships between them.',
      );
      await c.press('Enter');
    }

    // The agent draws the class diagram on the canvas; a class renders as SVG
    // text (verified). Wait for it to appear.
    await expect(page.locator('svg text').getByText('Book', { exact: false }).first()).toBeVisible({
      timeout: 180_000,
    });

    // ---- 2) VIBE GENERATE: spec-driven, keyless free tier -----------
    const composer = page.locator('textarea[aria-label="Write your prompt here"]:visible').first();
    await expect(composer).toBeVisible({ timeout: 15_000 });
    const send = async (text: string) => {
      await composer.fill(text);
      await composer.press('Enter');
    };
    await send('generate a full stack web application for this model');

    // Wait for the run proposition (classifier occasionally times out on the
    // first try -> retry the send once).
    const runBtn = page.getByRole('button', { name: /run spec-driven agent/i }).last();
    try {
      await expect(runBtn).toBeVisible({ timeout: 60_000 });
    } catch {
      await send('generate a full stack web application for this model');
      await expect(runBtn).toBeVisible({ timeout: 60_000 });
    }

    // Free-tier default: clicking Run starts the generation DIRECTLY on qwen —
    // there is no BYOK popup / "use the free model" button anymore.
    await runBtn.click().catch(() => {});

    // ---- 3) the free run starts on qwen and FINISHES ---------------
    await expect(page.getByText(/free\s*\/\s*qwen/i).first()).toBeVisible({ timeout: 45_000 });
    await expect(
      page.getByText(/finished building|ready to download/i).first(),
    ).toBeVisible({ timeout: 8 * 60_000 });
    await expect(page.getByText(/no api key set/i)).toHaveCount(0);
  });
});
