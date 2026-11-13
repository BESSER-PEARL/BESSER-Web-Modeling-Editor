import { test, expect } from '@playwright/test';
import { createBlankProject } from './helpers/project';

/**
 * GitHub deploy contract — UI-driven e2e for the V2 ``projectExport`` envelope.
 *
 * The deploy menu now routes through ``useGitHubRepo.createRepo`` (via
 * ``useRenderDeploy.deployToRender``), which is the path that ships the
 * ``projectExport`` field on the deploy POST body. We drive the actual UI:
 * click Deploy → "Publish Web App to Render", fill the dialog, hit Publish,
 * then assert the request body shape captured from the mocked backend route.
 *
 * If a future change drops ``projectExport`` from the POST or breaks the
 * envelope shape, this spec breaks loudly. The unit-level shape of
 * ``buildProjectExportEnvelope`` is covered by Vitest in the same package.
 */

const REPO_NAME = 'deploy-e2e-repo';
const GITHUB_MENU_SIGNED_IN = /link this project to a github repository/i;
const REPO_DESCRIPTION = 'E2E deploy contract test';

test.describe('GitHub deploy: projectExport envelope', () => {
  let capturedBody: any = null;

  test.beforeEach(async ({ page }) => {
    capturedBody = null;
    await signInToGitHub(page);

    // Mock the deploy endpoint and capture the outgoing request body.
    await page.route('**/besser_api/github/deploy-webapp', async (route) => {
      capturedBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          repo_url: 'https://github.com/e2e-user/deploy-e2e-repo',
          repo_name: REPO_NAME,
          owner: 'e2e-user',
          files_uploaded: 1,
          message: 'ok',
          deployment_urls: {
            github: 'https://github.com/e2e-user/deploy-e2e-repo',
            render: 'https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fe2e-user%2Fdeploy-e2e-repo',
          },
          is_first_deploy: true,
        }),
      });
    });

    await page.goto('/');
    await createProject(page, 'Deploy_E2E_Project', { saveOnGithub: false });

    // The envelope filters out empty diagrams (see diagramHasContent, which
    // counts only v4 `nodes` / `edges`), so seed one v4 class node into the
    // active project's ClassDiagram before opening the deploy dialog.
    // Otherwise envelope.project.diagrams would be `{}`.
    await page.evaluate(() => {
      const latestId = localStorage.getItem('besser_latest_project');
      if (!latestId) return;
      const key = `besser_project_${latestId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const project = JSON.parse(raw);
      const classDiag = project?.diagrams?.ClassDiagram?.[0];
      if (!classDiag?.model) return;
      classDiag.model.nodes = [
        {
          id: 'el-1',
          type: 'class',
          position: { x: 0, y: 0 },
          width: 200,
          height: 100,
          measured: { width: 200, height: 100 },
          data: { name: 'FooClass', attributes: [], methods: [] },
        },
      ];
      classDiag.model.edges = Array.isArray(classDiag.model.edges) ? classDiag.model.edges : [];
      localStorage.setItem(key, JSON.stringify(project));
    });
  });

  test.afterEach(async ({ page }) => {
    // Keep route handlers from leaking if anyone enables `serial` mode later.
    await page.unroute('**/besser_api/github/deploy-webapp');
    await page.unroute('**/besser_api/github/auth/status**');
  });

  test('deploy dialog ships a V2 projectExport envelope on publish', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Wait for the GitHub auth status mock to resolve so useGitHubAuth flips
    // ``isAuthenticated`` to true (otherwise handleOpenDeployDialog bails with
    // a "Connect to GitHub first" toast). Signed out, the GitHub menu is a
    // "Connect GitHub" button; signed in, it offers to link the project.
    await expect(header.getByRole('button', { name: GITHUB_MENU_SIGNED_IN })).toBeVisible({ timeout: 10_000 });

    // Open the Deploy dropdown and click "Publish Web App to Render".
    const deployButton = header.getByRole('button', { name: /^deploy$/i });
    await deployButton.click();
    await page.getByRole('menuitem', { name: /^publish to render…?$/i }).click();

    // The deploy dialog should appear in create-new-repo mode.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('heading', { name: /publish to render/i })).toBeVisible();

    const repoNameInput = dialog.getByLabel(/repository name/i);
    await repoNameInput.clear();
    await repoNameInput.fill(REPO_NAME);

    const repoDescriptionInput = dialog.getByLabel(/description/i);
    await repoDescriptionInput.clear();
    await repoDescriptionInput.fill(REPO_DESCRIPTION);

    await dialog.getByRole('button', { name: /publish to render/i }).click();

    // Wait for the deploy POST to land and the success toast to appear.
    await expect.poll(() => capturedBody, { timeout: 10_000 }).not.toBeNull();
    await expect(page.getByText(`Repository created: ${REPO_NAME}`)).toBeVisible({ timeout: 10_000 });

    // Assert the captured request body matches the V2 envelope contract.
    expect(capturedBody).not.toBeNull();
    expect(capturedBody.deploy_config).toBeTruthy();
    expect(capturedBody.deploy_config.repo_name).toBe(REPO_NAME);
    expect(capturedBody.projectExport).toBeTruthy();
    expect(capturedBody.projectExport.version).toBe('2.0.0');
    expect(typeof capturedBody.projectExport.exportedAt).toBe('string');
    // exportedAt must round-trip through Date as a valid ISO string.
    expect(new Date(capturedBody.projectExport.exportedAt).toISOString()).toBe(
      capturedBody.projectExport.exportedAt,
    );
    expect(capturedBody.projectExport.project).toBeTruthy();
    expect(typeof capturedBody.projectExport.project).toBe('object');
    expect(capturedBody.projectExport.project.diagrams).toBeTruthy();
    expect(Object.keys(capturedBody.projectExport.project.diagrams).length).toBeGreaterThan(0);
    // The seeded v4 class node must survive the content filter.
    const classDiagrams = capturedBody.projectExport.project.diagrams.ClassDiagram;
    expect(Array.isArray(classDiagrams)).toBe(true);
    expect(
      classDiagrams.some((d: any) =>
        Array.isArray(d?.model?.nodes) && d.model.nodes.some((n: any) => n?.data?.name === 'FooClass'),
      ),
    ).toBe(true);
  });
});

test.describe('GitHub: save a new project in its own repository', () => {
  test('creating a project with "Save it on GitHub" makes a private repo and links it', async ({ page }) => {
    let createBody: any = null;
    await signInToGitHub(page);
    await page.route('**/besser_api/github/repos', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [], truncated: false }) });
    });
    await page.route('**/besser_api/github/project/create-repo', async (route) => {
      createBody = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ owner: 'e2e-user', repo_url: 'https://github.com/e2e-user/shop', commit_sha: 'a'.repeat(40), branch: 'main' }),
      });
    });
    await page.route('**/besser_api/github/sync-status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ head_sha: 'a'.repeat(40), commits_since: [], in_sync: true }),
      });
    });

    await page.goto('/');
    await createProject(page, 'Shop', { saveOnGithub: true });

    await expect.poll(() => createBody, { timeout: 10_000 }).not.toBeNull();
    expect(createBody.repo_name).toBe('shop');
    expect(createBody.is_private).toBe(true);
    expect(createBody.project_export.version).toBe('2.0.0');
    expect(createBody.project_export.project.name).toBe('Shop');

    // The GitHub menu now names the linked repository instead of offering to link one.
    const header = page.locator('header').first();
    await expect(header.getByRole('button', { name: /e2e-user\/shop: in sync with github/i })).toBeVisible({ timeout: 10_000 });
    await expect(header.getByRole('button', { name: GITHUB_MENU_SIGNED_IN })).toHaveCount(0);

    // The menu explains itself: "How GitHub works in BESSER" opens the Help guide at its GitHub section.
    await header.getByRole('button', { name: /e2e-user\/shop/i }).click();
    await page.getByRole('menuitem', { name: /how github works in besser/i }).click();
    const guide = page.getByRole('dialog');
    await expect(guide.getByRole('button', { name: 'GitHub', pressed: true })).toBeVisible();
    await expect(guide.getByText('What Goes in the Repository')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock the GitHub auth check and seed a session, so the editor starts signed in as e2e-user. */
async function signInToGitHub(page: Page) {
  await page.route('**/besser_api/github/auth/status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, username: 'e2e-user' }),
    });
  });

  // Seed storage BEFORE the first navigation so useGitHubAuth's mount-effect
  // sees the session/username on the very first render. (Setting after goto
  // and reloading races the React.StrictMode double-mount + verifySession
  // AbortController cleanup, which can reject the in-flight fetch and
  // trigger logout(), wiping the seed.)
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        'besser_analytics_consent',
        JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() })
      );
      // Pin storage migrations as already-applied so runStorageMigrations
      // doesn't strip ``github_username`` (the v2 migration clears it).
      localStorage.setItem('besser_storage_version', '2');
      // Token format must match useGitHubAuth.isValidSessionToken:
      // /^[a-zA-Z0-9_-]{10,200}$/
      sessionStorage.setItem('github_session', 'e2e-session-token-1234');
      sessionStorage.setItem('github_session_timestamp', String(Date.now()));
      localStorage.setItem('github_username', 'e2e-user');
    } catch {
      // Storage may not be available on the about:blank pre-navigation page;
      // that's fine — the script re-runs on every document load.
    }
  });
}

/** First-run landing > Model it > the create form, with "Save it on GitHub" set as asked. */
async function createProject(page: Page, name: string, { saveOnGithub }: { saveOnGithub: boolean }) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  await dialog.getByRole('button', { name: /Model it/ }).click();
  await expect(dialog.getByText('Create a Project')).toBeVisible();

  const nameInput = dialog.getByLabel(/^name/i);
  await nameInput.clear();
  await nameInput.fill(name);

  const saveBox = dialog.getByTestId('create-save-github');
  if ((await saveBox.isChecked()) !== saveOnGithub) await saveBox.click();

  await dialog.getByRole('button', { name: /create project/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}
