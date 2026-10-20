import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared Playwright helpers for the project hub.
 *
 * The create-project form sits behind the low-code / agentic chooser, which is
 * reached from whichever hub surface is showing:
 *   - first run (no saved project): the "Model it / Describe it" chooser;
 *   - a returning visit (hub reopened from the header logo, or saved projects
 *     but none open): the start screen, whose "New Project" card opens the
 *     same chooser;
 *   - the chooser's "More options" link leads to that start screen;
 *   - a remembered chooser choice skips straight to the form.
 * Keep the flow here so a UI change is fixed once, not in every spec.
 */

const ANALYTICS_CONSENT = JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() });

/** Load the app with empty storage and analytics declined, so the first-run hub shows. */
export async function openFreshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((consent) => {
    localStorage.clear();
    localStorage.setItem('besser_analytics_consent', consent);
  }, ANALYTICS_CONSENT);
  await page.reload();
}

/** The project hub dialog. */
export function projectHub(page: Page): Locator {
  return page.getByRole('dialog');
}

/** The first-run chooser's heading ("How do you want to build?"). */
export function chooserHeading(page: Page): Locator {
  return projectHub(page).getByRole('heading', { name: /how do you want to build/i });
}

/**
 * From whichever hub surface is showing, reach the create-project form via
 * "Model it" (the low-code path) and return the dialog.
 */
export async function openCreateProjectForm(page: Page): Promise<Locator> {
  const dialog = projectHub(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  const newProjectCard = dialog.getByTestId('hub-start-new');
  const modelIt = dialog.getByRole('button', { name: /model it/i });
  const nameInput = dialog.locator('#project-name');
  // The chooser, the start screen, or — with a remembered "Model it / Describe
  // it" choice — the form itself is up; wait for one of them.
  await expect(newProjectCard.or(modelIt).or(nameInput)).toBeVisible({ timeout: 15_000 });
  if (await nameInput.isVisible()) {
    return dialog;
  }
  if (await newProjectCard.isVisible()) {
    await newProjectCard.click();
  }
  await modelIt.click();

  await expect(nameInput).toBeVisible();
  return dialog;
}

/** Create a low-code project named `name` and wait for the hub to close. */
export async function createBlankProject(page: Page, name: string): Promise<void> {
  const dialog = await openCreateProjectForm(page);

  const nameInput = dialog.locator('#project-name');
  await nameInput.fill(name);

  await dialog.getByRole('button', { name: /create project/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

/**
 * The workspace sidebar (diagram-type editors + Settings). Addressed by its
 * label: the editor's element palette is a second `complementary` landmark.
 */
export function workspaceSidebar(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Workspace', exact: true });
}

/** Open Project Settings from the sidebar. */
export async function navigateToSettings(page: Page): Promise<void> {
  const sidebar = workspaceSidebar(page);
  await expect(sidebar).toBeVisible({ timeout: 10_000 });
  await sidebar.getByRole('button', { name: /settings/i }).click();
  await expect(page.getByRole('heading', { name: /project settings/i })).toBeVisible({ timeout: 10_000 });
}
