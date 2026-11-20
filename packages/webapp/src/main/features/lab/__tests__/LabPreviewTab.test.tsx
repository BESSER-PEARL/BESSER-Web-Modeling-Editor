import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/api-client';
import {
  getLabPreview,
  getLabPreviewLog,
  restartLabPreview,
  takeLabPreviewSlot,
  touchLabPreviewSlot,
  type LabPreviewService,
  type LabPreviewSlot,
  type LabPreviewView,
} from '../../../shared/api/lab';
import {
  LabPreviewTab,
  PREVIEW_FAST_POLL_MS,
  PREVIEW_IFRAME_SANDBOX,
  PREVIEW_SLOW_POLL_MS,
  PREVIEW_TOUCH_MS,
} from '../LabPreviewTab';

vi.mock('../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/lab')>()),
  getLabPreview: vi.fn(),
  takeLabPreviewSlot: vi.fn(),
  touchLabPreviewSlot: vi.fn(),
  restartLabPreview: vi.fn(),
  getLabPreviewLog: vi.fn(),
}));

const SESSION = 'gh-session-0123456789';
const CHANGE = { changeId: '0123456789ab', title: 'Note element', owner: 'ana' };
const PREVIEW_URL = 'https://preview.lab.example.org';
const NOW = Date.now() / 1000;

function service(name: LabPreviewService['name'], overrides: Partial<LabPreviewService> = {}): LabPreviewService {
  return { name, state: 'running', detail: '', startedAt: NOW - 120, logTail: [], ...overrides };
}

const RUNNING = [service('backend'), service('frontend'), service('modeling_agent')];

function slot(overrides: Partial<LabPreviewSlot> = {}): LabPreviewSlot {
  return {
    enabled: true,
    url: PREVIEW_URL,
    confined: true,
    detail: '',
    services: RUNNING,
    slot: 0,
    changeId: CHANGE.changeId,
    title: CHANGE.title,
    owner: CHANGE.owner,
    usedBy: 'ana',
    startedAt: NOW - 120,
    lastUsedAt: NOW,
    ...overrides,
  };
}

const view = (...slots: LabPreviewSlot[]): LabPreviewView => ({ enabled: true, detail: '', slots });

/** The slot before this change was taken: free. */
const FREE = slot({ changeId: null, title: null, owner: null, usedBy: null, startedAt: null, services: [] });

function serve(shown: LabPreviewSlot) {
  vi.mocked(getLabPreview).mockResolvedValueOnce(view(FREE)).mockResolvedValue(view(shown));
  vi.mocked(takeLabPreviewSlot).mockResolvedValue(shown);
}

const renderTab = (visible = true) =>
  render(<LabPreviewTab change={CHANGE} githubSession={SESSION} visible={visible} />);

/** Lets the pending API promises settle under fake timers. */
const flush = () => act(async () => {
  await vi.advanceTimersByTimeAsync(0);
});
const advance = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});

