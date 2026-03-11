import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify the app boots, renders its core shell, and allows
 * basic navigation between diagram types.
 */
test.describe('Smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('app loads and shows the welcome / project hub dialog', async ({ page }) => {
    // The ProjectHubDialog appears on first load when no project is active.
    // It contains the title "Welcome to the BESSER Web Modeling Editor".
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText('Welcome to the BESSER Web Modeling Editor')).toBeVisible();
  });

  test('can create a new blank project from the hub', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Click the "Create Blank" card.
    await dialog.getByText('Create Blank').click();

    // The "Create A Project" step should now be visible.
    await expect(dialog.getByText('Create A Project')).toBeVisible();

    // Fill in the project name and submit.
    const nameInput = dialog.getByLabel(/name/i);
    await nameInput.clear();
    await nameInput.fill('E2E_Smoke_Test');

    await dialog.getByRole('button', { name: /create project/i }).click();

    // The dialog should close and the workspace shell (sidebar) should be visible.
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });

  test('sidebar is visible after creating a project', async ({ page }) => {
    // Bootstrap a project so the workspace renders.
    await createBlankProject(page, 'Sidebar_Test');

    // The sidebar contains buttons for each diagram type.
    // WorkspaceSidebar renders an <aside> element.
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Verify at least the core diagram type buttons are rendered.
    // Each button has a title attribute containing the label (e.g. "Class", "Object").
    await expect(sidebar.getByRole('button', { name: /class/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /object/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /state/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /agent/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /gui/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /quantum/i })).toBeVisible();
  });

  test('can switch between diagram types via the sidebar', async ({ page }) => {
    await createBlankProject(page, 'Switch_Diagram_Test');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Default diagram type is ClassDiagram. Switch to Object.
    await sidebar.getByRole('button', { name: /object/i }).click();

    // The editor view should update — wait for the view to settle.
    // The ApollonEditorComponent is rendered for all UML types.
    // We verify the sidebar button now has an active visual state (border-sky or border-primary).
    const objectButton = sidebar.getByRole('button', { name: /object/i });
    await expect(objectButton).toHaveClass(/border-(sky|primary)/);

    // Switch to GUI (non-UML editor).
    await sidebar.getByRole('button', { name: /gui/i }).click();
    const guiButton = sidebar.getByRole('button', { name: /gui/i });
    await expect(guiButton).toHaveClass(/border-(sky|primary)/);

    // Switch to Quantum.
    await sidebar.getByRole('button', { name: /quantum/i }).click();
    const quantumButton = sidebar.getByRole('button', { name: /quantum/i });
    await expect(quantumButton).toHaveClass(/border-(sky|primary)/);
  });

  test('header contains logo, file menu, and generate menu', async ({ page }) => {
    await createBlankProject(page, 'Header_Test');

    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Logo image should be present.
    await expect(header.locator('img[alt="BESSER"]')).toBeVisible();

    // File menu trigger button should be visible.
    await expect(header.getByRole('button', { name: /file/i })).toBeVisible();

    // Generate menu trigger should be visible.
    await expect(header.getByRole('button', { name: /generate/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a blank project through the ProjectHubDialog.
 * Reusable helper for tests that need the workspace to be active.
 */
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
