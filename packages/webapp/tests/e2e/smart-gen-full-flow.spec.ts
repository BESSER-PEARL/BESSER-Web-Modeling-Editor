import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: the FULL Spec-Driven Agent conversation, driven through the real editor
 * UI — with NO AI. The two slow/flaky externals are mocked so the whole journey
 * is deterministic and fast (no classifier LLM, no qwen, no GPU):
 *
 *   - the assistant WebSocket (ws://localhost:8765) → a scripted 3-turn
 *     conversation: build the model, offer the GUI choice, then (after the GUI)
 *     PAUSE with "generate the web app?" instead of auto-generating, then on
 *     request trigger the generator;
 *   - the generation SSE (/besser_api/smart-generate) → a canned start/phase/done
 *     stream; the config endpoint advertises the free tier.
 *
 * What this proves end-to-end in a real browser:
 *   1. a natural-language request renders a CLASS MODEL on the canvas;
 *   2. the GUI-choice prompt appears and "Auto-generate" builds the GUI;
 *   3. THE PAUSE — after the GUI the agent asks to generate instead of
 *      auto-running (the regression this guards); no generation has started;
 *   4. only after the user asks does generation run — on the FREE tier with
 *      NO BYOK popup — and reach completion.
 *
 * The agent's *decision* to pause is unit-tested in Python (the confirmation /
 * planning gates); this spec verifies the FRONTEND renders and handles that
 * whole conversation + generation correctly.
 */

const RUN_ID = '0123456789abcdef0123456789abcdef';

// A compact but valid class-diagram spec the ClassDiagramConverter accepts:
// classes[{className, attributes[{name,type}], methods}], relationships[{source,target,type,name}].
const SYSTEM_SPEC = {
  systemName: 'TaskManagementSystem',
  classes: [
    { className: 'User', attributes: [{ name: 'id', type: 'str' }, { name: 'name', type: 'str' }], methods: [] },
    { className: 'Project', attributes: [{ name: 'id', type: 'str' }, { name: 'name', type: 'str' }], methods: [] },
    {
      className: 'Task',
      attributes: [{ name: 'id', type: 'str' }, { name: 'title', type: 'str' }, { name: 'done', type: 'bool' }],
      methods: [],
    },
  ],
  relationships: [
    { source: 'User', target: 'Task', type: 'Association', name: 'assignedTasks', sourceMultiplicity: '1', targetMultiplicity: '0..*' },
    { source: 'Project', target: 'Task', type: 'Association', name: 'tasks', sourceMultiplicity: '1', targetMultiplicity: '0..*' },
  ],
};

const SSE_STREAM =
  `data: ${JSON.stringify({ event: 'start', runId: RUN_ID, provider: 'free', llmModel: 'qwen3-coder:30b', maxCost: 1, maxRuntime: 600 })}\n\n` +
  `data: ${JSON.stringify({ event: 'phase', phase: 'select', message: 'Selecting generator' })}\n\n` +
  `data: ${JSON.stringify({ event: 'phase', phase: 'generate', message: 'Running deterministic generator' })}\n\n` +
  `data: ${JSON.stringify({ event: 'done', runId: RUN_ID, downloadUrl: `/besser_api/download-smart/${RUN_ID}`, fileName: 'task_app.zip', isZip: true, recipe: { generator_used: 'backend' } })}\n\n`;

const FREE_CONFIG = {
  caps: { max_cost_usd_hard_cap: 2, max_runtime_seconds_hard_cap: 900, default_max_cost_usd: 1, default_max_runtime_seconds: 600 },
  download_ttl_seconds: 1800,
  features: {},
  default_models: {},
  supported_providers: ['anthropic'],
  free_tier: { available: true, model: 'qwen3-coder:30b' },
};

/** The frontend wraps its v2 payload (with the real user text) as a JSON string
 *  in the outer `message` field. Pull the actual typed text back out. */
function userText(raw: string): string {
  try {
    const outer = JSON.parse(raw);
    if (outer.action !== 'user_message') return '';
    try {
      return String(JSON.parse(outer.message)?.message ?? '').toLowerCase();
    } catch {
      return String(outer.message ?? '').toLowerCase();
    }
  } catch {
    return '';
  }
}

