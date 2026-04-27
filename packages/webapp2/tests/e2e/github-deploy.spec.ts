import { test, expect, type Page } from '@playwright/test';

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
const REPO_DESCRIPTION = 'E2E deploy contract test';

test.describe('GitHub deploy: projectExport envelope', () => {
  let capturedBody: any = null;

  test.beforeEach(async ({ page }) => {
    capturedBody = null;

    // Mock GitHub auth status so useGitHubAuth treats the user as signed in.
    await page.route('**/besser_api/github/auth/status**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, username: 'e2e-user' }),
      });
    });

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

    await page.goto('/');
    await createBlankProject(page, 'Deploy_E2E_Project');

    // The envelope filters out empty diagrams (see diagramHasContent), so seed
    // one Class element into the active project's ClassDiagram before opening
    // the deploy dialog. Otherwise envelope.project.diagrams would be `{}`.
    await page.evaluate(() => {
      const latestId = localStorage.getItem('besser_latest_project');
      if (!latestId) return;
      const key = `besser_project_${latestId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const project = JSON.parse(raw);
      const classDiag = project?.diagrams?.ClassDiagram?.[0];
      if (!classDiag) return;
      classDiag.model = classDiag.model || {};
      classDiag.model.elements = {
        'el-1': {
          id: 'el-1',
          name: 'FooClass',
          type: 'Class',
          owner: null,
          bounds: { x: 0, y: 0, width: 200, height: 100 },
        },
      };
      classDiag.model.relationships = classDiag.model.relationships || {};
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
    // a "Connect to GitHub first" toast). The "Toggle GitHub version control
    // panel" button only renders when isAuthenticated is true.
    await expect(
      header.getByRole('button', { name: /toggle github version control panel/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Open the Deploy dropdown and click "Publish Web App to Render".
    const deployButton = header.getByRole('button', { name: /^deploy$/i });
    await deployButton.click();
    await page.getByRole('menuitem', { name: /publish web app to render/i }).click();

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
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createBlankProject(page: Page, name: string) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  await dialog.getByText('Create Blank').click();
  await expect(dialog.getByText('Create A Project')).toBeVisible();

  const nameInput = dialog.getByLabel(/name/i);
  await nameInput.clear();
  await nameInput.fill(name);

  await dialog.getByRole('button', { name: /create project/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}
