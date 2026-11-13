import { test, expect } from '@playwright/test';
import { chooserHeading, createBlankProject, openCreateProjectForm, openFreshApp, workspaceSidebar } from './helpers/project';

/**
 * Smoke tests — verify the app boots, renders its core shell, and allows
 * basic navigation between diagram types.
 */
test.describe('Smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshApp(page);
  });

  test('app loads and shows the first-run "Model it / Describe it" chooser', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(chooserHeading(page)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /model it/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /describe it/i })).toBeVisible();
  });

  test('can create a new blank project from the hub', async ({ page }) => {
    const dialog = await openCreateProjectForm(page);
    await expect(dialog.getByRole('heading', { name: /create a project/i })).toBeVisible();

    await dialog.locator('#project-name').fill('E2E_Smoke_Test');

    await dialog.getByRole('button', { name: /create project/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });

  test('sidebar is visible after creating a project', async ({ page }) => {
    await createBlankProject(page, 'Sidebar_Test');

    // WorkspaceSidebar renders an <aside> element.
    const sidebar = workspaceSidebar(page);
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Sidebar has multiple buttons (6 diagram types + settings + collapse toggle = 8+)
    const buttons = sidebar.getByRole('button');
    await expect(buttons.first()).toBeVisible();
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('can switch between diagram types via the sidebar', async ({ page }) => {
    await createBlankProject(page, 'Switch_Diagram_Test');

    const sidebar = workspaceSidebar(page);
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Class is active by default; switch to the Object diagram.
    const classButton = sidebar.getByRole('button', { name: 'Class', exact: true });
    const objectButton = sidebar.getByRole('button', { name: 'Object', exact: true });
    await expect(classButton).toHaveAttribute('aria-current', 'page');
    await objectButton.click();

    // The clicked button becomes the active page; Class no longer is.
    await expect(objectButton).toHaveAttribute('aria-current', 'page');
    await expect(classButton).not.toHaveAttribute('aria-current', 'page');
  });

  test('header contains logo, file menu, and generate menu', async ({ page }) => {
    await createBlankProject(page, 'Header_Test');

    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Logo image should be present.
    await expect(header.locator('img')).toBeVisible();

    // File and Generate menu triggers visible (by accessible name).
    await expect(header.getByRole('button', { name: /^file$/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /^generate/i })).toBeVisible();
  });
});
