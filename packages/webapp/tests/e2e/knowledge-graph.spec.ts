import { test, expect, type Page } from '@playwright/test';

/**
 * Knowledge Graph diagram — the editor end to end: switching to it, dropping
 * nodes from the palette, drawing a relation, deleting with the keyboard,
 * undo, the settings page, HTML export, and the backend-dependent flows
 * (OWL import, RDF export) with the backend stubbed so no server is needed.
 */

const BACKEND = '**/besser_api';

const OWL_IMPORT_RESPONSE = {
  title: 'people',
  diagramType: 'KnowledgeGraphDiagram',
  model: {
    type: 'KnowledgeGraphDiagram',
    version: '1.0.0',
    nodes: [
      { id: 'person', nodeType: 'class', label: 'Person', iri: 'http://ex.org/onto#Person', position: { x: 200, y: 120 } },
      { id: 'alice', nodeType: 'individual', label: 'Alice', iri: 'http://ex.org/onto#alice', position: { x: 420, y: 120 } },
    ],
    edges: [{ id: 'e1', source: 'alice', target: 'person', label: 'type', iri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' }],
  },
};

test.describe('Knowledge Graph diagram', () => {
  const pageErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('besser_analytics_consent', JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }));
    });
    await page.reload();
    await createKnowledgeProject(page, 'KnowledgeGraph_E2E');
    await openKnowledgeGraph(page);
  });

  test.afterEach(() => {
    expect(pageErrors, 'uncaught errors in the page').toEqual([]);
  });

  test('switching to the Knowledge Graph shows its palette, toolbar and an empty canvas', async ({ page }) => {
    await expect(page.getByText('Node types')).toBeVisible();
    await expect(page.getByTestId('kg-canvas')).toBeVisible();
    await expect(counts(page)).toHaveText(/0 nodes · 0 relations/);
    await expect(page.getByRole('button', { name: 'Add relation' })).toBeVisible();
  });

  test('dropping node types from the palette creates nodes', async ({ page }) => {
    await dropNode(page, 'Class', { x: 200, y: 150 });
    await expect(counts(page)).toHaveText(/1 node · 0 relations/);

    await dropNode(page, 'Individual', { x: 450, y: 150 });
    await expect(counts(page)).toHaveText(/2 nodes · 0 relations/);
  });

  test('connects two nodes with "Add relation"', async ({ page }) => {
    await dropNode(page, 'Class', { x: 200, y: 150 });
    await dropNode(page, 'Individual', { x: 450, y: 150 });

    await page.getByRole('button', { name: 'Add relation' }).click();
    await dragOnCanvas(page, { x: 450, y: 150 }, { x: 200, y: 150 });

    await expect(counts(page)).toHaveText(/2 nodes · 1 relation/);
  });

  test('Delete asks first, and the confirm dialog can be answered with the keyboard', async ({ page }) => {
    await dropNode(page, 'Class', { x: 300, y: 200 });
    await page.getByTestId('kg-canvas').click({ position: { x: 300, y: 200 } });

    await page.keyboard.press('Delete');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Delete selection?')).toBeVisible();
    await expect(counts(page)).toHaveText(/1 node/); // nothing removed yet

    // Space on the dialog's own button must reach the button, not the canvas.
    const confirm = dialog.getByRole('button', { name: 'Delete', exact: true });
    await confirm.focus();
    await page.keyboard.press('Space');

    await expect(dialog).toBeHidden();
    await expect(counts(page)).toHaveText(/0 nodes/);
  });

  test('undo brings a deleted node back, and redo removes it again', async ({ page }) => {
    await dropNode(page, 'Class', { x: 300, y: 200 });
    await page.getByTestId('kg-canvas').click({ position: { x: 300, y: 200 } });
    await page.keyboard.press('Delete');
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(counts(page)).toHaveText(/0 nodes/);

    await page.getByRole('button', { name: /^Undo/ }).click();
    await expect(counts(page)).toHaveText(/1 node/);

    await page.getByRole('button', { name: /^Redo/ }).click();
    await expect(counts(page)).toHaveText(/0 nodes/);
  });

  test('Ctrl+Z undoes while the canvas has focus', async ({ page }) => {
    await dropNode(page, 'Class', { x: 300, y: 200 });
    await expect(counts(page)).toHaveText(/1 node/);

    await page.getByTestId('kg-canvas').click({ position: { x: 80, y: 60 } }); // empty spot: gives focus, selects nothing
    await page.keyboard.press('Control+z');

    await expect(counts(page)).toHaveText(/0 nodes/);
  });

  test('the sidebar offers the Knowledge Graph settings page', async ({ page }) => {
    const sidebar = page.getByRole('complementary');
    await sidebar.getByRole('button', { name: 'KG Settings' }).click();

    await expect(page.getByRole('heading', { name: 'Knowledge Graph Settings' })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'KG Settings' })).toHaveAttribute('aria-current', 'page');
  });

  test('exports a standalone HTML viewer with pinned, integrity-checked scripts', async ({ page }) => {
    await dropNode(page, 'Class', { x: 300, y: 200 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export HTML' }).click(),
    ]);
    const html = await readDownload(download);

    expect(download.suggestedFilename()).toMatch(/\.html$/);
    expect(html).toContain('<div id="cy">');
    expect(html.match(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/[^"]+" integrity="sha384-[^"]+" crossorigin="anonymous">/g)).toHaveLength(4);
  });

  test('imports an OWL file through the backend and shows its graph', async ({ page }) => {
    await page.route(`${BACKEND}/import-owl`, (route) => route.fulfill({ json: OWL_IMPORT_RESPONSE }));

    await page.getByRole('button', { name: 'File', exact: true }).click();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('menuitem', { name: 'Import KG (OWL)' }).click(),
    ]);
    await chooser.setFiles({ name: 'people.owl', mimeType: 'application/rdf+xml', buffer: Buffer.from('<rdf:RDF/>') });

    await expect(counts(page)).toHaveText(/2 nodes · 1 relation/);
  });

  test('shows the backend\'s explanation when the import is refused', async ({ page }) => {
    await page.route(`${BACKEND}/import-owl`, (route) =>
      route.fulfill({ status: 400, json: { detail: 'The file contains a DOCTYPE and was not imported.' } }),
    );

    await page.getByRole('button', { name: 'File', exact: true }).click();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('menuitem', { name: 'Import KG (OWL)' }).click(),
    ]);
    await chooser.setFiles({ name: 'bad.owl', mimeType: 'application/rdf+xml', buffer: Buffer.from('<!DOCTYPE x>') });

    await expect(page.getByText('The file contains a DOCTYPE and was not imported.').first()).toBeVisible();
    await expect(counts(page)).toHaveText(/0 nodes/);
  });

  test('the Export dialog offers RDF for a graph, not the UML image formats', async ({ page }) => {
    await dropNode(page, 'Class', { x: 300, y: 200 });
    await page.route(`${BACKEND}/export-kg-rdf/ttl`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/turtle',
        // As the real backend sends it: a cross-origin page can only read
        // Content-Disposition when the server lists it in Expose-Headers.
        headers: {
          'Content-Disposition': 'attachment; filename="people.ttl"',
          'Access-Control-Expose-Headers': 'Content-Disposition',
        },
        body: '@prefix : <http://ex.org/> .\n',
      }),
    );

    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.getByRole('menuitem', { name: /Export Project/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('kg-rdf-export')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Export as SVG' })).toHaveCount(0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByTestId('kg-rdf-export-button').click(),
    ]);

    expect(download.suggestedFilename()).toBe('people.ttl');
    await expect(dialog).toBeHidden();
  });

  test('switching the theme keeps the canvas working', async ({ page }) => {
    await dropNode(page, 'Class', { x: 300, y: 200 });

    await page.locator('header').first().getByRole('button', { name: /switch to (dark|light) mode/i }).click();
    await dropNode(page, 'Individual', { x: 500, y: 200 });

    await expect(counts(page)).toHaveText(/2 nodes/);
  });
});

