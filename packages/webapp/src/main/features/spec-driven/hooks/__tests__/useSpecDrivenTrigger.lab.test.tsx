/**
 * A BESSER Lab run in the chat: the same run slot, live card, event loop and
 * reattach after a reload as a Spec-Driven run, without the key dialog, the
 * run-mode decision, the "Generated N files" line and the report to the
 * modeling agent. Its `done` hands the `lab` payload to the lab feature.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/main/app/store/store';
import { conversationStore } from '@/main/features/assistant';
import {
  useSpecDrivenTrigger,
  type UseSpecDrivenTriggerReturn,
} from '@/main/features/spec-driven/hooks/useSpecDrivenTrigger';
import { readActiveSpecDrivenRun, writeActiveSpecDrivenRun } from '@/main/features/spec-driven/storage';
import type { SpecDrivenEvent } from '@/main/features/spec-driven/types';
import * as sseClient from '@/main/features/spec-driven/services/specDrivenSseClient';
import { getLabState, startLabRun, type LabDone } from '@/main/shared/api/lab';
import { SseHttpError } from '@/main/shared/api/sseClient';
import i18n from '@/main/shared/i18n';
import { cancelSpecDrivenRun } from '@/main/shared/api/specDriven';
import { reportError } from '@/main/shared/services/errors/reportError';
import { resetGitHubAuthForTests, signInToGitHubForTests } from '@/main/shared/services/github/githubAuth';
import { sessionStorageLlmApiKey, sessionStorageLlmProvider } from '@/main/shared/constants/constant';
import type { BesserProject } from '@/main/shared/types/project';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/main/shared/api/lab', () => ({ startLabRun: vi.fn(), getLabState: vi.fn(async () => ({ run: null })) }));

vi.mock('@/main/shared/api/specDriven', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/main/shared/api/specDriven')>()),
  cancelSpecDrivenRun: vi.fn(),
}));

vi.mock('@/main/shared/services/errors/reportError', () => ({ reportError: vi.fn(), notifyError: vi.fn() }));

vi.mock('@/main/features/spec-driven/services/specDrivenSseClient', () => ({
  followSpecDrivenRun: vi.fn(),
  startSpecDrivenRun: vi.fn(),
}));

// The lab feature's `handleLabDone` is replaced by a fake; which diagram a build sends is its real code.
const labFeature = vi.hoisted(() => ({ handleLabDone: vi.fn() }));
vi.mock('@/main/features/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/main/features/lab')>()),
  handleLabDone: labFeature.handleLabDone,
}));

const RUN = 'a1'.repeat(16);
const SESSION = 'gh-session-0123456789';

const LAB_DONE: LabDone = {
  step: 'build',
  changeId: '0123456789ab',
  title: 'Add a note element',
  kind: 'editor_element',
  plan: null,
  modelProposal: null,
  repoChanges: [
    {
      repo: 'frontend',
      branch: 'lab/jordi/note-element',
      base: 'develop',
      files: [{ path: 'packages/editor/src/main/packages/components.ts', status: 'modified' }],
    },
  ],
  checks: [
    { id: 'frontend:lint', repo: 'frontend', title: 'Lint', passed: true, skipped: false, summary: 'clean', durationSeconds: 4.2 },
  ],
  checklist: [{ id: 'editor_element.components', text: 'Registered in components.ts', done: true }],
  summary: 'frontend: 1 file',
  stopReason: 'completed',
  finalText: 'Added the note element.',
  report: null,
  pullRequests: [],
  cost: { usd: 0, turns: 0, elapsedSeconds: 0, runs: 0 },
  issues: [],
  noteProposals: [],
};

const start = { event: 'start', runId: RUN, provider: 'anthropic' } as SpecDrivenEvent;
const labDoneEvent = (lab: LabDone = LAB_DONE) =>
  ({
    event: 'done',
    runId: RUN,
    downloadUrl: '',
    fileName: '',
    isZip: false,
    recipe: {},
    mode: 'modify',
    changedFiles: ['frontend/packages/editor/src/main/packages/components.ts'],
    changedFileCount: 1,
    lab,
  }) as unknown as SpecDrivenEvent;

/** A run handle whose stream yields `events`, then waits for `hold` (if any) before it ends. */
function scriptedHandle(events: SpecDrivenEvent[], hold?: Promise<void>) {
  const controller = new AbortController();
  return {
    controller,
    abort: () => controller.abort(),
    events: (async function* () {
      for (const event of events) yield event;
      if (hold) {
        await new Promise<void>((resolve, reject) => {
          void hold.then(resolve);
          controller.signal.addEventListener('abort', () =>
            reject(new DOMException('The user aborted a request.', 'AbortError')),
          );
        });
      }
    })(),
  };
}