beforeEach(() => {
  vi.mocked(getLabPreview).mockReset();
  vi.mocked(takeLabPreviewSlot).mockReset();
  vi.mocked(touchLabPreviewSlot).mockReset().mockResolvedValue(undefined);
  vi.mocked(restartLabPreview).mockReset();
  vi.mocked(getLabPreviewLog).mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LabPreviewTab frame', () => {
  it("frames exactly the slot's URL, without the session and without top navigation", async () => {
    serve(slot());
    renderTab();
    const frame = await screen.findByTitle('Preview of Note element');
    expect(takeLabPreviewSlot).toHaveBeenCalledWith(SESSION, CHANGE.changeId);
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', PREVIEW_URL);
    expect(frame.getAttribute('src')).not.toContain(SESSION);
    expect(frame).toHaveAttribute('sandbox', PREVIEW_IFRAME_SANDBOX);
    expect(frame.getAttribute('sandbox')).not.toContain('allow-top-navigation');
    expect(PREVIEW_IFRAME_SANDBOX.split(' ').sort()).toEqual(
      ['allow-downloads', 'allow-forms', 'allow-modals', 'allow-popups', 'allow-same-origin', 'allow-scripts'],
    );

    const strip = screen.getByTestId('lab-preview-strip');
    expect(strip).toHaveTextContent('Slot 1 shows this change');
    expect(strip).toHaveTextContent('started 2 minutes ago');
    expect(strip).toHaveTextContent('backend running');
    expect(strip).toHaveTextContent('editor running');
    expect(strip).toHaveTextContent('modeling agent running');
    const open = within(strip).getByRole('link', { name: 'Open in a new tab' });
    expect(open).toHaveAttribute('href', PREVIEW_URL);
    expect(open).toHaveAttribute('target', '_blank');
    expect(open.getAttribute('rel')).toContain('noopener');
  });

  it('links to an http: preview instead of framing it, and says why', async () => {
    const url = 'http://localhost:8180';
    serve(slot({ url }));
    renderTab();
    const link = await screen.findByRole('link', { name: 'Open the preview' });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByTitle('Preview of Note element')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByTestId('lab-preview-http')).toHaveTextContent(
      'This editor can frame only https: pages, so the preview opens in a new tab.',
    );
  });

  it("always warns that the preview runs the change's unreviewed code", async () => {
    serve(slot());
    renderTab();
    await screen.findByTitle('Preview of Note element');
    expect(screen.getByTestId('lab-preview-warning')).toHaveTextContent(
      "The preview runs this change's code, which nobody has reviewed. Do not enter your own API keys or passwords in it.",
    );
  });

  it('says when the preview runs without the sandbox', async () => {
    serve(slot({ confined: false, detail: 'On this machine the preview runs without the sandbox.' }));
    renderTab();
    expect(await screen.findByTestId('lab-preview-unconfined')).toHaveTextContent(
      'On this machine the preview runs without the sandbox.',
    );
  });

  it('does not say so when the preview is confined', async () => {
    serve(slot());
    renderTab();
    await screen.findByTitle('Preview of Note element');
    expect(screen.queryByTestId('lab-preview-unconfined')).toBeNull();
  });
});

describe('LabPreviewTab services', () => {
  it('shows a failed service with its log tail, and Restart restarts that service of the slot', async () => {
    const failed = slot({
      slot: 1,
      services: [
        service('backend', { state: 'failed', detail: 'exited with code 3', logTail: ['Traceback (most recent call last):', 'ImportError: no module x'] }),
        service('frontend'),
        service('modeling_agent'),
      ],
    });
    serve(failed);
    vi.mocked(restartLabPreview).mockResolvedValue(view(slot({ slot: 1 })));
    renderTab();
    const card = await screen.findByTestId('lab-preview-failed-backend');
    expect(card).toHaveTextContent('The backend failed: exited with code 3');
    expect(card).toHaveTextContent('ImportError: no module x');
    expect(screen.getByTestId('lab-preview-strip')).toHaveTextContent('backend failed');

    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Restart the backend' }));
    });
    expect(restartLabPreview).toHaveBeenCalledWith(SESSION, 1, 'backend');
    expect(screen.queryByTestId('lab-preview-failed-backend')).toBeNull();
  });

  it('restarts every service from the Restart menu', async () => {
    serve(slot());
    vi.mocked(restartLabPreview).mockResolvedValue(view(slot()));
    renderTab();
    await screen.findByTitle('Preview of Note element');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Restart' }), { key: 'ArrowDown' });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Restart all' }));
    });
    expect(restartLabPreview).toHaveBeenCalledWith(SESSION, 0);
  });

  it("shows the last 200 lines of a service's log", async () => {
    serve(slot());
    vi.mocked(getLabPreviewLog).mockResolvedValue({ slot: 0, service: 'frontend', lines: ['VITE v7 ready', '  ➜  Local: http://localhost:8180/'], truncated: true });
    renderTab();
    await screen.findByTitle('Preview of Note element');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Show log' }), { key: 'ArrowDown' });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'editor' }));
    });
    expect(getLabPreviewLog).toHaveBeenCalledWith(SESSION, 0, 'frontend', 200);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading')).toHaveTextContent('Log of the editor');
    expect(within(dialog).getByTestId('lab-preview-log')).toHaveTextContent('VITE v7 ready');
    expect(dialog).toHaveTextContent('Only the last 200 lines are shown.');
  });

  it("says why a service was not started, such as the assistant", async () => {
    const reason = 'The assistant is not available in this preview: this modeling agent cannot take its port from the environment.';
    serve(slot({ services: [service('backend'), service('frontend'), service('modeling_agent', { state: 'stopped', detail: reason })] }));
    renderTab();
    expect(await screen.findByTestId('lab-preview-stopped-modeling_agent')).toHaveTextContent(reason);
    expect(screen.getByTestId('lab-preview-strip')).toHaveTextContent('modeling agent stopped');
  });

  it("says the change's environment is being prepared, with the step", async () => {
    const step = 'Preparing the editor environment';
    serve(slot({ detail: step, services: RUNNING.map((s) => ({ ...s, state: 'starting' as const, detail: step, startedAt: null })) }));
    renderTab();
    const preparing = await screen.findByTestId('lab-preview-preparing');
    expect(preparing).toHaveTextContent("Preparing this change's environment (first time only)...");
    expect(preparing).toHaveTextContent(step);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('says the environment is being prepared when the slot runs without its modeling agent', async () => {
    // preview.py _render with agent_off: the agent entry is 'stopped' with its reason while the others start.
    const step = 'Preparing the editor environment';
    const reason = 'The assistant is not available in this preview: no port from the environment.';
    const starting = { state: 'starting' as const, detail: step, startedAt: null };
    serve(slot({ detail: step, services: [service('backend', starting), service('frontend', starting),
      service('modeling_agent', { state: 'stopped', detail: reason })] }));
    renderTab();
    expect(await screen.findByTestId('lab-preview-preparing')).toHaveTextContent(step);
  });
});