async function createBlankProject(page: Page, name: string): Promise<void> {
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Create Blank').click();
  await dialog.getByLabel(/name/i).fill(name);
  await dialog.getByRole('button', { name: /create project/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

test('full conversation (no AI): request → model → GUI → PAUSE → generate → done', async ({ page }) => {
  let smartGenBody: Record<string, unknown> | null = null;

  await page.route('**/besser_api/smart-gen/config', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FREE_CONFIG) }),
  );
  await page.route('**/besser_api/smart-generate', (route) => {
    smartGenBody = route.request().postDataJSON() as Record<string, unknown>;
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: SSE_STREAM });
  });
  await page.route(`**/besser_api/download-smart/${RUN_ID}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/zip', body: Buffer.from('PK\x03\x04 fake-zip') }),
  );

  // Scripted agent: route each turn on the user's actual text.
  await page.routeWebSocket(/localhost:8765/, (ws) => {
    ws.onMessage((raw) => {
      const text = userText(String(raw));
      if (!text) return;

      // Order matters: "generate web app" also contains "web app", so the
      // generate branch MUST be checked before the build-model branch.
      if (text.includes('generate') && text.includes('web app')) {
        // Turn 3 — user asked; NOW trigger the generator.
        ws.send(JSON.stringify({
          action: 'trigger_smart_generator',
          instructions: 'Build a FastAPI backend web app for this task-management model with CRUD for each class.',
          message: 'Starting the Spec-Driven Agent…',
        }));
        return;
      }

      if (text.trim() === 'auto' || text.includes('auto-generate')) {
        // Turn 2 — build the GUI (frontend generates it from the class diagram),
        // then PAUSE: ask to generate instead of auto-running.
        ws.send(JSON.stringify({
          action: 'auto_generate_gui',
          diagramType: 'GUINoCodeDiagram',
          message: 'I built 3 screen(s) for your app — User, Project, Task. Each shows its data with quick action buttons.',
        }));
        ws.send(JSON.stringify({
          action: 'assistant_message',
          message: "Your app is fully modeled now — the data classes and their screens are both ready. Take a look, and when you're happy with it just say **generate the web app** and I'll build the code.",
          suggestedActions: [
            { label: 'Generate the web app', prompt: 'generate web app' },
            { label: 'Review the spec', prompt: 'describe my diagram' },
            { label: 'Make a change', prompt: '' },
          ],
        }));
        return;
      }

      if (text.includes('web app') || text.includes('task management')) {
        // Turn 1 — build the class model, then ask about the GUI.
        ws.send(JSON.stringify({
          action: 'inject_complete_system',
          diagramType: 'ClassDiagram',
          systemSpec: SYSTEM_SPEC,
          message: 'Your **TaskManagementSystem** spec is ready — it captures User, Project and Task. Want to review or tweak it, or shall I generate the code?',
        }));
        ws.send(JSON.stringify({
          action: 'assistant_message',
          message: 'How would you like me to generate the GUI?',
          suggestedActions: [
            { label: 'Auto-generate', prompt: 'auto' },
            { label: 'AI-generated (experimental)', prompt: 'llm' },
          ],
        }));
        return;
      }
    });
  });

  // Boot, decline analytics, open a blank project (assistant only mounts on the editor).
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('besser_analytics_consent', JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }));
  });
  await page.reload();
  await createBlankProject(page, 'E2E_FullFlow');

  // Open the assistant and send the natural-language request.
  await page.evaluate(() => window.dispatchEvent(new Event('besser:toggle-agent-widget')));
  const composer = page.locator('textarea[aria-label="Write your prompt here"]:visible').first();
  await expect(composer).toBeVisible({ timeout: 10_000 });
  await composer.fill('Create a task management web application where users can create, update, delete and assign tasks.');
  await composer.press('Enter');

  // 1 — the CLASS MODEL rendered on the canvas.
  await expect(page.locator('svg text').getByText('Task', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('svg text').getByText('Project', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/spec is ready/i).first()).toBeVisible();

  // 2 — the GUI-choice prompt appears; pick Auto-generate.
  const autoBtn = page.getByRole('button', { name: /^auto-generate$/i }).first();
  await expect(autoBtn).toBeVisible({ timeout: 10_000 });
  // dispatchEvent bypasses hit-testing: without a real backend the app can raise
  // transient "Failed to fetch" toasts that overlay the assistant and intercept
  // normal clicks. React's onClick still fires from a dispatched click event.
  await autoBtn.dispatchEvent('click');

  // 3 — THE PAUSE: the defer message + Generate button appear, and NO
  //     generation has started yet (the regression this test guards).
  await expect(page.getByText(/generate the web app.*and i'll build|just say \*?\*?generate the web app/i).first())
    .toBeVisible({ timeout: 10_000 });
  const genBtn = page.getByRole('button', { name: /generate the web app/i }).first();
  await expect(genBtn).toBeVisible();
  expect(smartGenBody, 'generation must NOT have started at the pause').toBeNull();

  // 4 — user asks to generate → runs on the FREE tier with NO popup → completes.
  await genBtn.dispatchEvent('click');
  await expect
    .poll(() => smartGenBody, { timeout: 15_000, message: 'generation never POSTed after the user asked' })
    .not.toBeNull();
  expect(smartGenBody!.provider).toBe('free');
  expect(smartGenBody!.api_key).toBeUndefined();
  await expect(page.getByText(/finished building|ready to download|download/i).first()).toBeVisible({ timeout: 15_000 });
  // The BYOK popup never appeared (free-tier default).
  await expect(page.getByText(/no api key set/i)).toHaveCount(0);
});
