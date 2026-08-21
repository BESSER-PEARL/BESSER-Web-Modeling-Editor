import { test, expect } from '@playwright/test';

/**
 * Navigation and sidebar tests — verify sidebar diagram type buttons,
 * editor switching, settings navigation, sidebar collapse/expand,
 * dropdown menus, and theme toggling.
 */
test.describe('Navigation and sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('besser_analytics_consent', JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }));
    });
    await page.reload();
    await createBlankProject(page, 'Navigation_E2E');
  });

  test('sidebar shows all diagram type icons', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // UML diagram types
    await expect(sidebar.getByRole('button', { name: /class/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /object/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /state/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Agent', exact: true })).toBeVisible();

    // Non-UML diagram types
    await expect(sidebar.getByRole('button', { name: /gui/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /quantum/i })).toBeVisible();
  });

  test('click each diagram type and verify editor loads', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    const diagramTypes = [
      { name: 'Object', exact: true },
      { name: 'State', exact: true },
      { name: 'Agent', exact: true },
      { name: 'GUI', exact: true },
      { name: 'Quantum', exact: true },
      { name: 'Class', exact: true }, // switch back to class last
    ];

    for (const { name, exact } of diagramTypes) {
      const button = sidebar.getByRole('button', { name, exact });
      await button.click();

      // After clicking, the button should become active (indicated by border class).
      await expect(button).toHaveClass(/border-brand/, { timeout: 5_000 });

      // The main editor area should remain visible.
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('click Settings in sidebar and verify settings page loads', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Click the Settings button.
    await sidebar.getByRole('button', { name: /settings/i }).click();

    // The Project Settings heading should appear.
    await expect(page.getByRole('heading', { name: /project settings/i })).toBeVisible({ timeout: 10_000 });
  });

  test('collapse sidebar and verify icons-only view', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // By default, the sidebar starts collapsed (w-[72px]).
    // Verify it is in collapsed state by checking that labels are not rendered.
    // In collapsed mode, button text spans are not rendered (only icons).
    // The sidebar width class should indicate collapsed state.
    await expect(sidebar).toHaveClass(/w-\[72px\]/);

    // Expand the sidebar first by clicking the toggle button.
    const expandButton = sidebar.getByRole('button', { name: /expand sidebar/i });
    await expandButton.click();

    // Now the sidebar should be expanded (w-48).
    await expect(sidebar).toHaveClass(/w-48/, { timeout: 5_000 });

    // Labels like "Editors" title should be visible when expanded.
    await expect(sidebar.getByText('Editors')).toBeVisible();

    // Collapse it again.
    const collapseButton = sidebar.getByRole('button', { name: /collapse sidebar/i });
    await collapseButton.click();

    // Verify it is collapsed again.
    await expect(sidebar).toHaveClass(/w-\[72px\]/, { timeout: 5_000 });
  });

  test('expand sidebar and verify labels appear', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Expand the sidebar.
    const expandButton = sidebar.getByRole('button', { name: /expand sidebar/i });
    await expandButton.click();

    // After expanding, labels should appear alongside icons.
    await expect(sidebar).toHaveClass(/w-48/, { timeout: 5_000 });

    // The "Editors" section title should be visible.
    await expect(sidebar.getByText('Editors')).toBeVisible();

    // Diagram type labels should be visible as text within the buttons.
    await expect(sidebar.getByText('Class')).toBeVisible();
    await expect(sidebar.getByText('Object')).toBeVisible();
    await expect(sidebar.getByText('State')).toBeVisible();
    await expect(sidebar.getByText('Agent', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('GUI')).toBeVisible();
    await expect(sidebar.getByText('Quantum')).toBeVisible();
    await expect(sidebar.getByText('Settings')).toBeVisible();
  });

  test('dropdown menus open when clicking File, Generate, Deploy, Help', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    const menuButtons = [
      { name: /file/i },
      { name: /generate/i },
      { name: /deploy/i },
      { name: /help/i },
    ];

    for (const { name } of menuButtons) {
      const button = header.getByRole('button', { name });
      await expect(button).toBeVisible();
      await button.click();

      // A dropdown menu content wrapper should appear.
      const menuContent = page.locator('[data-radix-popper-content-wrapper]');
      await expect(menuContent.first()).toBeVisible({ timeout: 5_000 });

      // Close the menu by pressing Escape.
      await page.keyboard.press('Escape');
      await expect(menuContent.first()).toBeHidden({ timeout: 5_000 });
    }
  });

  test('dropdown menus have chevron indicators', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Each dropdown trigger button contains a ChevronDown icon (rendered as an SVG).
    // Check that the File, Generate, Deploy, and Help buttons each have a chevron.
    const menuButtons = [
      header.getByRole('button', { name: /file/i }),
      header.getByRole('button', { name: /generate/i }),
      header.getByRole('button', { name: /deploy/i }),
      header.getByRole('button', { name: /help/i }),
    ];

    for (const button of menuButtons) {
      await expect(button).toBeVisible();
      // Each button should contain an SVG element (the ChevronDown icon).
      const svgs = button.locator('svg');
      // At minimum there is one icon + one chevron SVG per button.
      const count = await svgs.count();
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test('theme toggle switches between light and dark', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Find the theme toggle button by its aria-label.
    const themeButton = header.getByRole('button', { name: /switch to (dark|light) mode/i });
    await expect(themeButton).toBeVisible();

    // Get initial theme state from the document element.
    const initialIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

    // Click the theme toggle.
    await themeButton.click();

    // Verify the theme class changed.
    const afterToggleIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(afterToggleIsDark).not.toBe(initialIsDark);

    // Toggle back.
    await themeButton.click();

    const restoredIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(restoredIsDark).toBe(initialIsDark);
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
