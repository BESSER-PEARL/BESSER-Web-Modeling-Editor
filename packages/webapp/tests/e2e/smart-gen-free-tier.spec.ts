import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: the keyless "Free" tier of the Spec-Driven Agent.
 *
 * This is the FIRST spec that drives the AI-assistant → generate flow, and it
 * exists because the free-tier "Use the free model" button once closed the
 * dialog and silently did nothing — a race between Radix's `onOpenChange`
 * (which ran the cancel handler) and the trigger hook's resume effect. That
 * bug slipped past 95 unit tests and a backend SSE check because it only
 * manifests in a REAL browser closing a REAL dialog. So this test drives the
 * actual click and asserts a run actually starts.
 *
 * The two slow / flaky externals are mocked so the test is deterministic and
 * fast (no classifier LLM, no GPU):
 *   - the assistant WebSocket (ws://localhost:8765) → we inject the
 *     `trigger_smart_generator` action the way the agent would;
 *   - the SSE endpoint (/besser_api/smart-generate) → a canned start/phase/done
 *     stream, plus we capture the POST body to assert the wire contract.
 * The config endpoint is mocked so the free tier is advertised (else the UI is
 * hidden by design).
 */

const RUN_ID = '0123456789abcdef0123456789abcdef';

// Exact SSE wire format streamSse expects: `data: <json>` frames, blank-line
// separated, discriminator in the JSON `event` field. Trailing blank line
// flushes the last frame.
const SSE_STREAM =
  `data: ${JSON.stringify({ event: 'start', runId: RUN_ID, provider: 'free', llmModel: 'qwen3-coder:30b', maxCost: 1, maxRuntime: 600 })}\n\n` +
  `data: ${JSON.stringify({ event: 'phase', phase: 'select', message: 'Selecting generator' })}\n\n` +
  `data: ${JSON.stringify({ event: 'phase', phase: 'generate', message: 'Running deterministic generator' })}\n\n` +
  `data: ${JSON.stringify({ event: 'done', runId: RUN_ID, downloadUrl: `/besser_api/download-smart/${RUN_ID}`, fileName: 'app.zip', isZip: true, recipe: { generator_used: 'backend' } })}\n\n`;

const FREE_CONFIG = {
  caps: {
    max_cost_usd_hard_cap: 2,
    max_runtime_seconds_hard_cap: 900,
    default_max_cost_usd: 1,
    default_max_runtime_seconds: 600,
  },
  download_ttl_seconds: 1800,
  features: {},
  default_models: {},
  supported_providers: ['anthropic'],
  free_tier: { available: true, model: 'qwen3-coder:30b' },
};

async function createBlankProject(page: Page, name: string): Promise<void> {
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Create Blank').click();
  await dialog.getByLabel(/name/i).fill(name);
  await dialog.getByRole('button', { name: /create project/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

test('keyless free tier: "Use the free model" starts a run with the right wire contract', async ({ page }) => {
  // Capture the POST body the frontend sends for the free run.
  let smartGenBody: Record<string, unknown> | null = null;

  // 1. Advertise the free tier (register BEFORE navigation — the config
  //    fetch is cached module-level for the page lifetime).
  await page.route('**/besser_api/smart-gen/config', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FREE_CONFIG) }),
  );

  // 2. Mock the SSE run and record the request body.
  await page.route('**/besser_api/smart-generate', (route) => {
    smartGenBody = route.request().postDataJSON() as Record<string, unknown>;
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: SSE_STREAM });
  });

  // 3. Mock the assistant WebSocket: reply to the user's message with the
  //    trigger action, the way the modeling agent would (no classifier LLM).
  let triggered = false;
  await page.routeWebSocket(/localhost:8765/, (ws) => {
    ws.onMessage((raw) => {
      let msg: { action?: string } = {};
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.action === 'user_message' && !triggered) {
        triggered = true;
        ws.send(
          JSON.stringify({
            action: 'trigger_smart_generator',
            instructions: 'Build a FastAPI backend for this model',
            message: 'Starting smart generation…',
          }),
        );
      }
    });
  });

  // 4. Boot the app, decline analytics, open a blank project (the assistant
  //    only mounts on the editor page and the run needs an open project).
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      'besser_analytics_consent',
      JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }),
    );
  });
  await page.reload();
  await createBlankProject(page, 'E2E_FreeTier');

  // 5. Open the assistant and send a prompt (the WS mock turns it into a
  //    trigger_smart_generator, which opens the run dialog). The widget and
  //    drawer each mount a composer, so target the VISIBLE one (only the
  //    toggled widget is shown). The SmartGenByokDialog itself is a single
  //    app-level instance (application.tsx), so its selectors stay unscoped.
  await page.evaluate(() => window.dispatchEvent(new Event('besser:toggle-agent-widget')));
  const composer = page.locator('textarea[aria-label="Write your prompt here"]:visible').first();
  await expect(composer).toBeVisible({ timeout: 10_000 });
  await composer.fill('generate a full stack web application for this model');
  // Submit via Enter on the composer we already have (a second, off-viewport
  // send button exists in the collapsed drawer, which foils a global click).
  await composer.press('Enter');

  // 6. The BYOK/run dialog opens and advertises the free option at the top.
  const freeButton = page.getByRole('button', { name: /use the free model/i });
  await expect(freeButton).toBeVisible({ timeout: 15_000 });

  // 7. THE regression check: clicking it must START a run, not silently cancel.
  await freeButton.click();

  // 7a. The run fired with the correct keyless wire contract.
  await expect
    .poll(() => smartGenBody, { timeout: 15_000, message: 'free run never POSTed /smart-generate' })
    .not.toBeNull();
  expect(smartGenBody!.provider).toBe('free');
  expect(smartGenBody!.api_key).toBeUndefined(); // server injects it — never client-side
  expect(smartGenBody!.base_url).toBeUndefined();

  // 7b. The run reached completion (the mocked `done` event was processed) …
  await expect(page.getByText(/finished building|ready to download|download/i).first()).toBeVisible({
    timeout: 15_000,
  });

  // 7c. … and the "no API key, did not run" cancel message NEVER appeared.
  await expect(page.getByText(/no api key set/i)).toHaveCount(0);
});