const element = (id: string, type: string) => ({
  [id]: { id, name: id, type, owner: null, bounds: { x: 0, y: 0, width: 100, height: 60 } },
});

const PROJECT = {
  id: 'proj-lab',
  name: 'Lab project',
  diagrams: {
    ClassDiagram: [
      {
        id: 'cd1',
        title: 'Note',
        model: { version: '3.0.0', type: 'ClassDiagram', elements: element('Note', 'Class'), relationships: {} },
      },
    ],
    StateMachineDiagram: [
      {
        id: 'sm1',
        title: 'States',
        model: { version: '3.0.0', type: 'StateMachineDiagram', elements: element('Idle', 'State'), relationships: {} },
      },
    ],
  },
  currentDiagramIndices: { ClassDiagram: 0, StateMachineDiagram: 0 },
};

function Surface({
  apiRef,
  onRunFinished,
  project = PROJECT,
}: {
  apiRef: { current: UseSpecDrivenTriggerReturn | null };
  onRunFinished?: () => void;
  project?: unknown;
}) {
  const [, setIsGenerating] = React.useState(false);
  const currentProjectRef = React.useRef(project as BesserProject);
  apiRef.current = useSpecDrivenTrigger({
    currentProjectRef,
    setMessages: conversationStore.setMessages,
    setIsGenerating,
    onRunFinished,
  });
  return null;
}

function mount(onRunFinished?: () => void) {
  const api: { current: UseSpecDrivenTriggerReturn | null } = { current: null };
  render(
    <Provider store={store}>
      <Surface apiRef={api} onRunFinished={onRunFinished} />
    </Provider>,
  );
  return api;
}

const contents = () => conversationStore.getMessages().map((m) => m.content);
const card = () => conversationStore.getMessages().find((m) => m.specDriven)?.specDriven;

beforeEach(() => {
  vi.clearAllMocks();
  conversationStore.clear();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  resetGitHubAuthForTests();
});

