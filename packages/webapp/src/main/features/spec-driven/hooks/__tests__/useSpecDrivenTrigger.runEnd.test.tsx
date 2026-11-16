/**
 * What a run leaves behind: the request it was started with (from its start,
 * whatever its end), the project's last-run record (the base of the next
 * modify run) and, for a user who left the tab, a sign that it ended.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/main/app/store/store';
import { conversationStore } from '@/main/features/assistant';
import { useSpecDrivenTrigger } from '@/main/features/spec-driven/hooks/useSpecDrivenTrigger';
import { readProjectLastRun, writeProjectLastRun } from '@/main/features/spec-driven/storage';
import { readLastGeneration } from '@/main/features/spec-driven/lastGeneration';
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

/** Instructions as the assistant frames the user's request. */
const framed = (request: string) =>
  "## Assistant's notes (may be inaccurate)\n\nNotes.\n\n" +
  `## The user's original request, verbatim\n\nThis is the authority.\n\n${request}`;

const FRAMED = framed('Build a task board.');

describe('the request a run is started with', () => {
  it("is kept in the user's words from the run's start, before it ends", async () => {
    let atStart: unknown;
    await runWith(
      [
        start(),
        async () => {
          atStart = readLastGeneration(PROJECT_ID);
        },
        done(),
      ],
      FRAMED,
    );
    expect(atStart).toEqual({ request: 'Build a task board.' });
    expect(readLastGeneration(PROJECT_ID)).toMatchObject({ runId: RUN, request: 'Build a task board.' });
  });

  it('is kept when the run fails', async () => {
    const id = '7'.repeat(32);
    await runWith(
      [start(id), { event: 'error', code: 'UPSTREAM_LLM', message: 'Provider unavailable' } as SpecDrivenEvent],
      FRAMED,
      id,
    );
    expect(readLastGeneration(PROJECT_ID)).toEqual({ request: 'Build a task board.' });
  });

  it('is not replaced by a run started with words that describe nothing', async () => {
    const id = '8'.repeat(32);
    await runWith([start(id), done({}, id)], FRAMED, id);
    const again = '9'.repeat(32);
    await runWith([start(again), done({}, again)], 'regenerate with fixes.', again);
    expect(readLastGeneration(PROJECT_ID)).toMatchObject({ runId: again, request: 'Build a task board.' });
  });
});

describe('the last-run record of a finished run', () => {
  it('records the run as the base of the next one', async () => {
    await runWith([start(), done()], FRAMED);
    expect(readProjectLastRun(PROJECT_ID)?.runId).toBe(RUN);
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
  const LATE_STOP = '2a'.repeat(16);
  const REPLAYED = '3b'.repeat(16);
  const NOT_HONOURED = '4c'.repeat(16);
  const COMPLETE = '5d'.repeat(16);
  const STOPPED_REASON = 'The run was cancelled before the customization loop finished.';

  /** The server's answer to a stop request. */
  const answerStop = (status: 'cancelled' | 'not_found') =>
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status }), { status: 200 }))));

  beforeEach(() => {
    answerStop('cancelled');
    writeProjectLastRun(PROJECT_ID, PREVIOUS, 1_000);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not become the base of the next run, even when it ends with output', async () => {
    await runWith(
      [
        start(STOPPED),
        () => cancelSpecDrivenRun(STOPPED),
        done({ incomplete: true, incompleteReason: STOPPED_REASON }, STOPPED),
      ],
      framed('Build a task board with labels.'),
      STOPPED,
    );
    expect(readProjectLastRun(PROJECT_ID)).toEqual({ runId: PREVIOUS, at: 1_000 });
    expect(store.getState().specDriven.lastRunByProject[PROJECT_ID]?.runId).not.toBe(STOPPED);
    // Its request is still the best description of the application the editor has.
    expect(readLastGeneration(PROJECT_ID)).toMatchObject({ runId: PREVIOUS, request: 'Build a task board with labels.' });
  });

  it('is recorded and announced when it had already finished as Stop was clicked', async () => {
    answerStop('not_found');
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => 'hidden');
    document.title = 'BESSER';
    await runWith([start(LATE_STOP), () => cancelSpecDrivenRun(LATE_STOP), done({}, LATE_STOP)], FRAMED, LATE_STOP);
    expect(readProjectLastRun(PROJECT_ID)?.runId).toBe(LATE_STOP);
    expect(document.title).toBe('(Done) BESSER');
  });

  it('is recorded when it completes although the stop was accepted', async () => {
    await runWith([start(COMPLETE), () => cancelSpecDrivenRun(COMPLETE), done({}, COMPLETE)], FRAMED, COMPLETE);
    expect(readProjectLastRun(PROJECT_ID)?.runId).toBe(COMPLETE);
  });

  it('is told apart by the server even without a stop request from this tab (a replay after a reload)', async () => {
    await runWith(
      [start(REPLAYED), done({ incomplete: true, incompleteReason: STOPPED_REASON, cancelled: true }, REPLAYED)],
      FRAMED,
      REPLAYED,
    );
    expect(readProjectLastRun(PROJECT_ID)?.runId).toBe(PREVIOUS);
  });

  it("follows the server when it says the stop was not honoured", async () => {
    await runWith(
      [
        start(NOT_HONOURED),
        () => cancelSpecDrivenRun(NOT_HONOURED),
        done({ incomplete: true, incompleteReason: 'The run hit its cost cap.', cancelled: false }, NOT_HONOURED),
      ],
      FRAMED,
      NOT_HONOURED,
    );
    expect(readProjectLastRun(PROJECT_ID)?.runId).toBe(NOT_HONOURED);
  });

  it('a run that stopped on its own budget still becomes the base', async () => {
    await runWith(
      [start(BUDGET_STOP), done({ incomplete: true, incompleteReason: 'The run hit its cost cap.' }, BUDGET_STOP)],
      FRAMED,
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
    writeProjectLastRun(PROJECT_ID, '4'.repeat(32), Date.now() - 48 * 3_600_000);
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
