import { test, expect, type Page } from '@playwright/test';
import { createBlankProject, openFreshApp, workspaceSidebar } from './helpers/project';

/**
 * Class Diagram editor tests — verify creating classes, adding attributes,
 * and triggering code generation from a class diagram.
 */
test.describe('Class Diagram', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshApp(page);
    await createBlankProject(page, 'ClassDiagram_E2E');

    // Ensure we are on the Class Diagram editor (default diagram type).
    const sidebar = workspaceSidebar(page);
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // The Class button should already be active after project creation.
    const classButton = sidebar.getByRole('button', { name: /class/i });
    await expect(classButton).toHaveAttribute('aria-current', 'page');
  });

  test('editor canvas is rendered for class diagrams', async ({ page }) => {
    // The BesserEditorComponent renders a canvas area.
    // Look for the editor root container — typically a div with the BESSER WME editor.
    const editorArea = page.locator('main');
    await expect(editorArea).toBeVisible();

    // The main content area should not show the loading spinner.
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });
  });

  test('can create a class by dragging it from the palette onto the canvas', async ({ page }) => {
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });

    const palette = page.getByRole('complementary', { name: 'Element palette' });
    const classItem = palette.getByRole('button', { name: 'Class', exact: true }).first();
    const pane = page.locator('.react-flow__pane');
    const nodes = page.locator('.react-flow__node');
    await expect(classItem).toBeVisible();
    await expect(nodes).toHaveCount(0);

    const from = await classItem.boundingBox();
    const to = await pane.boundingBox();
    if (!from || !to) {
      throw new Error('Could not determine the palette / canvas bounding boxes.');
    }

    // The palette drag is pointer-driven (DraggableGhost), not HTML5 DnD.
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect(nodes).toHaveCount(1);
    await expect(nodes.first().getByText('Class1', { exact: true })).toBeVisible();

    // The new node reaches the stored project as a v4 React Flow node.
    await expect
      .poll(() => storedClassNodes(page), { timeout: 5_000 })
      .toEqual([expect.objectContaining({ type: 'class', name: 'Class1' })]);

    // ...and is rendered again from storage after a reload.
    await page.reload();
    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('.react-flow__node').getByText('Class1', { exact: true })).toBeVisible();
  });

  test('clicking a palette item inserts it on the canvas', async ({ page }) => {
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });

    const palette = page.getByRole('complementary', { name: 'Element palette' });
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(0);

    await palette.getByRole('button', { name: 'Class', exact: true }).first().click();
    await palette.getByRole('button', { name: 'Class', exact: true }).first().click();

    // Two inserts, numbered apart so they do not collide on name.
    await expect(nodes).toHaveCount(2);
    await expect(page.locator('.react-flow__node').getByText('Class1', { exact: true })).toBeVisible();
    await expect(page.locator('.react-flow__node').getByText('Class2', { exact: true })).toBeVisible();
  });

  test('can open the generate menu from a class diagram', async ({ page }) => {
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });

    const header = page.locator('header').first();

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

    const header = page.locator('header').first();
    await header.getByRole('button', { name: /generate/i }).click();

    // Wait for the menu to render.
    await page.waitForTimeout(500);

    // The generate menu should list generators available for ClassDiagram.
    // According to workspace-navigation.tsx, ClassDiagram has:
    // django, backend, web_app, python, java, pydantic, sql, sqlalchemy, jsonschema
    // Check for a subset of these options.
    const menuContent = page.locator('[data-radix-popper-content-wrapper]').or(page.getByRole('menu'));
    const menuText = await menuContent.first().textContent();

    // Generator menu shows category groups for ClassDiagram.
    const expectedGroups = ['Web', 'Database', 'OOP', 'Schema'];
    const hasAtLeastOne = expectedGroups.some(
      (group) => menuText && menuText.includes(group),
    );

    expect(hasAtLeastOne).toBe(true);
  });

  test('project identity panel shows project name and diagram title', async ({ page }) => {
    await expect(page.getByText('Switching diagram...')).toBeHidden({ timeout: 5_000 });

    const header = page.locator('header').first();

    // The ProjectIdentityPanel renders input fields for project name and diagram title.
    // After project creation, project name should be "ClassDiagram_E2E".
    const projectNameInput = header.locator('input').first();
    await expect(projectNameInput).toBeVisible();
    await expect(projectNameInput).toHaveValue('ClassDiagram_E2E');
  });
});

/** `{type, name}` of each node in the active project's first stored ClassDiagram. */
async function storedClassNodes(page: Page): Promise<{ type: string; name: unknown }[]> {
  return page.evaluate(() => {
    const id = localStorage.getItem('besser_latest_project');
    const raw = id ? localStorage.getItem(`besser_project_${id}`) : null;
    const nodes = raw ? JSON.parse(raw)?.diagrams?.ClassDiagram?.[0]?.model?.nodes : null;
    return Array.isArray(nodes) ? nodes.map((n: any) => ({ type: n.type, name: n.data?.name })) : [];
  });
}
