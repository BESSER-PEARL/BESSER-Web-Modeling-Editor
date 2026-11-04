import { test, expect, type Page } from '@playwright/test';

/**
 * Coming back to a project linked to GitHub, in a real browser: who added what
 * on the canvas, and a request made after the last run has expired.
 *
 * The backend and the assistant are mocked: this checks what the editor does
 * with their answers, and what only a real canvas can show (where a tint lands).
 */

const RUN_ID = 'b'.repeat(32);
const HEAD = 'c'.repeat(40);
const ANA = { addedBy: 'ana', addedAt: '2026-11-01T12:00:00Z' };
const BEN = { addedBy: 'ben', addedAt: '2026-11-04T12:00:00Z' };

const classElement = (id: string, name: string, x: number) => ({
  id,
  name,
  type: 'Class',
  owner: null,
  attributes: [],
  methods: [],
  bounds: { x, y: 0, width: 200, height: 100 },
});

const SSE_STREAM =
  `data: ${JSON.stringify({ event: 'start', runId: RUN_ID, provider: 'anthropic', llmModel: 'm', maxCost: 1, maxRuntime: 60 })}\n\n` +
  `data: ${JSON.stringify({ event: 'done', runId: RUN_ID, downloadUrl: `/besser_api/download/${RUN_ID}`, fileName: 'app.zip', isZip: true, generatorUsed: 'x', recipe: {} })}\n\n`;

async function openLinkedProject(page: Page, link: Record<string, unknown>) {
  await page.route('**/besser_api/github/auth/status**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, username: 'e2e-user' }),
    }),
  );
  await page.route('**/besser_api/github/sync-status**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ head_sha: HEAD, commits_since: [], in_sync: true, pending: null }),
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      'besser_analytics_consent',
      JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }),
    );
    // Pinned as applied: the v2 storage migration clears the GitHub username.
    localStorage.setItem('besser_storage_version', '2');
    localStorage.setItem('github_username', 'e2e-user');
    sessionStorage.setItem('github_session', 'e2e-session-token-1234');
    sessionStorage.setItem('github_session_timestamp', String(Date.now()));
    sessionStorage.setItem('besser_llm_api_key', 'sk-ant-e2e');
    sessionStorage.setItem('besser_llm_provider', 'anthropic');
  });
  await page.goto('/');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('button', { name: /Model it/ }).click();
  await dialog.getByLabel(/^name/i).fill('Return_E2E');
  await dialog.getByRole('button', { name: /create project/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  await page.evaluate(
    ({ elements, attribution, stored }) => {
      const id = localStorage.getItem('besser_latest_project');
      const key = `besser_project_${id}`;
      const project = JSON.parse(localStorage.getItem(key) as string);
      project.diagrams.ClassDiagram[0].model.elements = elements;
      project.attribution = attribution;
      localStorage.setItem(key, JSON.stringify(project));
      localStorage.setItem(`besser_github_link_${id}`, JSON.stringify(stored));
    },
    {
      elements: { 'el-1': classElement('el-1', 'Book', 100), 'el-2': classElement('el-2', 'Loan', 400) },
      attribution: { 'el-1': ANA, 'el-2': BEN },
      stored: { owner: 'ana', repo: 'library', branch: 'main', baseCommitSha: HEAD, ...link },
    },
  );
  await page.reload();
  await expect(page.locator('svg[data-id="el-2"]')).toBeVisible({ timeout: 30_000 });
}

test.describe('a project linked to GitHub', () => {
  test('marks what a pull brought in, on the element, with its author', async ({ page }) => {
    await openLinkedProject(page, { newFromRepo: ['el-2'] });

    const tint = page.getByTestId('new-element-tint');
    await expect(tint).toHaveCount(1);
    await expect(page.getByText('@ben', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: /new since your last sync/i })).toContainText('Loan');

    // The tint sits on the element, in every browser.
    const element = page.locator('svg[data-id="el-2"] > g').first();
    const elementBox = await element.boundingBox();
    const tintBox = await tint.boundingBox();
    expect(Math.abs((tintBox?.x ?? 0) - (elementBox?.x ?? 0))).toBeLessThan(6);
    expect(Math.abs((tintBox?.y ?? 0) - (elementBox?.y ?? 0))).toBeLessThan(6);

    const other = await page.locator('svg[data-id="el-1"] > g').first().boundingBox();
    await page.mouse.move((other?.x ?? 0) + 20, (other?.y ?? 0) + 20);
    await expect(page.getByRole('tooltip')).toContainText('@ana');

    await page.getByRole('button', { name: /clear marks/i }).click();
    await expect(tint).toHaveCount(0);
  });

  test('a request after the last run expired continues from the code on GitHub', async ({ page }) => {
    let generateBody: Record<string, unknown> | null = null;
    await page.route('**/besser_api/spec-driven/import-github-run', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          run_id: RUN_ID,
          owner: 'ana',
          repo: 'library',
          branch: 'main',
          commit_sha: HEAD,
          has_model: true,
          has_code: true,
          project: null,
          recap: {
            runs: [{ request: 'add a search bar', date: '2026-11-01', mode: 'modify', file_count: 2 }],
            open_items: [],
            open_item_count: 0,
            commits_since_run: [],
            commit_count: 0,
          },
        }),
      }),
    );
    await page.route('**/besser_api/spec-driven/generate', (route) => {
      generateBody = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: SSE_STREAM });
    });
    let triggered = false;
    await page.routeWebSocket(/localhost:8765/, (ws) => {
      ws.onMessage((raw) => {
        if (triggered || !String(raw).includes('add a loan page')) return;
        triggered = true;
        ws.send(JSON.stringify({
          action: 'agent_reply_str',
          message: JSON.stringify({
            action: 'trigger_smart_generator',
            instructions: 'add a loan page',
            message: 'Starting…',
          }),
        }));
      });
    });

    await openLinkedProject(page, {});
    await page.getByRole('button', { name: 'Open assistant' }).locator('visible=true').first().click();
    const composer = page.getByPlaceholder(/describe what you want/i).locator('visible=true').first();
    await expect(composer).toBeVisible({ timeout: 10_000 });
    await composer.fill('add a loan page');
    await composer.press('Enter');

    await expect
      .poll(() => generateBody, { timeout: 20_000, message: 'the run never started' })
      .not.toBeNull();
    expect(generateBody).toMatchObject({ mode: 'modify', base_run_id: RUN_ID });
    await expect(page.getByText(/Continuing from/).first()).toBeVisible();
    await expect(page.getByText('add a search bar').first()).toBeVisible();
  });
});
