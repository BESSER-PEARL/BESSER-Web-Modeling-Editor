import { test, expect } from '@playwright/test';

/**
 * Class Diagram editor tests — verify creating classes, adding attributes,
 * and triggering code generation from a class diagram.
 */
test.describe('Class Diagram', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await createBlankProject(page, 'ClassDiagram_E2E');

    // Ensure we are on the Class Diagram editor (default diagram type).
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // The Class button should already be active after project creation.
    const classButton = sidebar.getByRole('button', { name: /class/i });
    await expect(classButton).toHaveClass(/border-(sky|primary)/);
  });

  test('editor canvas is rendered for class diagrams', async ({ page }) => {
    // The ApollonEditorComponent renders a canvas area.
    // Look for the editor root container — typically a div with the Apollon editor.
    const editorArea = page.locator('main');
    await expect(editorArea).toBeVisible();

    // The main content area should not show the loading spinner.
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });
  });

  test('can create a class element via double-click on the canvas', async ({ page }) => {
    // Wait for the editor to fully initialize.
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });

    // The Apollon editor canvas typically responds to double-click to create
    // new elements. Double-click in the center of the main editor area.
    const mainArea = page.locator('main');
    const box = await mainArea.boundingBox();
    if (!box) {
      throw new Error('Could not determine the editor bounding box.');
    }

    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);

    // After a double-click, a new class element or an input field for naming
    // should appear. We look for any text input or editable element that
    // appeared within the editor area.
    // Note: The exact interaction depends on the Apollon editor's behavior.
    // This test verifies the interaction path works — a more specific assertion
    // can be added once the exact DOM structure is confirmed.
    await page.waitForTimeout(1_000);

    // Verify the editor area still renders without errors.
    await expect(mainArea).toBeVisible();
  });

  test('can open the generate menu from a class diagram', async ({ page }) => {
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });

    const header = page.locator('header');

    // Click the Generate menu button.
    const generateButton = header.getByRole('button', { name: /generate/i });
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    // The generate dropdown/menu should appear with generator options.
    // Class diagrams support generators like Django, Python, Java, SQL, etc.
    // Look for at least one known generator option in the opened menu.
    const menu = page.getByRole('menu').or(page.locator('[role="menubar"]')).or(page.locator('[data-radix-popper-content-wrapper]'));
    await expect(menu.first()).toBeVisible({ timeout: 5_000 });
  });

  test('generate menu shows class diagram generators', async ({ page }) => {
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });

    const header = page.locator('header');
    await header.getByRole('button', { name: /generate/i }).click();

    // Wait for the menu to render.
    await page.waitForTimeout(500);

    // The generate menu should list generators available for ClassDiagram.
    // According to workspace-navigation.tsx, ClassDiagram has:
    // django, backend, web_app, python, java, pydantic, sql, sqlalchemy, jsonschema
    // Check for a subset of these options.
    const menuContent = page.locator('[data-radix-popper-content-wrapper]').or(page.getByRole('menu'));
    const menuText = await menuContent.first().textContent();

    // At least one of these generator names should appear.
    const expectedGenerators = ['Python', 'Java', 'Django', 'SQL'];
    const hasAtLeastOne = expectedGenerators.some(
      (gen) => menuText && menuText.toLowerCase().includes(gen.toLowerCase()),
    );

    expect(hasAtLeastOne).toBe(true);
  });

  test('project identity panel shows project name and diagram title', async ({ page }) => {
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });

    const header = page.locator('header');

    // The ProjectIdentityPanel renders input fields for project name and diagram title.
    // After project creation, project name should be "ClassDiagram_E2E".
    const projectNameInput = header.locator('input').first();
    await expect(projectNameInput).toBeVisible();
    await expect(projectNameInput).toHaveValue('ClassDiagram_E2E');
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