describe('LabPreviewTab slot states', () => {
  it("names the change another slot user shows, and takes the slot back on request", async () => {
    const other = slot({ changeId: 'aaaaaaaaaaaa', title: 'Glossary generator', owner: 'jordi', usedBy: 'jordi' });
    vi.mocked(getLabPreview).mockResolvedValueOnce(view(FREE)).mockResolvedValue(view(other));
    vi.mocked(takeLabPreviewSlot).mockResolvedValueOnce(other).mockResolvedValueOnce(slot());
    renderTab();
    const notice = await screen.findByTestId('lab-preview-other');
    expect(notice).toHaveTextContent('Slot 1 shows Glossary generator (@jordi).');
    expect(document.querySelector('iframe')).toBeNull();

    await act(async () => {
      fireEvent.click(within(notice).getByRole('button', { name: 'Try this change' }));
    });
    expect(takeLabPreviewSlot).toHaveBeenCalledTimes(2);
    expect(await screen.findByTitle('Preview of Note element')).toHaveAttribute('src', PREVIEW_URL);
  });

  it("shows the server's message when every slot is in use, and tries again on request", async () => {
    const message =
      'Every preview slot is in use: slot 1 shows "Glossary generator" (@jordi), last used by @jordi 2 min ago. A slot nobody has used for 10 minutes can be taken.';
    vi.mocked(getLabPreview).mockResolvedValue(view(FREE));
    vi.mocked(takeLabPreviewSlot)
      .mockRejectedValueOnce(new ApiError(409, message, message, { code: 'preview_full', message }))
      .mockResolvedValueOnce(slot());
    renderTab();
    const full = await screen.findByTestId('lab-preview-refused');
    expect(full).toHaveTextContent(message);

    await act(async () => {
      fireEvent.click(within(full).getByRole('button', { name: 'Try again' }));
    });
    expect(await screen.findByTitle('Preview of Note element')).toBeInTheDocument();
    expect(takeLabPreviewSlot).toHaveBeenCalledTimes(2);
  });

  it('says the preview is off, with the reason, and takes no slot', async () => {
    vi.mocked(getLabPreview).mockResolvedValue({ enabled: false, detail: 'BESSER_LAB_PREVIEW_BIND is not an IP address.', slots: [] });
    renderTab();
    const off = await screen.findByTestId('lab-preview-off');
    expect(off).toHaveTextContent('The preview is switched off on this lab.');
    expect(off).toHaveTextContent('BESSER_LAB_PREVIEW_BIND is not an IP address.');
    expect(takeLabPreviewSlot).not.toHaveBeenCalled();
    expect(screen.getByTestId('lab-preview-warning')).toBeInTheDocument();
  });

  it('takes no slot while hidden', async () => {
    serve(slot());
    renderTab(false);
    await act(async () => undefined);
    expect(getLabPreview).not.toHaveBeenCalled();
    expect(takeLabPreviewSlot).not.toHaveBeenCalled();
  });
});

