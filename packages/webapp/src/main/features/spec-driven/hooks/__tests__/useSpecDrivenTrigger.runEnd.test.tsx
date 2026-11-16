/**
 * What the end of a run leaves behind: the project's last-run record (the base
 * of the next modify run, with the request it was started with) and, for a
 * user who left the tab, a sign that it ended.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/main/app/store/store';
import { conversationStore } from '@/main/features/assistant';
import { useSpecDrivenTrigger } from '@/main/features/spec-driven/hooks/useSpecDrivenTrigger';
import { readProjectLastRun, writeProjectLastRun } from '@/main/features/spec-driven/storage';
import { cancelSpecDrivenRun } from '@/main/shared/api/specDriven';
import type { SpecDrivenEvent, TriggerSpecDrivenPayload } from '@/main/features/spec-driven/types';
import * as sseClient from '@/main/features/spec-driven/services/specDrivenSseClient';
import { sessionStorageLlmApiKey, sessionStorageLlmProvider } from '@/main/shared/constants/constant';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/main/features/spec-driven/services/specDrivenSseClient', () => ({
  followSpecDrivenRun: vi.fn(() => ({
    controller: new AbortController(),
    abort: vi.fn(),
    events: (async function* () {})(),
  })),
  startSpecDrivenRun: vi.fn(),
}));

vi.mock('@/main/shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return { ...mod, getSpecDrivenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)) };
});

const PROJECT_ID = 'proj-run-record';
const RUN = 'd'.repeat(32);

type TriggerFn = (p: TriggerSpecDrivenPayload) => Promise<void>;

function Surface({ apiRef }: { apiRef: { current: TriggerFn | null } }) {
  const [, setIsGenerating] = React.useState(false);
  const currentProjectRef = React.useRef<any>({
    id: PROJECT_ID,
    name: 'P',
    diagrams: { ClassDiagram: [{ id: 'cd1', title: 'd', model: {} }] },
    currentDiagramIndices: { ClassDiagram: 0 },
  });
  apiRef.current = useSpecDrivenTrigger({
    currentProjectRef,
    setMessages: conversationStore.setMessages,
    setIsGenerating,
  }).handleTrigger;
  return null;
}

type Step = SpecDrivenEvent | (() => Promise<unknown>);

/** Start run `runId` whose stream yields `steps` (a function runs in between), and wait until it has ended. */
async function runWith(steps: Step[], instructions: string, runId: string = RUN) {
  vi.mocked(sseClient.startSpecDrivenRun).mockImplementation((params) => {
    params.onRunAccepted?.(runId);
    return {
      controller: new AbortController(),
      abort: () => {},
      events: (async function* () {
        for (const step of steps) {
          if (typeof step === 'function') await step();
          else yield step;
        }
      })(),
    } as ReturnType<typeof sseClient.startSpecDrivenRun>;
  });
  const api: { current: TriggerFn | null } = { current: null };
  render(
    <Provider store={store}>
      <Surface apiRef={api} />
    </Provider>,
  );
  await act(async () => {
    await api.current!({ action: 'trigger_smart_generator', instructions, planApproved: true });
  });
  await waitFor(() => expect(store.getState().specDriven.runStatus).toBe('idle'));
}

const start = (runId: string = RUN) => ({ event: 'start', runId, provider: 'anthropic' }) as SpecDrivenEvent;

const done = (overrides: Partial<Extract<SpecDrivenEvent, { event: 'done' }>> = {}, runId: string = RUN): SpecDrivenEvent => ({
  event: 'done',
  runId,
  downloadUrl: `/spec-driven/download/${runId}`,
  fileName: 'app.zip',
  isZip: true,
  ...overrides,
} as SpecDrivenEvent);

beforeEach(() => {
  vi.clearAllMocks();
  conversationStore.clear();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.sessionStorage.setItem(sessionStorageLlmApiKey, 'sk-test');
  window.sessionStorage.setItem(sessionStorageLlmProvider, 'anthropic');
});

afterEach(() => {
  cleanup();
});

