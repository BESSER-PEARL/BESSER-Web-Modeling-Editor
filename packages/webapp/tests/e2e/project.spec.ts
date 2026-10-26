import { test, expect } from '@playwright/test';
import { chooserHeading, createBlankProject, openCreateProjectForm, openFreshApp, projectHub, workspaceSidebar } from './helpers/project';

/**
 * Project lifecycle tests — verify creating, saving (localStorage persistence),
 * loading, and managing projects through the ProjectHubDialog.
 */
test.describe('Project management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test so previous state does not leak.
    await openFreshApp(page);
  });

  test('project hub dialog is shown when no project exists', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // First run (no saved project) opens the low-code / agentic chooser.
    await expect(chooserHeading(page)).toBeVisible();
  });

  test('can create a new project with custom metadata', async ({ page }) => {
    // Navigate to the Create step (chooser → "Model it").
    const dialog = await openCreateProjectForm(page);
    await expect(dialog.getByRole('heading', { name: /create a project/i })).toBeVisible();

    // Fill in project details.
    const nameInput = dialog.locator('#project-name');
    await nameInput.fill('My_Test_Project');

    const ownerInput = dialog.getByLabel(/owner/i);
    await ownerInput.clear();
    await ownerInput.fill('Test Author');

    const descriptionInput = dialog.getByLabel(/description/i);
    await descriptionInput.clear();
    await descriptionInput.fill('A project created by E2E tests.');

    // Create the project.
    await dialog.getByRole('button', { name: /create project/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Verify the project name appears in the header after creation.
    const header = page.locator('header').first();
    await expect(header.locator('input').first()).toHaveValue('My_Test_Project');
  });

  test('created project persists in localStorage and reloads', async ({ page }) => {
    // Create a project.
    await createBlankProject(page, 'Persistent_Project');

    // Verify the workspace is active.
    await expect(workspaceSidebar(page)).toBeVisible({ timeout: 10_000 });

    // Reload the page — the project should be auto-loaded from localStorage.
    await page.reload();

    // After reload, the workspace should still be visible (project hub should NOT reappear).
    // The header should show the project name.
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 15_000 });

    // The project name should still be present in the input.
    await expect(header.locator('input').first()).toHaveValue('Persistent_Project');
  });

  test('can open the project hub from the header logo', async ({ page }) => {
    await createBlankProject(page, 'Hub_Reopen_Test');

    // Click the BESSER logo in the header to re-open the project hub.
    const header = page.locator('header').first();
    await header.locator('img[alt="BESSER"]').click();

    // The ProjectHubDialog should reappear on its returning-visit start screen.
    const dialog = projectHub(page);
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('heading', { name: /^projects$/i })).toBeVisible();
    await expect(dialog.getByTestId('hub-start-new')).toBeVisible();
  });

  test('existing projects appear in the project hub list', async ({ page }) => {
    // Create a first project.
    await createBlankProject(page, 'First_Project');
    await expect(workspaceSidebar(page)).toBeVisible({ timeout: 10_000 });

    // Open the project hub again.
    await page.locator('header img[alt="BESSER"]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // The "Existing Projects" section should list "First_Project".
    await expect(dialog.getByText('Existing Projects')).toBeVisible();
    await expect(dialog.getByText('First_Project')).toBeVisible();
  });

  test('can switch between two projects', async ({ page }) => {
    // Create the first project.
    await createBlankProject(page, 'Project_Alpha');
    await expect(workspaceSidebar(page)).toBeVisible({ timeout: 10_000 });

    // Open hub and create a second project.
    await page.locator('header img[alt="BESSER"]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await createBlankProject(page, 'Project_Beta');

    // Now "Project_Beta" should be active.
    await expect(page.locator('header input').first()).toHaveValue('Project_Beta');

    // Open hub and switch back to "Project_Alpha".
    await page.locator('header img[alt="BESSER"]').click();
    const dialog2 = page.getByRole('dialog');
    await expect(dialog2).toBeVisible({ timeout: 10_000 });

    // Click the existing project entry for Project_Alpha.
    await dialog2.getByText('Project_Alpha').click();
    await expect(dialog2).toBeHidden({ timeout: 10_000 });

    // Verify the header now shows "Project_Alpha".
    await expect(page.locator('header input').first()).toHaveValue('Project_Alpha');
  });

  test('can rename a project from the header', async ({ page }) => {
    await createBlankProject(page, 'Original_Name');
    await expect(workspaceSidebar(page)).toBeVisible({ timeout: 10_000 });

    // The first input in the header is the project name.
    const projectNameInput = page.locator('header input').first();
    await expect(projectNameInput).toHaveValue('Original_Name');

    // Clear and type a new name, then blur to trigger rename.
    await projectNameInput.clear();
    await projectNameInput.fill('Renamed_Project');
    await projectNameInput.press('Enter');

    // Verify the new name persists.
    await expect(projectNameInput).toHaveValue('Renamed_Project');
  });

  test('project hub shows import option', async ({ page }) => {
    const dialog = projectHub(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // First run shows the chooser; "More options" leads to the start step.
    await expect(chooserHeading(page)).toBeVisible();
    await dialog.getByRole('button', { name: /more options/i }).click();

    // The "Import Project" card should be visible on the start step.
    await expect(dialog.getByText('Import Project')).toBeVisible();

    // Click it to navigate to the import step.
    await dialog.getByText('Import Project').click();
    await expect(dialog.getByText('Import A Project')).toBeVisible();

    // The import step should show a file upload area.
    await expect(dialog.getByRole('button', { name: /drop a file or click to browse/i })).toBeVisible();
  });

  test('back button works in the project hub steps', async ({ page }) => {
    // Go to the Create step (chooser → "Model it").
    const dialog = await openCreateProjectForm(page);
    await expect(dialog.getByRole('heading', { name: /create a project/i })).toBeVisible();

    // Back returns to the chooser the step was entered from.
    await dialog.getByRole('button', { name: /^back$/i }).click();
    await expect(chooserHeading(page)).toBeVisible();
    await expect(dialog.locator('#project-name')).toHaveCount(0);
  });
});

test.describe('From Data', () => {
  const providers = {
    providers: [{ key: 'eurostat', name: 'Eurostat', baseUrl: 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1', agency: 'ESTAT' }],
    customUrlAllowed: false,
  };
  const diagram = {
    title: 'UneRtM',
    model: { version: '4.0.0', type: 'ClassDiagram', nodes: [], edges: [] },
    diagramType: 'ClassDiagram',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('besser_analytics_consent', JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }));
    });
    await page.reload();
  });

  test('creates a project from an SDMX dataflow, and none when the dataflow does not exist', async ({ page }) => {
    let imports = 0;
    await page.route('**/besser_api/sdmx-providers', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(providers) }),
    );
    await page.route('**/besser_api/sdmx-to-domain-model', async (route) => {
      imports += 1;
      const body = route.request().postDataJSON();
      if (body.dataflow === 'nope') {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Dataflow ESTAT:nope not found at Eurostat' }),
        });
        return;
      }
      expect(body).toEqual({ provider: 'eurostat', dataflow: 'une_rt_m' });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(diagram) });
    });

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'More options' }).click();
    await dialog.getByText('From Data').first().click();
    await expect(dialog.getByText('Start from Data')).toBeVisible();

    await dialog.getByRole('radio', { name: /Statistics API \(SDMX\)/ }).click();
    const dataflow = dialog.getByLabel(/^Dataflow/);
    const submit = dialog.getByRole('button', { name: /create from sdmx/i });

    await dataflow.fill('nope');
    await submit.click();
    await expect(page.getByText(/Dataflow ESTAT:nope not found at Eurostat/)).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toBeVisible();
    // No project was saved (besser_project_<id>) by the failed import.
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('besser_project_')).length)).toBe(0);

    await dataflow.fill('une_rt_m');
    await submit.click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    expect(imports).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createBlankProject(page: import('@playwright/test').Page, name: string) {
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