// ── helpers ────────────────────────────────────────────────────────────────

const counts = (page: Page) => page.getByText(/\d+ nodes? · \d+ relations?/);

async function openKnowledgeGraph(page: Page) {
  const sidebar = page.getByRole('complementary');
  await expect(sidebar).toBeVisible({ timeout: 10_000 });
  await sidebar.getByRole('button', { name: 'KG', exact: true }).click();
  await expect(page.getByText('Node types')).toBeVisible({ timeout: 15_000 });
}

/** Drag a palette item onto the canvas; `at` is relative to the canvas. */
async function dropNode(page: Page, paletteLabel: string, at: { x: number; y: number }) {
  const item = page.locator('[draggable="true"]').filter({ hasText: paletteLabel }).first();
  await item.dragTo(page.getByTestId('kg-canvas'), { targetPosition: at });
}

/** Press on one canvas point and release on another, through the real mouse. */
async function dragOnCanvas(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const box = (await page.getByTestId('kg-canvas').boundingBox())!;
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + (from.x + to.x) / 2, box.y + (from.y + to.y) / 2, { steps: 8 });
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 });
  await page.mouse.up();
}

async function readDownload(download: import('@playwright/test').Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

/** First-run flow: pick the low-code interface, then the "Knowledge Engineer"
 *  perspective (class, object and knowledge-graph diagrams). */
async function createKnowledgeProject(page: Page, name: string) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  await dialog.getByRole('button', { name: /Model it/ }).click();
  await expect(dialog.getByText('Create a Project')).toBeVisible();

  const nameInput = dialog.getByLabel(/^name/i);
  await nameInput.clear();
  await nameInput.fill(name);
  await dialog.getByText('Knowledge Engineer', { exact: true }).click();

  await dialog.getByRole('button', { name: /create project/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}