describe('LabPreviewTab polling', () => {
  it('reads the preview every 3 s while a service starts, else every 15 s, never while hidden, and stops on unmount', async () => {
    vi.useFakeTimers();
    const starting = slot({ services: [service('backend'), service('frontend', { state: 'starting' }), service('modeling_agent')] });
    vi.mocked(takeLabPreviewSlot).mockResolvedValue(starting);
    vi.mocked(getLabPreview)
      .mockResolvedValueOnce(view(FREE)) // before taking the slot
      .mockResolvedValueOnce(view(starting))
      .mockResolvedValue(view(slot()));
    const { rerender, unmount } = renderTab();
    await flush();
    expect(getLabPreview).toHaveBeenCalledTimes(1);

    await advance(PREVIEW_FAST_POLL_MS - 1);
    expect(getLabPreview).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(getLabPreview).toHaveBeenCalledTimes(2); // still starting
    await advance(PREVIEW_FAST_POLL_MS);
    expect(getLabPreview).toHaveBeenCalledTimes(3); // now running
    await advance(PREVIEW_FAST_POLL_MS);
    expect(getLabPreview).toHaveBeenCalledTimes(3);
    await advance(PREVIEW_SLOW_POLL_MS - PREVIEW_FAST_POLL_MS);
    expect(getLabPreview).toHaveBeenCalledTimes(4);

    rerender(<LabPreviewTab change={CHANGE} githubSession={SESSION} visible={false} />);
    await advance(PREVIEW_SLOW_POLL_MS * 4);
    expect(getLabPreview).toHaveBeenCalledTimes(4);

    rerender(<LabPreviewTab change={CHANGE} githubSession={SESSION} visible />);
    await flush();
    expect(getLabPreview).toHaveBeenCalledTimes(5); // shown again: read at once
    expect(takeLabPreviewSlot).toHaveBeenCalledTimes(1);

    unmount();
    await advance(PREVIEW_SLOW_POLL_MS * 4);
    expect(getLabPreview).toHaveBeenCalledTimes(5);
  });

  it('polls every 3 s while the slot is being prepared', async () => {
    vi.useFakeTimers();
    const step = 'Preparing the BESSER environment';
    const preparing = slot({ detail: step, services: RUNNING.map((s) => ({ ...s, state: 'starting' as const, detail: step })) });
    vi.mocked(takeLabPreviewSlot).mockResolvedValue(preparing);
    vi.mocked(getLabPreview).mockResolvedValue(view(preparing));
    renderTab();
    await flush();
    // One advance per read: React schedules the next read when it renders the last one, at the end of each act.
    for (let read = 0; read < 3; read += 1) await advance(PREVIEW_FAST_POLL_MS);
    expect(getLabPreview).toHaveBeenCalledTimes(4);
  });

  it('touches its slot every 60 s while visible, not while hidden, and not after unmount', async () => {
    vi.useFakeTimers();
    vi.mocked(takeLabPreviewSlot).mockResolvedValue(slot({ slot: 1 }));
    vi.mocked(getLabPreview).mockResolvedValue(view(slot({ slot: 1 })));
    const { rerender, unmount } = renderTab();
    await flush();
    expect(touchLabPreviewSlot).not.toHaveBeenCalled();

    await advance(PREVIEW_TOUCH_MS);
    expect(touchLabPreviewSlot).toHaveBeenCalledTimes(1);
    expect(touchLabPreviewSlot).toHaveBeenCalledWith(SESSION, 1);
    await advance(PREVIEW_TOUCH_MS);
    expect(touchLabPreviewSlot).toHaveBeenCalledTimes(2);

    rerender(<LabPreviewTab change={CHANGE} githubSession={SESSION} visible={false} />);
    await advance(PREVIEW_TOUCH_MS * 3);
    expect(touchLabPreviewSlot).toHaveBeenCalledTimes(2);

    rerender(<LabPreviewTab change={CHANGE} githubSession={SESSION} visible />);
    await advance(PREVIEW_TOUCH_MS);
    expect(touchLabPreviewSlot).toHaveBeenCalledTimes(3);

    unmount();
    await advance(PREVIEW_TOUCH_MS * 3);
    expect(touchLabPreviewSlot).toHaveBeenCalledTimes(3);
  });

  it('does not touch a slot that shows another change', async () => {
    vi.useFakeTimers();
    const other = slot({ changeId: 'aaaaaaaaaaaa', title: 'Glossary generator', owner: 'jordi' });
    vi.mocked(takeLabPreviewSlot).mockResolvedValue(slot());
    vi.mocked(getLabPreview).mockResolvedValueOnce(view(FREE)).mockResolvedValue(view(other));
    renderTab();
    await flush();
    await advance(PREVIEW_SLOW_POLL_MS); // the read that finds the other change
    await advance(PREVIEW_TOUCH_MS);
    expect(touchLabPreviewSlot).not.toHaveBeenCalled();
  });
});
