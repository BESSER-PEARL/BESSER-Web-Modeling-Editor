import { test, expect } from '@playwright/test';
import { createBlankProject, openFreshApp, workspaceSidebar } from './helpers/project';

/**
 * Navigation and sidebar tests — verify sidebar diagram type buttons,
 * editor switching, settings navigation, sidebar collapse/expand,
 * and dropdown menus. (Theme toggling is covered by theme.spec.ts.)
 */
test.describe('Navigation and sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshApp(page);
    await createBlankProject(page, 'Navigation_E2E');
  });

  test('sidebar shows all diagram type icons', async ({ page }) => {
    const sidebar = workspaceSidebar(page);
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
    const sidebar = workspaceSidebar(page);
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
      await expect(button).toHaveAttribute('aria-current', 'page', { timeout: 5_000 });

      // The main editor area should remain visible.
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('click Settings in sidebar and verify settings page loads', async ({ page }) => {
    const sidebar = workspaceSidebar(page);
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Click the Settings button.
    await sidebar.getByRole('button', { name: /settings/i }).click();

    // The Project Settings heading should appear.
    await expect(page.getByRole('heading', { name: /project settings/i })).toBeVisible({ timeout: 10_000 });
  });

  test('collapse sidebar and verify icons-only view', async ({ page }) => {
    const sidebar = workspaceSidebar(page);
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // The sidebar starts expanded (w-48) with its "Editors" title.
    await expect(sidebar).toHaveClass(/w-48/);
    await expect(sidebar.getByText('Editors', { exact: true })).toBeVisible();

    // Collapse it: icons only, no section title or item labels.
    await sidebar.getByRole('button', { name: /collapse sidebar/i }).click();
    await expect(sidebar).toHaveClass(/w-\[72px\]/, { timeout: 5_000 });
    await expect(sidebar.getByText('Editors', { exact: true })).toHaveCount(0);
    await expect(sidebar.getByText('Object', { exact: true })).toHaveCount(0);
    // The items stay reachable by their accessible names.
    await expect(sidebar.getByRole('button', { name: 'Object', exact: true })).toBeVisible();

    // Expand it again.
    await sidebar.getByRole('button', { name: /expand sidebar/i }).click();
    await expect(sidebar).toHaveClass(/w-48/, { timeout: 5_000 });
  });

  test('expanded sidebar shows labels', async ({ page }) => {
    const sidebar = workspaceSidebar(page);
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Collapse then expand, so the labels are shown by the toggle, not just the default.
    await sidebar.getByRole('button', { name: /collapse sidebar/i }).click();
    await expect(sidebar).toHaveClass(/w-\[72px\]/, { timeout: 5_000 });
    await sidebar.getByRole('button', { name: /expand sidebar/i }).click();
    await expect(sidebar).toHaveClass(/w-48/, { timeout: 5_000 });

    // The "Editors" section title should be visible.
    await expect(sidebar.getByText('Editors', { exact: true })).toBeVisible();

    // Diagram type labels should be visible as text within the buttons.
    for (const label of ['Class', 'Object', 'State', 'Agent', 'GUI', 'Quantum', 'Settings']) {
      await expect(sidebar.getByText(label, { exact: true })).toBeVisible();
    }
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
});
