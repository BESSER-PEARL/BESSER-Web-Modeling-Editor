import { test, expect, type Page } from '@playwright/test';

/**
 * Regression: the Agent Customization page must never be scrolled out of place.
 *
 * Two things used to make an `overflow: hidden` box scrollable by focus (a click on a card,
 * a dropdown opening): the closed assistant drawer parked below the shell by a transform, and the
 * hidden native <select> of every Radix Select, which sat outside the long page's scroller. The
 * page then shifted up, hiding its header and leaving a blank band over the bottom third.
 */

async function createBlankProject(page: Page, name: string) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByText('Start modelling').click();
  const nameInput = dialog.getByLabel(/name/i);
  await nameInput.clear();
  await nameInput.fill(name);
  await dialog.getByRole('button', { name: /create project/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

/** Scrolled elements that are not meant to scroll (everything but real overflow:auto/scroll areas). */
const misplacedScrolls = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        const overflowY = getComputedStyle(el).overflowY;
        return el.scrollTop > 0 && (overflowY === 'hidden' || overflowY === 'clip');
      })
      .map((el) => `${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').slice(0, 60)} scrollTop=${Math.round(el.scrollTop)}`),
  );

test('opening a dropdown after using the assistant does not push the page out of place', async ({ context, page }) => {
  await context.routeWebSocket(/localhost:8765/, () => {});
  await page.goto('/');
  await createBlankProject(page, 'Layout');
  const decline = page.getByRole('button', { name: 'Decline' });
  if (await decline.isVisible().catch(() => false)) await decline.click();

  // use the assistant drawer, then close it again
  await page.getByRole('button', { name: 'Pull up to open assistant' }).click();
  const prompt = page.getByRole('textbox', { name: 'Write your prompt here' }).filter({ visible: true });
  await prompt.fill('hello');
  await prompt.press('Enter');
  await page.getByRole('button', { name: 'Push down to close assistant' }).click();
  await expect(page.getByRole('button', { name: 'Pull up to open assistant' })).toBeVisible();

  // client-side navigation, so the shell (and the parked drawer) stay mounted
  await page.evaluate(() => {
    window.history.pushState({}, '', '/agent-config');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.getByText('Personalization', { exact: true }).first().click();

  // real mouse clicks: Playwright's own click() scrolls ancestors into view and would hide the bug
  await page.evaluate(() => {
    const scroller = document.querySelector('div.overflow-auto.pt-6') as HTMLElement;
    const card = Array.from(scroller.querySelectorAll('button')).find((b) => (b.textContent || '').trim().startsWith('Presentation')) as HTMLElement;
    scroller.scrollTop = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 10;
  });
  const card = await page.locator('main button', { hasText: 'Presentation' }).first().boundingBox();
  await page.mouse.click(card!.x + 40, card!.y + 20);
  await expect(page.locator('#agent-style')).toBeVisible();

  const style = await page.locator('#agent-style').boundingBox();
  await page.mouse.click(style!.x + style!.width / 2, style!.y + style!.height / 2);
  await expect(page.locator('#agent-style')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');

  expect(await misplacedScrolls(page)).toEqual([]);
  // and the page header is still where it belongs
  await expect(page.getByRole('heading', { name: 'Agent Customization' })).toBeInViewport();
});
