import { test, expect } from '@playwright/test';

/**
 * Theme switching tests — verify that the theme toggle works correctly,
 * the dark class is applied/removed from the document element, and that
 * the theme preference persists across page reloads.
 */
test.describe('Theme switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('besser_analytics_consent', JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }));
    });
    await page.reload();
    await createBlankProject(page, 'Theme_E2E');
  });

  test('app loads with a theme applied', async ({ page }) => {
    // After loading, the document element should have a data-theme attribute.
    const dataTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(dataTheme).toBeTruthy();
    expect(['light', 'dark']).toContain(dataTheme);
  });

  test('click theme toggle button toggles dark class on document', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Find the theme toggle button by its aria-label.
    const themeButton = header.getByRole('button', { name: /switch to (dark|light) mode/i });
    await expect(themeButton).toBeVisible();

    // Check the initial state of the dark class.
    const initialHasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

    // Click the theme toggle.
    await themeButton.click();

    // Verify the dark class was toggled.
    const afterClickHasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(afterClickHasDark).toBe(!initialHasDark);
  });

  test('dark class is added when switching to dark mode', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Ensure we start in light mode for a deterministic test.
    const initialIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (initialIsDark) {
      // Toggle to light first.
      const themeButton = header.getByRole('button', { name: /switch to light mode/i });
      await themeButton.click();
    }

    // Verify we are in light mode.
    await expect(page.locator('html:not(.dark)')).toBeAttached();

    // Now toggle to dark mode.
    const toDarkButton = header.getByRole('button', { name: /switch to dark mode/i });
    await toDarkButton.click();

    // Verify the dark class is present.
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(true);

    // Verify the data-theme attribute is set to "dark".
    const dataTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(dataTheme).toBe('dark');
  });

  test('dark class is removed when switching to light mode', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Ensure we start in dark mode for a deterministic test.
    const initialIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!initialIsDark) {
      // Toggle to dark first.
      const themeButton = header.getByRole('button', { name: /switch to dark mode/i });
      await themeButton.click();
    }

    // Verify we are in dark mode.
    const isDarkNow = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDarkNow).toBe(true);

    // Now toggle to light mode.
    const toLightButton = header.getByRole('button', { name: /switch to light mode/i });
    await toLightButton.click();

    // Verify the dark class is removed.
    const isStillDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isStillDark).toBe(false);

    // Verify the data-theme attribute is set to "light".
    const dataTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(dataTheme).toBe('light');
  });

  test('theme persists after page reload', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Get the current theme state.
    const initialIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

    // Toggle the theme.
    const themeButton = header.getByRole('button', { name: /switch to (dark|light) mode/i });
    await themeButton.click();

    // Verify the theme changed.
    const afterToggleIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(afterToggleIsDark).not.toBe(initialIsDark);

    // Reload the page.
    await page.reload();

    // Wait for the workspace to re-render (project should persist via localStorage).
    await expect(page.locator('header').first()).toBeVisible({ timeout: 15_000 });

    // Verify the theme persisted after reload.
    const afterReloadIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(afterReloadIsDark).toBe(afterToggleIsDark);
  });

  test('theme toggle button label updates after toggle', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 10_000 });

    // Check if the button reflects the correct aria-label for the current state.
    const initialIsDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

    if (initialIsDark) {
      // In dark mode, the button should offer to switch to light.
      await expect(header.getByRole('button', { name: /switch to light mode/i })).toBeVisible();
    } else {
      // In light mode, the button should offer to switch to dark.
      await expect(header.getByRole('button', { name: /switch to dark mode/i })).toBeVisible();
    }

    // Toggle the theme.
    const themeButton = header.getByRole('button', { name: /switch to (dark|light) mode/i });
    await themeButton.click();

    // The aria-label should now reflect the opposite action.
    if (initialIsDark) {
      await expect(header.getByRole('button', { name: /switch to dark mode/i })).toBeVisible();
    } else {
      await expect(header.getByRole('button', { name: /switch to light mode/i })).toBeVisible();
    }
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