describe('the last-run record of a finished run', () => {
  it("keeps the user's request without the assistant's notes", async () => {
    await runWith(
      [start(), done()],
      "## Assistant's notes (may be inaccurate)\n\nNotes.\n\n## The user's original request, verbatim\n\nBuild a task board.",
    );
    const record = readProjectLastRun(PROJECT_ID);
    expect(record?.runId).toBe(RUN);
    expect(record?.request).toBe("## The user's original request, verbatim\n\nBuild a task board.");
  });

  it('stamps the finished card with the time the record holds, for its download lifetime', async () => {
    await runWith([start(), done()], 'Build a task board.');
    const card = conversationStore.getMessages().find((m) => m.specDriven)?.specDriven;
    expect(card?.status).toBe('done');
    expect(card?.finishedAt).toBe(readProjectLastRun(PROJECT_ID)?.at);
  });
});

describe('a run the user stopped', () => {
  const PREVIOUS = 'e'.repeat(32);
  const STOPPED = 'f'.repeat(32);
  const BUDGET_STOP = '1'.repeat(32);

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true } as Response)));
    writeProjectLastRun(PROJECT_ID, PREVIOUS, 1_000, 'Build a task board.');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not become the base of the next run, even when it ends with output', async () => {
    await runWith(
      [
        start(STOPPED),
        () => cancelSpecDrivenRun(STOPPED),
        done({ incomplete: true, incompleteReason: 'The run was cancelled before the customization loop finished.' }, STOPPED),
      ],
      'Build a task board.',
      STOPPED,
    );
    expect(readProjectLastRun(PROJECT_ID)).toEqual({ runId: PREVIOUS, at: 1_000, request: 'Build a task board.' });
    expect(store.getState().specDriven.lastRunByProject[PROJECT_ID]?.runId).not.toBe(STOPPED);
  });

  it('a run that stopped on its own budget still becomes the base', async () => {
    await runWith(
      [start(BUDGET_STOP), done({ incomplete: true, incompleteReason: 'The run hit its cost cap.' }, BUDGET_STOP)],
      'Build a task board.',
      BUDGET_STOP,
    );
    expect(readProjectLastRun(PROJECT_ID)?.runId).toBe(BUDGET_STOP);
  });
});

describe('the end of a run, seen from a hidden tab', () => {
  let visibility: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    document.title = 'BESSER';
  });

  afterEach(() => {
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    vi.restoreAllMocks();
  });

  it('marks the tab title when a run finishes while the user is away', async () => {
    const id = '2'.repeat(32);
    await runWith(
      [
        start(id),
        async () => {
          visibility = 'hidden';
        },
        done({}, id),
      ],
      'Build a task board.',
      id,
    );
    expect(document.title).toBe('(Done) BESSER');
  });

  it('marks a failed run too', async () => {
    const id = '3'.repeat(32);
    await runWith(
      [
        start(id),
        async () => {
          visibility = 'hidden';
        },
        { event: 'error', code: 'UPSTREAM_LLM', message: 'Provider unavailable' } as SpecDrivenEvent,
      ],
      'Build a task board.',
      id,
    );
    expect(document.title).toBe('(Failed) BESSER');
  });
});

describe('a run whose previous result expired', () => {
  const notices = () =>
    conversationStore.getMessages().find((m) => m.specDriven)?.specDriven?.warnings ?? [];

  it('says on its card that the app is rebuilt, not edited in place', async () => {
    writeProjectLastRun(PROJECT_ID, '4'.repeat(32), Date.now() - 48 * 3_600_000, 'Build a task board.');
    const id = '5'.repeat(32);
    await runWith([start(id), done({}, id)], 'Build a task board.', id);

    expect(vi.mocked(sseClient.startSpecDrivenRun).mock.calls[0][0].mode).toBe('generate');
    expect(notices()).toEqual([
      {
        code: 'BASE_EXPIRED',
        severity: 'info',
        message:
          'The previous run can no longer be edited in place, so the application is rebuilt from the model and the original request.',
      },
    ]);
  });

  it('says nothing on a first run', async () => {
    const id = '6'.repeat(32);
    await runWith([start(id), done({}, id)], 'Build a task board.', id);
    expect(notices()).toEqual([]);
  });
});