describe('a lab run', () => {
  it('streams into one run card and hands the done payload to the lab feature, with no key and no app messages', async () => {
    vi.mocked(startLabRun).mockReturnValue(scriptedHandle([start, labDoneEvent()]));
    const onRunFinished = vi.fn();
    const api = mount(onRunFinished);

    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Add a note element', githubSession: SESSION });
    });

    // No key in the tab: a Spec-Driven run would have opened the key dialog instead.
    expect(store.getState().specDriven.byokDialogOpen).toBe(false);
    expect(sseClient.startSpecDrivenRun).not.toHaveBeenCalled();
    expect(startLabRun).toHaveBeenCalledTimes(1);
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({
      message: 'Add a note element',
      githubSession: SESSION,
    });

    const finished = card();
    expect(finished?.status).toBe('done');
    expect(finished?.liveKey).toBeUndefined();
    expect(finished?.lab?.repoChanges[0].files[0].path).toBe('packages/editor/src/main/packages/components.ts');
    // No change model went with the request (or it is not known after a reload).
    await waitFor(() => expect(labFeature.handleLabDone).toHaveBeenCalledWith(LAB_DONE, undefined));

    // Only the card: no intro line and no "Generated N files" message.
    expect(conversationStore.getMessages()).toHaveLength(1);
    expect(contents().join('\n')).not.toMatch(/Generated/);
    expect(onRunFinished).not.toHaveBeenCalled();
    // The run ended: no pointer is left for a reload to follow.
    expect(readActiveSpecDrivenRun()).toBeNull();
    expect(store.getState().specDriven.runStatus).toBe('idle');
  });

  it("sends the change's proposed class diagram, not the diagram that happens to be active", async () => {
    // The user's own Library model is active (e.g. after Discard closed the proposal's tab or a tab switch);
    // the lab proposed "Note" for change c1, and the user kept it.
    const project = {
      ...PROJECT,
      diagrams: {
        ...PROJECT.diagrams,
        ClassDiagram: [
          { ...PROJECT.diagrams.ClassDiagram[0], id: 'kept', title: 'Note', config: { labChangeId: 'c1' } },
          {
            id: 'library',
            title: 'Library',
            model: { version: '3.0.0', type: 'ClassDiagram', elements: element('Book', 'Class'), relationships: {} },
          },
        ],
      },
      currentDiagramIndices: { ClassDiagram: 1, StateMachineDiagram: 0 },
    };
    vi.mocked(startLabRun).mockReturnValue(scriptedHandle([start, labDoneEvent()]));
    const api: { current: UseSpecDrivenTriggerReturn | null } = { current: null };
    render(
      <Provider store={store}>
        <Surface apiRef={api} project={project} />
      </Provider>,
    );
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Build it', githubSession: SESSION, action: 'build', changeId: 'c1' });
    });
    const params = vi.mocked(startLabRun).mock.calls[0][0];
    expect(params.action).toBe('build');
    const sent = params.project as {
      diagrams: Record<string, { id: string }[]>;
      currentDiagramIndices: Record<string, number>;
    };
    expect(Object.keys(sent.diagrams)).toEqual(['ClassDiagram']);
    expect(sent.diagrams.ClassDiagram.map((diagram) => diagram.id)).toEqual(['kept']);
    expect(sent.currentDiagramIndices.ClassDiagram).toBe(0);
  });

  it('sends no diagram when the change has no proposal, or the message continues no change', async () => {
    vi.mocked(startLabRun).mockImplementation(() => scriptedHandle([start, labDoneEvent()]));
    const api = mount();
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Build it', githubSession: SESSION, action: 'build', changeId: 'c1' });
    });
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Add a TOML generator', githubSession: SESSION });
    });
    expect(vi.mocked(startLabRun).mock.calls.map(([params]) => params.project)).toEqual([null, null]);
  });

  it('names BESSER Lab on the card from the start of the run', async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(startLabRun).mockReturnValue(scriptedHandle([start], hold));
    const api = mount();
    let running: Promise<void> = Promise.resolve();
    await act(async () => {
      running = api.current!.handleLabMessage({ message: 'One', githubSession: SESSION });
    });
    const liveKey = card()?.liveKey as string;
    expect(store.getState().specDriven.runs[liveKey]?.isLabRun).toBe(true);
    await act(async () => {
      release();
      await running;
    });
    expect(card()?.isLabRun).toBe(true);
  });

  it.each([
    [409, { detail: 'A lab run or another change action is in progress.' }, /busy with another run or change action/],
    [401, { detail: 'GitHub session expired' }, /GitHub session has expired\. Sign in again/],
    [403, { detail: 'Not allowed' }, /not allowed to use BESSER Lab/],
    [503, { detail: 'BESSER_LAB_WORKSPACE_ROOT is not set.' }, /not available on this server: BESSER_LAB_WORKSPACE_ROOT is not set\./],
  ])('says why the server refused the run (%s), not only its status', async (status, body, expected) => {
    vi.mocked(startLabRun).mockReturnValue({
      controller: new AbortController(),
      abort: () => undefined,
      events: (async function* () {
        throw new SseHttpError(status, JSON.stringify(body));
      })(),
    });
    const api = mount();
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Add it', githubSession: SESSION });
    });
    const text = contents().join('\n');
    expect(text).toMatch(expected);
    expect(text).not.toMatch(/SSE request failed/);
    expect(card()?.status).toBe('error');
    expect(store.getState().specDriven.runStatus).toBe('idle');
  });

  it('keeps a pointer to the run while it streams, and drops it when the run is done', async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const controller = new AbortController();
    vi.mocked(startLabRun).mockReturnValue({
      controller,
      abort: () => controller.abort(),
      events: (async function* () {
        yield { ...start, sequence: 1 } as SpecDrivenEvent;
        await hold;
        yield labDoneEvent();
      })(),
    });
    const api = mount();
    let running: Promise<void> = Promise.resolve();
    await act(async () => {
      running = api.current!.handleLabMessage({ message: 'Add it', githubSession: SESSION });
    });
    try {
      expect(readActiveSpecDrivenRun('proj-lab')).toMatchObject({ runId: RUN, projectId: 'proj-lab', kind: 'lab' });
    } finally {
      // End the run even when the expectation fails, so the next test finds the run slot free.
      await act(async () => {
        release();
        await running;
      });
    }
    expect(readActiveSpecDrivenRun('proj-lab')).toBeNull();
  });

  it('follows the run after a reload: a BESSER Lab card that gets the done payload', async () => {
    writeActiveSpecDrivenRun({ runId: RUN, projectId: 'proj-lab', lastSequence: 4, startedAt: Date.now(), kind: 'lab' });
    vi.mocked(sseClient.followSpecDrivenRun).mockReturnValue(scriptedHandle([start, labDoneEvent()]));
    // The tab's sign-in: the lab's run routes need its session (E2E C-D6).
    signInToGitHubForTests(SESSION);
    const onRunFinished = vi.fn();
    mount(onRunFinished);

    await waitFor(() => expect(card()?.status).toBe('done'));
    expect(sseClient.followSpecDrivenRun).toHaveBeenCalledWith(RUN, 0, SESSION);
    expect(card()?.isLabRun).toBe(true);
    expect(card()?.lab?.changeId).toBe('0123456789ab');
    // No change model went with the request (or it is not known after a reload).
    await waitFor(() => expect(labFeature.handleLabDone).toHaveBeenCalledWith(LAB_DONE, undefined));
    expect(onRunFinished).not.toHaveBeenCalled();
    expect(readActiveSpecDrivenRun()).toBeNull();
    expect(store.getState().specDriven.runStatus).toBe('idle');
  });

  it('follows the run in progress the lab names when it refuses a message as busy', async () => {
    vi.mocked(startLabRun).mockReturnValue({
      controller: new AbortController(),
      abort: () => undefined,
      events: (async function* () {
        throw new SseHttpError(409, JSON.stringify({ detail: 'A lab run or another change action is in progress.' }));
      })(),
    });
    vi.mocked(getLabState).mockResolvedValueOnce({ run: { runId: RUN, startedAt: 1_763_500_000 } } as never);
    vi.mocked(sseClient.followSpecDrivenRun).mockReturnValue(scriptedHandle([start, labDoneEvent()]));
    const api = mount();
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Add it', githubSession: SESSION });
    });
    expect(getLabState).toHaveBeenCalledWith(SESSION);
    // The lab's run routes need the lab user's session (E2E C-D6).
    expect(sseClient.followSpecDrivenRun).toHaveBeenCalledWith(RUN, 0, SESSION);
    expect(contents().join('\n')).toMatch(/busy with another run or change action/);
    const cards = conversationStore.getMessages().filter((m) => m.specDriven).map((m) => m.specDriven!);
    expect(cards.map((c) => c.status)).toEqual(['error', 'done']);
    expect(cards[1].lab?.title).toBe('Add a note element');
    expect(store.getState().specDriven.runStatus).toBe('idle');
  });

  it('writes its chat lines through the translations', async () => {
    const translate = vi.spyOn(i18n, 't');
    vi.mocked(startLabRun).mockImplementation(() => {
      throw new Error('offline');
    });
    const api = mount();
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Add it', githubSession: SESSION });
    });
    expect(translate).toHaveBeenCalledWith(
      'lab.chat.startFailed',
      expect.objectContaining({ defaultValue: 'BESSER Lab failed to start: {{error}}', error: 'offline' }),
    );
    translate.mockRestore();
  });

  it('refuses a second message while a run is in flight', async () => {
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(startLabRun).mockReturnValue(scriptedHandle([start], hold));
    const api = mount();
    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = api.current!.handleLabMessage({ message: 'One', githubSession: SESSION });
    });
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Two', githubSession: SESSION });
    });
    expect(startLabRun).toHaveBeenCalledTimes(1);
    expect(contents()).toContain('BESSER Lab is already running — please wait for it to finish or click Stop.');
    await act(async () => {
      release();
      await first;
    });
    expect(store.getState().specDriven.runStatus).toBe('idle');
  });

  it("does not clear the user's own key when the server's key is refused", async () => {
    window.sessionStorage.setItem(sessionStorageLlmApiKey, 'sk-user');
    window.sessionStorage.setItem(sessionStorageLlmProvider, 'anthropic');
    vi.mocked(startLabRun).mockReturnValue(
      scriptedHandle([start, { event: 'error', code: 'INVALID_KEY', message: 'The key was refused.' } as SpecDrivenEvent]),
    );
    const onRunFinished = vi.fn();
    const api = mount(onRunFinished);
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Fix it', githubSession: SESSION });
    });
    expect(window.sessionStorage.getItem(sessionStorageLlmApiKey)).toBe('sk-user');
    expect(contents()).toContain('❌ BESSER Lab error (INVALID_KEY): The key was refused.');
    expect(card()?.status).toBe('error');
    // A failed lab run is not reported to the modeling agent either.
    expect(onRunFinished).not.toHaveBeenCalled();
  });

  it('stops on the server with its run id when the user stops it', async () => {
    vi.mocked(startLabRun).mockReturnValue(scriptedHandle([start], new Promise<void>(() => undefined)));
    const onRunFinished = vi.fn();
    const api = mount(onRunFinished);
    let running: Promise<void> = Promise.resolve();
    await act(async () => {
      running = api.current!.handleLabMessage({ message: 'Long one', githubSession: SESSION });
    });
    await waitFor(() => expect(store.getState().specDriven.runStatus).toBe('running'));
    await act(async () => {
      api.current!.abortActive();
      await running;
    });
    // With the lab user's session: the lab's cancel route refuses a request without one (E2E C-D6).
    expect(cancelSpecDrivenRun).toHaveBeenCalledWith(RUN, { githubSession: SESSION });
    expect(onRunFinished).not.toHaveBeenCalled();
    expect(card()?.liveKey).toBeUndefined();
    expect(store.getState().specDriven.runStatus).toBe('idle');
  });

  it('reports a result the lab feature could not apply', async () => {
    labFeature.handleLabDone.mockImplementationOnce(() => {
      throw new Error('no project');
    });
    vi.mocked(startLabRun).mockReturnValue(scriptedHandle([start, labDoneEvent()]));
    const api = mount();
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Add it', githubSession: SESSION });
    });
    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        'The result of the lab run could not be applied to the project.',
        expect.objectContaining({ error: expect.any(Error) }),
      ),
    );
    expect(card()?.status).toBe('done');
  });

  // E2E A-2: a reload during a build left "Error / network error" and "BESSER Lab stream error: network error"
  // in the saved conversation, beside the card of the run the reloaded page followed to its end.
  describe('when the page unloads during the run', () => {
    /** A run that streams `start`, then fails the way the browser cuts a page's requests once it unloads. */
    const cutOnUnload = (error: Error = new TypeError('network error')) => {
      const controller = new AbortController();
      return {
        controller,
        abort: () => controller.abort(),
        events: (async function* () {
          yield { ...start, sequence: 1 } as SpecDrivenEvent;
          await new Promise<void>((resolve) => window.addEventListener('beforeunload', () => resolve(), { once: true }));
          throw error;
        })(),
      };
    };

    afterEach(() => {
      window.dispatchEvent(new Event('pageshow'));
    });

    const expectLeftForTheReload = () => {
      expect(contents().join('\n')).not.toMatch(/stream error|network error/);
      expect(reportError).not.toHaveBeenCalled();
      // The card is not finalized as failed: a live card is not saved, so the reloaded page shows only the followed run.
      expect(card()?.status).toBe('running');
      expect(readActiveSpecDrivenRun('proj-lab')).toMatchObject({ runId: RUN, kind: 'lab' });
      expect(store.getState().specDriven.runStatus).toBe('idle');
    };

    it('records no error for a run this tab started', async () => {
      vi.mocked(startLabRun).mockReturnValue(cutOnUnload());
      const api = mount();
      let running: Promise<void> = Promise.resolve();
      await act(async () => {
        running = api.current!.handleLabMessage({ message: 'Build it', githubSession: SESSION });
      });
      await act(async () => {
        window.dispatchEvent(new Event('beforeunload'));
        await running;
      });
      expectLeftForTheReload();
    });

    it('does not call a request the browser aborts on unload a stop by the user', async () => {
      vi.mocked(startLabRun).mockReturnValue(cutOnUnload(new DOMException('The operation was aborted.', 'AbortError')));
      const api = mount();
      let running: Promise<void> = Promise.resolve();
      await act(async () => {
        running = api.current!.handleLabMessage({ message: 'Build it', githubSession: SESSION });
      });
      await act(async () => {
        window.dispatchEvent(new Event('beforeunload'));
        await running;
      });
      expect(contents().join('\n')).not.toMatch(/stopped by user/);
      expectLeftForTheReload();
    });

    it('records no error for a run followed after an earlier reload', async () => {
      writeActiveSpecDrivenRun({ runId: RUN, projectId: 'proj-lab', lastSequence: 1, startedAt: Date.now(), kind: 'lab' });
      vi.mocked(sseClient.followSpecDrivenRun).mockReturnValue(cutOnUnload());
      mount();
      await waitFor(() => expect(store.getState().specDriven.runStatus).toBe('running'));
      await act(async () => {
        window.dispatchEvent(new Event('beforeunload'));
      });
      await waitFor(() => expect(store.getState().specDriven.runStatus).toBe('idle'));
      expectLeftForTheReload();
    });

    it('still reports a network error when the page is not unloading', async () => {
      window.dispatchEvent(new Event('pageshow'));
      vi.mocked(startLabRun).mockReturnValue({
        controller: new AbortController(),
        abort: () => undefined,
        events: (async function* () {
          yield { ...start, sequence: 1 } as SpecDrivenEvent;
          throw new TypeError('network error');
        })(),
      });
      const api = mount();
      await act(async () => {
        await api.current!.handleLabMessage({ message: 'Build it', githubSession: SESSION });
      });
      expect(contents()).toContain('BESSER Lab stream error: network error');
      expect(card()?.status).toBe('error');
    });
  });

  it("hands the lab feature the change's model the request carried, so an edit made during the run is not lost", async () => {
    const project = {
      ...PROJECT,
      diagrams: {
        ...PROJECT.diagrams,
        ClassDiagram: [{ ...PROJECT.diagrams.ClassDiagram[0], config: { labProposalChangeId: 'c1' } }],
      },
    };
    vi.mocked(startLabRun).mockReturnValue(scriptedHandle([start, labDoneEvent()]));
    const api: { current: UseSpecDrivenTriggerReturn | null } = { current: null };
    render(
      <Provider store={store}>
        <Surface apiRef={api} project={project} />
      </Provider>,
    );
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Rename Note', githubSession: SESSION, action: 'plan', changeId: 'c1' });
    });
    // A plan step carries the change's diagram as well, not only a build.
    const params = vi.mocked(startLabRun).mock.calls[0][0];
    expect(params.action).toBe('plan');
    const sentModel = (params.project as { diagrams: { ClassDiagram: Array<{ model: unknown }> } }).diagrams.ClassDiagram[0].model;
    expect(sentModel).toEqual(PROJECT.diagrams.ClassDiagram[0].model);
    await waitFor(() => expect(labFeature.handleLabDone).toHaveBeenCalledWith(LAB_DONE, sentModel));
  });

  it('ends the card with an error when the stream cannot be opened, and frees the slot', async () => {
    vi.mocked(startLabRun).mockImplementation(() => {
      throw new Error('offline');
    });
    const api = mount();
    await act(async () => {
      await api.current!.handleLabMessage({ message: 'Add it', githubSession: SESSION });
    });
    expect(card()?.status).toBe('error');
    expect(contents()).toContain('BESSER Lab failed to start: offline');
    expect(store.getState().specDriven.runStatus).toBe('idle');
  });
});
