import { test, expect } from '@playwright/test';

/**
 * Project Settings page tests — verify navigation to settings, rendering of
 * the settings layout, editing project metadata, toggling display preferences,
 * and confirming diagram tabs visibility rules.
 */
test.describe('Project Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('besser_analytics_consent', JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }));
    });
    await page.reload();
    await createBlankProject(page, 'Settings_E2E');
  });

  test('can navigate to /project-settings via sidebar', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // The Settings button is rendered after the diagram type buttons.
    await sidebar.getByRole('button', { name: /settings/i }).click();

    // The Project Settings panel should render with its heading.
    await expect(page.getByRole('heading', { name: /project settings/i })).toBeVisible({ timeout: 10_000 });
  });

  test('page header renders with "Project Settings" title', async ({ page }) => {
    await navigateToSettings(page);

    // The h1 heading should contain "Project Settings".
    const heading = page.getByRole('heading', { name: /project settings/i });
    await expect(heading).toBeVisible();

    // The subtitle should describe the page purpose.
    await expect(page.getByText('Manage metadata, diagrams, and display preferences')).toBeVisible();
  });

  test('two-column layout renders General card and Diagrams card', async ({ page }) => {
    await navigateToSettings(page);

    // The General card should be visible with its title.
    await expect(page.getByText('General')).toBeVisible();
    await expect(page.getByText('Basic project information')).toBeVisible();

    // The Diagrams card should be visible with its heading.
    await expect(page.getByRole('heading', { name: 'Diagrams' })).toBeVisible();
  });

  test('can edit project name on settings page', async ({ page }) => {
    await navigateToSettings(page);

    // The project name input should contain the current project name.
    const nameInput = page.locator('#settings-name');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('Settings_E2E');

    // Clear and update the project name.
    await nameInput.clear();
    await nameInput.fill('Renamed_Settings_Project');
    await nameInput.blur();

    // Verify the input reflects the new value.
    await expect(nameInput).toHaveValue('Renamed_Settings_Project');
  });

  test('can edit project description', async ({ page }) => {
    await navigateToSettings(page);

    // The description textarea should be present.
    const descriptionInput = page.locator('#settings-description');
    await expect(descriptionInput).toBeVisible();

    // Fill in a description.
    await descriptionInput.clear();
    await descriptionInput.fill('A description set by E2E tests.');
    await descriptionInput.blur();

    // Verify the textarea reflects the new value.
    await expect(descriptionInput).toHaveValue('A description set by E2E tests.');
  });

  test('can toggle "Show Instanced Objects" checkbox', async ({ page }) => {
    await navigateToSettings(page);

    // Find the "Show Instanced Objects" label and its associated checkbox.
    const instancedLabel = page.getByText('Show Instanced Objects', { exact: true });
    await expect(instancedLabel).toBeVisible();

    // The checkbox is a sibling input within the same label container.
    const checkbox = page.locator('label', { has: instancedLabel }).locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();

    // Get initial state and toggle.
    const initialChecked = await checkbox.isChecked();
    await checkbox.click();

    // Verify the checkbox toggled.
    if (initialChecked) {
      await expect(checkbox).not.toBeChecked();
    } else {
      await expect(checkbox).toBeChecked();
    }
  });

  test('can toggle "Show Association Names" checkbox', async ({ page }) => {
    await navigateToSettings(page);

    // Find the "Show Association Names" label and its associated checkbox.
    const associationLabel = page.getByText('Show Association Names', { exact: true });
    await expect(associationLabel).toBeVisible();

    const checkbox = page.locator('label', { has: associationLabel }).locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();

    // Get initial state and toggle.
    const initialChecked = await checkbox.isChecked();
    await checkbox.click();

    // Verify the checkbox toggled.
    if (initialChecked) {
      await expect(checkbox).not.toBeChecked();
    } else {
      await expect(checkbox).toBeChecked();
    }
  });

  test('export button is present on settings page', async ({ page }) => {
    await navigateToSettings(page);

    // The Export Project button should be visible in the page header.
    const exportButton = page.getByRole('button', { name: /export project/i });
    await expect(exportButton).toBeVisible();
  });

  test('can navigate back to editor via sidebar', async ({ page }) => {
    await navigateToSettings(page);

    // Click the Class diagram button in the sidebar to return to the editor.
    const sidebar = page.getByRole('complementary');
    await sidebar.getByRole('button', { name: /class/i }).click();

    // The settings heading should no longer be visible.
    await expect(page.getByRole('heading', { name: /project settings/i })).toBeHidden({ timeout: 10_000 });

    // The editor main area should be visible.
    await expect(page.locator('main')).toBeVisible();
  });

  test('diagram tabs are NOT visible on settings page', async ({ page }) => {
    await navigateToSettings(page);

    // DiagramTabs renders tab elements with role="tab". On the settings page,
    // the tabs should not be rendered (DiagramTabs only shows at pathname "/").
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(0);
  });

  test('diagram tabs ARE visible on editor page', async ({ page }) => {
    // We are on the editor page by default after project creation.
    // Wait for the editor to initialize.
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });

    // DiagramTabs should render at least one tab for the default diagram.
    const tabs = page.locator('[role="tab"]');
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
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

async function navigateToSettings(page: import('@playwright/test').Page) {
  const sidebar = page.getByRole('complementary');
  await expect(sidebar).toBeVisible({ timeout: 10_000 });
  await sidebar.getByRole('button', { name: /settings/i }).click();
  await expect(page.getByRole('heading', { name: /project settings/i })).toBeVisible({ timeout: 10_000 });
}
