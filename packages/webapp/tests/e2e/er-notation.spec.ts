import { test, expect } from '@playwright/test';
import { createBlankProject, navigateToSettings, openFreshApp, workspaceSidebar } from './helpers/project';

/**
 * ER-notation toggle tests — verify the Class Diagram Notation radio group
 * in Project Settings, persistence to localStorage, and that re-opening
 * Settings after a reload reflects the saved choice (issue #508).
 *
 * Rendering-level assertions (diamond at midpoint, underline on isId, hidden
 * methods compartment) are covered by manual browser verification — they
 * require interacting with the BESSER WME editor's internal model, which is not
 * exposed on `window` for the UML editor.
 */
test.describe('ER Notation setting', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshApp(page);
    await createBlankProject(page, 'ER_Notation_E2E');
  });

  test('Class Diagram Notation row is present in Display card with UML selected by default', async ({ page }) => {
    await navigateToSettings(page);

    await expect(page.getByText('Class Diagram Notation', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/UML \(default\) shows standard UML classes; ER shows a Chen-style/i),
    ).toBeVisible();

    const umlRadio = page.getByTestId('class-notation-uml');
    const erRadio = page.getByTestId('class-notation-er');
    await expect(umlRadio).toBeVisible();
    await expect(erRadio).toBeVisible();
    await expect(umlRadio).toHaveAttribute('aria-checked', 'true');
    await expect(erRadio).toHaveAttribute('aria-checked', 'false');
  });

  test('clicking ER switches aria-checked and writes ER to localStorage', async ({ page }) => {
    await navigateToSettings(page);

    const umlRadio = page.getByTestId('class-notation-uml');
    const erRadio = page.getByTestId('class-notation-er');

    await erRadio.click();

    await expect(erRadio).toHaveAttribute('aria-checked', 'true');
    await expect(umlRadio).toHaveAttribute('aria-checked', 'false');

    const stored = await page.evaluate(() => localStorage.getItem('besser-standalone-settings'));
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string)).toMatchObject({ classNotation: 'ER' });
  });

  test('clicking UML after ER flips the selection back and persists', async ({ page }) => {
    await navigateToSettings(page);

    await page.getByTestId('class-notation-er').click();
    await expect(page.getByTestId('class-notation-er')).toHaveAttribute('aria-checked', 'true');

    await page.getByTestId('class-notation-uml').click();
    await expect(page.getByTestId('class-notation-uml')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('class-notation-er')).toHaveAttribute('aria-checked', 'false');

    const stored = await page.evaluate(() => localStorage.getItem('besser-standalone-settings'));
    expect(JSON.parse(stored as string)).toMatchObject({ classNotation: 'UML' });
  });

  test('ER selection survives a page reload', async ({ page }) => {
    await navigateToSettings(page);
    await page.getByTestId('class-notation-er').click();
    await expect(page.getByTestId('class-notation-er')).toHaveAttribute('aria-checked', 'true');

    await page.reload();

    // Re-enter settings and confirm ER is still the selected radio.
    await navigateToSettings(page);
    await expect(page.getByTestId('class-notation-er')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('class-notation-uml')).toHaveAttribute('aria-checked', 'false');
  });

  test('editor renders without errors in ER mode', async ({ page }) => {
    await navigateToSettings(page);
    await page.getByTestId('class-notation-er').click();

    const sidebar = workspaceSidebar(page);
    await sidebar.getByRole('button', { name: /class/i }).click();

    // The Class editor returns; confirm no crash loader visible and main canvas is live.
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });
    await expect(page.locator('main')).toBeVisible();
  });
});
