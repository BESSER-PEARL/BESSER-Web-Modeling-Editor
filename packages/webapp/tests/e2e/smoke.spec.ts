import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify the app boots, renders its core shell, and allows
 * basic navigation between diagram types.
 */
test.describe('Smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('besser_analytics_consent', JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }));
    });
    await page.reload();
  });

  test('app loads and shows the welcome / project hub dialog', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText('Welcome to the BESSER Web Modeling Editor')).toBeVisible();
  });

  test('can create a new blank project from the hub', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await dialog.getByText('Create Blank').click();
    await expect(dialog.getByText('Create A Project')).toBeVisible();

    const nameInput = dialog.getByLabel(/name/i);
    await nameInput.clear();
    await nameInput.fill('E2E_Smoke_Test');

    await dialog.getByRole('button', { name: /create project/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });

  test('sidebar is visible after creating a project', async ({ page }) => {
    await createBlankProject(page, 'Sidebar_Test');

    // WorkspaceSidebar renders an <aside> element.
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Sidebar has multiple buttons (6 diagram types + settings + collapse toggle = 8+)
    const buttons = sidebar.getByRole('button');
    await expect(buttons.first()).toBeVisible();
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('can switch between diagram types via the sidebar', async ({ page }) => {
    await createBlankProject(page, 'Switch_Diagram_Test');

    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Click the second button (Object diagram) — first is Class (default active).
    const buttons = sidebar.getByRole('button');
    await buttons.nth(1).click();

    // The clicked button should have brand active styling.
    await expect(buttons.nth(1)).toHaveClass(/border-brand/);
  });

  test('header contains logo, file menu, and generate menu', async ({ page }) => {
    await createBlankProject(page, 'Header_Test');

    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Logo image should be present.
    await expect(header.locator('img')).toBeVisible();

    // File and Generate buttons visible (by title attribute).
    await expect(header.locator('button[title="File"]')).toBeVisible();
    await expect(header.locator('button[title="Generate"]')).toBeVisible();
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
