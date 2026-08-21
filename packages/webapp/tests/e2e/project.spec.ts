import { test, expect } from '@playwright/test';

/**
 * Project lifecycle tests — verify creating, saving (localStorage persistence),
 * loading, and managing projects through the ProjectHubDialog.
 */
test.describe('Project management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test so previous state does not leak.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('besser_analytics_consent', JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }));
    });
    await page.reload();
  });

  test('project hub dialog is shown when no project exists', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // The dialog should NOT be closeable when no project is active
    // (the close button is hidden via `[&>button]:hidden`).
    await expect(dialog.getByText('Welcome to the BESSER Web Modeling Editor')).toBeVisible();
  });

  test('can create a new project with custom metadata', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Navigate to the Create step.
    await dialog.getByText('Create Blank').click();
    await expect(dialog.getByText('Create A Project')).toBeVisible();

    // Fill in project details.
    const nameInput = dialog.getByLabel(/name/i);
    await nameInput.clear();
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
    await expect(page.getByRole('complementary')).toBeVisible({ timeout: 10_000 });

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

    // The ProjectHubDialog should reappear.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Welcome to the BESSER Web Modeling Editor')).toBeVisible();
  });

  test('existing projects appear in the project hub list', async ({ page }) => {
    // Create a first project.
    await createBlankProject(page, 'First_Project');
    await expect(page.getByRole('complementary')).toBeVisible({ timeout: 10_000 });

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
    await expect(page.getByRole('complementary')).toBeVisible({ timeout: 10_000 });

    // Open hub and create a second project.
    await page.locator('header img[alt="BESSER"]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.getByText('Create Blank').click();
    await expect(dialog.getByText('Create A Project')).toBeVisible();

    const nameInput = dialog.getByLabel(/name/i);
    await nameInput.clear();
    await nameInput.fill('Project_Beta');
    await dialog.getByRole('button', { name: /create project/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

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
    await expect(page.getByRole('complementary')).toBeVisible({ timeout: 10_000 });

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
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // The "Import Project" card should be visible on the start step.
    await expect(dialog.getByText('Import Project')).toBeVisible();

    // Click it to navigate to the import step.
    await dialog.getByText('Import Project').click();
    await expect(dialog.getByText('Import A Project')).toBeVisible();

    // The import step should show a file upload area.
    await expect(dialog.getByRole('button', { name: /choose file to import/i })).toBeVisible();
  });

  test('back button works in the project hub steps', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Go to the Create step.
    await dialog.getByText('Create Blank').click();
    await expect(dialog.getByText('Create A Project')).toBeVisible();

    // Click Back.
    await dialog.getByRole('button', { name: /back/i }).click();
    await expect(dialog.getByText('Welcome to the BESSER Web Modeling Editor')).toBeVisible();
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
