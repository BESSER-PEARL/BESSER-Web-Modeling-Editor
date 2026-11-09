import { test, expect, type Page } from '@playwright/test';

/**
 * The assistant conversation belongs to the project: two windows of one
 * browser (one context, so one localStorage and real `storage` events) show
 * and continue the same dialogue. The modeling agent is a stand-in socket that
 * answers "Noted: <message>" and records what each window sent.
 */

interface SentTurn {
  sessionId: string;
  message: string;
  recentHistory: string[];
}

async function createBlankProject(page: Page, name: string) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  // First run: the "How do you want to start?" landing leads to the create form.
  await dialog.getByText('Start modelling').click();
  const nameInput = dialog.getByLabel(/name/i);
  await nameInput.clear();
  await nameInput.fill(name);
  await dialog.getByRole('button', { name: /create project/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

async function openAssistant(page: Page) {
  await page.getByRole('button', { name: 'Open assistant', exact: true }).click();
  await expect(shown(page, 'Connected')).toBeVisible({ timeout: 15_000 });
}

/** The widget and the drawer both render the chat; only one is on screen. */
const shown = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();

async function send(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'Write your prompt here' }).filter({ visible: true });
  await input.fill(text);
  await input.press('Enter');
}

test('two windows on one project continue the same assistant conversation', async ({ context }) => {
  const sent: SentTurn[] = [];
  await context.routeWebSocket(/localhost:8765/, (ws) => {
    ws.onMessage((raw) => {
      let payload: Record<string, unknown>;
      try {
        const frame = JSON.parse(String(raw)) as { message?: unknown };
        payload = typeof frame.message === 'string' ? JSON.parse(frame.message) : {};
      } catch {
        return;
      }
      if (payload.action !== 'user_message') return;
      const history = Array.isArray(payload.recentHistory) ? payload.recentHistory : [];
      sent.push({
        sessionId: String(payload.sessionId),
        message: String(payload.message),
        recentHistory: history.map((turn: { content?: string }) => String(turn.content)),
      });
      ws.send(
        JSON.stringify({
          action: 'assistant_message',
          message: `Noted: ${payload.message}`,
          turnId: payload.turnId,
          replySeq: 1,
        }),
      );
    });
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      'besser_analytics_consent',
      JSON.stringify({ status: 'declined', version: '1.2', timestamp: Date.now() }),
    );
  });

  const first = await context.newPage();
  await first.goto('/');
  await createBlankProject(first, 'Library');
  await openAssistant(first);
  await send(first, 'A library app with books and loans');
  await expect(shown(first, 'Noted: A library app with books and loans')).toBeVisible();

  // A second window on the same project shows the conversation so far.
  const second = await context.newPage();
  await second.goto('/');
  await openAssistant(second);
  await expect(shown(second, 'Noted: A library app with books and loans')).toBeVisible();

  // A turn in the first window appears in the second without a reload.
  await first.waitForTimeout(1_200); // the assistant's rate limiter
  await send(first, 'Add a Member class');
  await expect(shown(second, 'Noted: Add a Member class')).toBeVisible();

  // The second window's next message reaches the agent in a new session that
  // carries the whole conversation, the first window's turns included.
  await send(second, 'Give Member a name');
  await expect(shown(first, 'Noted: Give Member a name')).toBeVisible();
  const fromFirst = sent.find((turn) => turn.message === 'Add a Member class')!;
  const fromSecond = sent.find((turn) => turn.message === 'Give Member a name')!;
  expect(fromSecond.sessionId).not.toBe(fromFirst.sessionId);
  expect(fromSecond.recentHistory).toEqual([
    'A library app with books and loans',
    'Noted: A library app with books and loans',
    'Add a Member class',
    'Noted: Add a Member class',
  ]);
});
