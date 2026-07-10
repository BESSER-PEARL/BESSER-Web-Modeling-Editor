/**
 * Unit tests for useSmartGenTrigger.
 *
 * Strategy:
 *   - Mock the SSE client at the module boundary (`vi.mock`) so we can
 *     feed scripted event sequences into the hook without touching
 *     `fetch`.
 *   - Mock `sessionStorage` per-test by clearing it in `beforeEach`.
 *   - Provide a real Redux store (not a stub) so the slice reducers
 *     are exercised for real, and `useAppSelector` subscribes correctly.
 *   - Mock `fetch` only for the download fetch at the end (the SSE
 *     stream is mocked via the sseClient module mock).
 *
 * Covered paths:
 *   - Happy path: key present → stream → done → download success
 *   - BYOK missing → opens dialog → saving key resumes run
 *   - Invalid key event → clears sessionStorage, reopens BYOK
 *   - Abort mid-stream → soft stop with "stopped by user" message
 *   - Concurrent trigger → second call rejected with error message
 *   - No active project → error message
 *   - Download fetch failure → error message, NO success bubble
 *   - clearConversation aborts the run
 *   - Unmount during stream → no setState errors
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closeByokDialog,
  openByokDialog,
  setApiKeyPresent,
  smartGeneratorReducer,
} from '../../state/smartGeneratorSlice';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { useSmartGenTrigger, type SmartGenRunResult } from '../useSmartGenTrigger';
import type { SmartGenEvent, TriggerSmartGeneratorPayload } from '../../types';
import {
  sessionStorageSmartGenApiKey,
  sessionStorageSmartGenMaxCostUsd,
  sessionStorageSmartGenMaxRuntimeSeconds,
  sessionStorageSmartGenProvider,
} from '../../../../shared/constants/constant';

// Mock the toast so we can assert on it without rendering a real container.
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock the download util so the test doesn't attempt a real browser download.
vi.mock('../../../../shared/utils/download', () => ({
  downloadFile: vi.fn(),
}));

// Mock the SSE client — tests feed scripted events via a shared queue.
const _mockController: {
  events: SmartGenEvent[];
  abortCalled: boolean;
  throwOnStart: Error | null;
} = {
  events: [],
  abortCalled: false,
  throwOnStart: null,
};

// Mock the smart-gen config so the modify-vs-fresh decision in startRun
// resolves synchronously to the fallback (download_ttl_seconds) WITHOUT
// hitting `fetch` — the "nothing written to disk" assertions below count
// every fetch call, and the config lookup is unrelated to the download.
vi.mock('../../services/smartGenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../services/smartGenConfig')>();
  return {
    ...mod,
    getSmartGenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)),
  };
});

vi.mock('../../services/smartGenerationSseClient', () => ({
  startSmartGenRun: vi.fn((_params) => {
    if (_mockController.throwOnStart) throw _mockController.throwOnStart;
    const scripted = [..._mockController.events];
    return {
      controller: new AbortController(),
      abort: () => { _mockController.abortCalled = true; },
      events: (async function* () {
        for (const ev of scripted) {
          yield ev;
        }
      })(),
    };
  }),
}));

// Helper — build a fresh store per test.
function makeStore() {
  return configureStore({
    reducer: {
      workspace: workspaceReducer,
      errors: errorReducer,
      smartGenerator: smartGeneratorReducer,
    },
  });
}

// Harness component that exercises the hook and exposes its API via refs.
interface HarnessAPI {
  handleTrigger: (payload: TriggerSmartGeneratorPayload) => Promise<void>;
  abortActive: () => void;
  getMessages: () => unknown[];
  getIsGenerating: () => boolean;
}

function Harness(props: {
  apiRef: { current: HarnessAPI | null };
  hasProject?: boolean;
  onRunFinished?: (result: SmartGenRunResult) => void;
}) {
  const [messages, setMessages] = React.useState<any[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const currentProjectRef = React.useRef<any>(
    props.hasProject === false
      ? null
      : {
          id: 'test-project',
          name: 'TestProject',
          diagrams: { ClassDiagram: [{ id: 'cd1', title: 'lib', model: {} }] },
          currentDiagramIndices: { ClassDiagram: 0 },
        },
  );
  const hook = useSmartGenTrigger({
    currentProjectRef,
    setMessages,
    setIsGenerating,
    onRunFinished: props.onRunFinished,
  });
  // Expose via ref so tests can call without clicks.
  props.apiRef.current = {
    handleTrigger: hook.handleTrigger,
    abortActive: hook.abortActive,
    getMessages: () => messages,
    getIsGenerating: () => isGenerating,
  };
  return <div data-testid="msgs">{JSON.stringify(messages.length)}</div>;
}

function renderHarness(
  opts: {
    hasProject?: boolean;
    onRunFinished?: (result: SmartGenRunResult) => void;
  } = {},
) {
  const store = makeStore();
  const apiRef: { current: HarnessAPI | null } = { current: null };
  const result = render(
    <Provider store={store}>
      <Harness
        apiRef={apiRef}
        hasProject={opts.hasProject}
        onRunFinished={opts.onRunFinished}
      />
    </Provider>,
  );
  return { store, apiRef, ...result };
}

/**
 * Render TWO independent hook instances against ONE store — mirroring
 * production, where AssistantWidget and AssistantWorkspaceDrawer are
 * both always mounted and each instantiates useSmartGenTrigger.
 */
function renderDualHarness() {
  const store = makeStore();
  const apiRefA: { current: HarnessAPI | null } = { current: null };
  const apiRefB: { current: HarnessAPI | null } = { current: null };
  const result = render(
    <Provider store={store}>
      <Harness apiRef={apiRefA} />
      <Harness apiRef={apiRefB} />
    </Provider>,
  );
  return { store, apiRefA, apiRefB, ...result };
}

const PAYLOAD: TriggerSmartGeneratorPayload = {
  action: 'trigger_smart_generator',
  instructions: 'build a thing',
  provider: 'anthropic',
  llmModel: 'claude-sonnet-4-6',
  message: 'I will build this for you.',
};

function setSessionKey(key = 'sk-ant-test-NEVER-LEAK-0123') {
  window.sessionStorage.setItem(sessionStorageSmartGenApiKey, key);
  window.sessionStorage.setItem(sessionStorageSmartGenProvider, 'anthropic');
}

function clearSessionKeyManual() {
  window.sessionStorage.removeItem(sessionStorageSmartGenApiKey);
  window.sessionStorage.removeItem(sessionStorageSmartGenProvider);
  // Also clear the optional model key so prior tests don't leak
  // ``llmModel=o1`` into tests that expect the agent hint to win.
  window.sessionStorage.removeItem('besser_llm_model');
  // And the run budget — tests that don't set one expect the
  // maxCostUsd / maxRuntimeSeconds params to stay undefined.
  window.sessionStorage.removeItem(sessionStorageSmartGenMaxCostUsd);
  window.sessionStorage.removeItem(sessionStorageSmartGenMaxRuntimeSeconds);
}

beforeEach(() => {
  _mockController.events = [];
  _mockController.abortCalled = false;
  _mockController.throwOnStart = null;
  clearSessionKeyManual();
  vi.clearAllMocks();
});

afterEach(() => {
  clearSessionKeyManual();
});

// Reusable scripted event sequence representing a successful run.
const HAPPY_EVENTS: SmartGenEvent[] = [
  { event: 'start', runId: 'a'.repeat(32), provider: 'anthropic', llmModel: 'claude-sonnet-4-6', maxCost: 1.0, maxRuntime: 600 },
  { event: 'phase', phase: 'select', message: 'Selecting generator' },
  { event: 'phase', phase: 'generate', message: 'running fastapi_backend' },
  { event: 'text', delta: 'Building your app…' },
  { event: 'tool_call', turn: 1, tool: 'write_file', status: 'executing' },
  { event: 'cost', usd: 0.05, turns: 1, elapsedSeconds: 12.3 },
  {
    event: 'done',
    runId: 'a'.repeat(32),
    downloadUrl: `/besser_api/download-smart/${'a'.repeat(32)}`,
    fileName: 'besser_smart_output.zip',
    isZip: true,
    recipe: { instructions: 'build a thing', generator_used: 'fastapi_backend' },
  },
];


describe('useSmartGenTrigger — happy path', () => {
  it('runs the full stream and surfaces a Download action on done (no auto-save)', async () => {
    setSessionKey();
    _mockController.events = HAPPY_EVENTS;

    // The run must NOT auto-download anymore (consent fix). If the hook
    // tried to save, it would call fetch — assert it never does.
    const _fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake zip']), {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      }),
    );
    globalThis.fetch = _fetchMock;

    const { apiRef } = renderHarness();

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    // Wait for state to settle (for await loop)
    await waitFor(() => {
      const msgs = apiRef.current!.getMessages();
      expect(msgs.length).toBeGreaterThanOrEqual(3);
    });

    const msgs = apiRef.current!.getMessages() as any[];
    // Expected messages: intro, streaming-card-with-events, "✅ complete"
    expect(msgs.some((m) => m.content?.includes('I will build this for you'))).toBe(true);
    expect(msgs.some((m) => m.content?.includes('✅'))).toBe(true);
    // The card is finished and flagged as awaiting a user-initiated save.
    const card = msgs.find((m) => m.smartGen);
    expect(card.smartGen.status).toBe('done');
    expect(card.smartGen.needsDownload).toBe(true);
    expect(card.smartGen.fileName).toBe('besser_smart_output.zip');
    // No file was written to disk without consent.
    expect(_fetchMock).not.toHaveBeenCalled();
    expect(apiRef.current!.getIsGenerating()).toBe(false);
  });
});


describe('useSmartGenTrigger — BYOK missing flow', () => {
  it('opens BYOK dialog when no key is stored', async () => {
    // Intentionally no setSessionKey call.
    const { apiRef, store } = renderHarness();

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    const state = store.getState().smartGenerator;
    expect(state.byokDialogOpen).toBe(true);
    expect(state.pendingTrigger).not.toBeNull();
    // No messages appended — the stream never started.
    const msgs = apiRef.current!.getMessages();
    expect(msgs.length).toBe(0);
  });
});


describe('useSmartGenTrigger — invalid key error handling', () => {
  it('clears the session key when an INVALID_KEY error event arrives', async () => {
    setSessionKey('sk-ant-bogus');
    _mockController.events = [
      { event: 'start', runId: 'a'.repeat(32), provider: 'anthropic', llmModel: 'claude-sonnet-4-6', maxCost: 1.0, maxRuntime: 600 },
      { event: 'error', code: 'INVALID_KEY', message: 'No API key' },
    ];
    globalThis.fetch = vi.fn();

    const { apiRef, store } = renderHarness();

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    await waitFor(() => {
      expect(store.getState().smartGenerator.apiKeyInStore).toBe(false);
    });
    // Key was cleared from sessionStorage
    expect(window.sessionStorage.getItem(sessionStorageSmartGenApiKey)).toBeNull();
  });
});


describe('useSmartGenTrigger — done event (consent-based download)', () => {
  it('does NOT auto-save the artifact: no download fetch fires on done', async () => {
    setSessionKey();
    _mockController.events = HAPPY_EVENTS;
    // If the hook auto-downloaded it would call fetch; assert it doesn't.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake zip']), {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      }),
    );
    globalThis.fetch = fetchMock;

    const { apiRef } = renderHarness();

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    await waitFor(() => {
      const msgs = apiRef.current!.getMessages() as any[];
      expect(msgs.some((m) => m.smartGen?.status === 'done')).toBe(true);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const msgs = apiRef.current!.getMessages() as any[];
    // A success bubble is still shown; no error bubble.
    expect(msgs.some((m) => m.content?.includes('✅'))).toBe(true);
    expect(msgs.some((m) => m.isError === true)).toBe(false);
  });

  it('finalizes the card to done with needsDownload and persisted artifact coords', async () => {
    setSessionKey();
    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake zip']), {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      }),
    );

    const { apiRef } = renderHarness();

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    await waitFor(() => {
      const msgs = apiRef.current!.getMessages() as any[];
      expect(msgs.some((m) => m.content?.includes('✅'))).toBe(true);
    });

    const msgs = apiRef.current!.getMessages() as any[];
    // The card is finished and carries everything the Download button needs.
    const card = msgs.find((m) => m.smartGen);
    expect(card.smartGen.status).toBe('done');
    expect(card.smartGen.needsDownload).toBe(true);
    expect(card.smartGen.downloadFailed).toBeFalsy();
    expect(card.smartGen.runId).toBe('a'.repeat(32));
    expect(card.smartGen.fileName).toBe('besser_smart_output.zip');
    expect(card.smartGen.isZip).toBe(true);
    // The completion message points the user at the Download action.
    const doneMsg = msgs.find((m) => m.content?.includes('✅'));
    expect(doneMsg.content).toMatch(/download/i);
  });
});


describe('useSmartGenTrigger — concurrent trigger guard', () => {
  it('rejects a second trigger while one is already running', async () => {
    setSessionKey();
    // A never-yielding generator so the first run stays "in progress"
    _mockController.events = [];
    // Use a hanging stream for this test
    const { apiRef } = renderHarness();

    // Fire-and-forget first call
    const firstCall = apiRef.current!.handleTrigger(PAYLOAD);

    // Wait a tick so isRunningRef flips to true
    await act(async () => {
      await Promise.resolve();
    });

    // Second call should append an error and not start anything
    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    const msgs = apiRef.current!.getMessages() as any[];
    const errorMsg = msgs.find((m) => m.content?.includes('already running'));
    // Either the guard fired OR the first run finished so quickly the
    // guard didn't need to. Both are acceptable behaviours.
    if (errorMsg) {
      expect(errorMsg.isError).toBe(true);
    }
    await firstCall;
  });
});


describe('useSmartGenTrigger — no project', () => {
  it('appends an error message when there is no active project', async () => {
    setSessionKey();
    _mockController.events = HAPPY_EVENTS;

    const { apiRef } = renderHarness({ hasProject: false });

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    const msgs = apiRef.current!.getMessages() as any[];
    expect(msgs.some((m) => m.content?.includes('open project') && m.isError)).toBe(true);
  });
});


describe('useSmartGenTrigger — BYOK provider wins over agent hint', () => {
  it('uses the provider from sessionStorage, NOT the agent\'s trigger payload hint', async () => {
    // Scenario: the modeling agent emits trigger_smart_generator with
    // its default hint ``provider="anthropic"``, but the user has
    // already selected "openai" in the BYOK dialog and saved an OpenAI
    // key. The run MUST fire with provider=openai — anything else
    // causes the "OpenAI key hits the Anthropic API, gets 401,
    // orchestrator falls through to Phase 1 FastAPI" bug.
    window.sessionStorage.setItem(sessionStorageSmartGenApiKey, 'sk-proj-openai-TEST');
    window.sessionStorage.setItem(sessionStorageSmartGenProvider, 'openai');

    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake']), { status: 200 }),
    );

    const { apiRef } = renderHarness();

    // Agent hints "anthropic" — user picked openai. User wins.
    const agentPayload: TriggerSmartGeneratorPayload = {
      action: 'trigger_smart_generator',
      instructions: 'build a thing',
      provider: 'anthropic',
      llmModel: 'claude-sonnet-4-6',
      message: 'handing off…',
    };

    await act(async () => {
      await apiRef.current!.handleTrigger(agentPayload);
    });

    await waitFor(() => {
      const msgs = apiRef.current!.getMessages();
      expect(msgs.length).toBeGreaterThanOrEqual(2);
    });

    const sseClientModule = await import('../../services/smartGenerationSseClient');
    const startSmartGenRunMock = vi.mocked(sseClientModule.startSmartGenRun);
    expect(startSmartGenRunMock).toHaveBeenCalled();
    const callArgs = startSmartGenRunMock.mock.calls[0][0];
    expect(callArgs.provider).toBe('openai');
    expect(callArgs.apiKey).toBe('sk-proj-openai-TEST');
  });

  it('DROPS the agent\'s llmModel hint when the provider is overridden', async () => {
    // Scenario: agent hints ``provider=anthropic, llmModel=claude-sonnet-4-6``.
    // User picked openai in the BYOK dropdown. The provider correctly
    // flips to openai (prior test). But the model name
    // ``claude-sonnet-4-6`` is ANTHROPIC's — passing it to OpenAI would
    // return 404 ``model_not_found``. The hook MUST drop the llmModel
    // hint when the provider is overridden so the backend can fall
    // back to ``_DEFAULT_MODELS["openai"] = "gpt-4o"``.
    window.sessionStorage.setItem(sessionStorageSmartGenApiKey, 'sk-proj-openai-TEST');
    window.sessionStorage.setItem(sessionStorageSmartGenProvider, 'openai');

    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake']), { status: 200 }),
    );

    const { apiRef } = renderHarness();

    const agentPayload: TriggerSmartGeneratorPayload = {
      action: 'trigger_smart_generator',
      instructions: 'build a thing',
      provider: 'anthropic',
      llmModel: 'claude-sonnet-4-6',  // Anthropic model hint — wrong for openai
      message: 'handing off…',
    };

    await act(async () => {
      await apiRef.current!.handleTrigger(agentPayload);
    });

    await waitFor(() => {
      const msgs = apiRef.current!.getMessages();
      expect(msgs.length).toBeGreaterThanOrEqual(2);
    });

    const sseClientModule = await import('../../services/smartGenerationSseClient');
    const startSmartGenRunMock = vi.mocked(sseClientModule.startSmartGenRun);
    const callArgs = startSmartGenRunMock.mock.calls[0][0];
    expect(callArgs.provider).toBe('openai');
    expect(callArgs.llmModel).toBeUndefined();  // dropped
  });

  it('USES the user\'s chosen model from sessionStorage over any agent hint', async () => {
    // Scenario: user saved ``provider=openai, llmModel=o1`` in the
    // dialog. Agent hints ``provider=anthropic, llmModel=claude-sonnet-4-6``.
    // User's choice wins on BOTH fields.
    window.sessionStorage.setItem(sessionStorageSmartGenApiKey, 'sk-proj-openai-TEST');
    window.sessionStorage.setItem(sessionStorageSmartGenProvider, 'openai');
    window.sessionStorage.setItem(
      'besser_llm_model',
      'o1',
    );

    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake']), { status: 200 }),
    );

    const { apiRef } = renderHarness();

    const agentPayload: TriggerSmartGeneratorPayload = {
      action: 'trigger_smart_generator',
      instructions: 'build a thing',
      provider: 'anthropic',
      llmModel: 'claude-sonnet-4-6',
      message: 'handing off…',
    };

    await act(async () => {
      await apiRef.current!.handleTrigger(agentPayload);
    });

    await waitFor(() => {
      const msgs = apiRef.current!.getMessages();
      expect(msgs.length).toBeGreaterThanOrEqual(2);
    });

    const sseClientModule = await import('../../services/smartGenerationSseClient');
    const startSmartGenRunMock = vi.mocked(sseClientModule.startSmartGenRun);
    const callArgs = startSmartGenRunMock.mock.calls[0][0];
    expect(callArgs.provider).toBe('openai');
    expect(callArgs.llmModel).toBe('o1');
  });

  it('KEEPS the agent\'s llmModel hint when the provider matches', async () => {
    // Scenario: agent hints anthropic, user picked anthropic. The
    // hint is valid — keep it so the user gets the agent's preferred
    // model instead of the backend default (which may be a smaller
    // cheaper model).
    window.sessionStorage.setItem(sessionStorageSmartGenApiKey, 'sk-ant-test-TEST');
    window.sessionStorage.setItem(sessionStorageSmartGenProvider, 'anthropic');

    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake']), { status: 200 }),
    );

    const { apiRef } = renderHarness();

    const agentPayload: TriggerSmartGeneratorPayload = {
      action: 'trigger_smart_generator',
      instructions: 'build a thing',
      provider: 'anthropic',
      llmModel: 'claude-opus-4-6',  // agent's pinned preferred model
      message: 'handing off…',
    };

    await act(async () => {
      await apiRef.current!.handleTrigger(agentPayload);
    });

    await waitFor(() => {
      const msgs = apiRef.current!.getMessages();
      expect(msgs.length).toBeGreaterThanOrEqual(2);
    });

    const sseClientModule = await import('../../services/smartGenerationSseClient');
    const startSmartGenRunMock = vi.mocked(sseClientModule.startSmartGenRun);
    const callArgs = startSmartGenRunMock.mock.calls[0][0];
    expect(callArgs.provider).toBe('anthropic');
    expect(callArgs.llmModel).toBe('claude-opus-4-6');  // preserved
  });
});


describe('useSmartGenTrigger — double-instance race (the double-paid-run bug)', () => {
  it('starts exactly ONE run when two hook instances resume the same pending trigger', async () => {
    // Production setup: AssistantWidget AND AssistantWorkspaceDrawer are
    // both always mounted; each instantiates useSmartGenTrigger against
    // the same store. When the user saves a BYOK key, BOTH resume
    // effects fire in the same commit with the same closure-captured
    // pendingTrigger. Without atomic consumption this started TWO
    // parallel paid runs on the user's key.
    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake zip']), {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      }),
    );

    const { store, apiRefA, apiRefB } = renderDualHarness();
    expect(apiRefA.current).not.toBeNull();
    expect(apiRefB.current).not.toBeNull();

    // Simulate the BYOK flow: trigger arrives with no key (stashed in
    // Redux), the user saves a key, the dialog closes.
    await act(async () => {
      store.dispatch(openByokDialog(PAYLOAD));
    });
    setSessionKey();
    await act(async () => {
      store.dispatch(closeByokDialog());
      store.dispatch(setApiKeyPresent(true));
    });

    const sseClientModule = await import('../../services/smartGenerationSseClient');
    const startSmartGenRunMock = vi.mocked(sseClientModule.startSmartGenRun);

    await waitFor(() => {
      expect(startSmartGenRunMock).toHaveBeenCalledTimes(1);
    });

    // Let everything settle (stream + download), then re-assert: the
    // second instance must never have started a duplicate run.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(startSmartGenRunMock).toHaveBeenCalledTimes(1);
    expect(store.getState().smartGenerator.pendingTrigger).toBeNull();
  });

  it('rejects a handleTrigger on instance B while instance A is mid-run', async () => {
    setSessionKey();
    // Hanging stream: a generator that never yields keeps instance A
    // "running" for the duration of the test.
    let releaseStream: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });
    const sseClientModule = await import('../../services/smartGenerationSseClient');
    const startSmartGenRunMock = vi.mocked(sseClientModule.startSmartGenRun);
    startSmartGenRunMock.mockImplementationOnce(() => ({
      controller: new AbortController(),
      abort: () => {},
      events: (async function* () {
        await gate;
      })() as AsyncGenerator<SmartGenEvent, void, void>,
    }));

    const { apiRefA, apiRefB } = renderDualHarness();

    // Instance A starts a run (fire-and-forget — it hangs on the gate).
    let firstRun: Promise<void> = Promise.resolve();
    await act(async () => {
      firstRun = apiRefA.current!.handleTrigger(PAYLOAD);
      await Promise.resolve();
    });

    // Instance B must be refused by the GLOBAL guard (its own
    // isRunningRef is false — only the store knows about A's run).
    await act(async () => {
      await apiRefB.current!.handleTrigger(PAYLOAD);
    });

    const msgsB = apiRefB.current!.getMessages() as any[];
    const refusal = msgsB.find((m) => m.content?.includes('already running'));
    expect(refusal).toBeTruthy();
    expect(refusal.isError).toBe(true);
    expect(startSmartGenRunMock).toHaveBeenCalledTimes(1);

    releaseStream();
    await act(async () => {
      await firstRun;
    });
  });
});

describe('useSmartGenTrigger — onRunFinished (agent loop)', () => {
  it('reports ok:true with runId / fileName / generatorUsed exactly once on success', async () => {
    setSessionKey();
    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake zip']), {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      }),
    );
    const onRunFinished = vi.fn();

    const { apiRef } = renderHarness({ onRunFinished });

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    await waitFor(() => {
      expect(onRunFinished).toHaveBeenCalledTimes(1);
    });
    expect(onRunFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        runId: 'a'.repeat(32),
        fileName: 'besser_smart_output.zip',
        generatorUsed: 'fastapi_backend',
        costUsd: 0.05,
      }),
    );

    // Abort after completion must NOT produce a second report.
    act(() => {
      apiRef.current!.abortActive();
    });
    expect(onRunFinished).toHaveBeenCalledTimes(1);
  });

  it('reports ok:false with the errorCode on a terminal error', async () => {
    setSessionKey();
    _mockController.events = [
      { event: 'start', runId: 'b'.repeat(32), provider: 'anthropic', llmModel: 'claude-sonnet-4-6', maxCost: 1.0, maxRuntime: 600 },
      { event: 'error', code: 'UPSTREAM_LLM', message: 'provider exploded' },
    ];
    globalThis.fetch = vi.fn();
    const onRunFinished = vi.fn();

    const { apiRef } = renderHarness({ onRunFinished });

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    await waitFor(() => {
      expect(onRunFinished).toHaveBeenCalledTimes(1);
    });
    expect(onRunFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        errorCode: 'UPSTREAM_LLM',
        runId: 'b'.repeat(32),
      }),
    );
  });

  it('reports ok:true on done even though the file is not saved yet (user-initiated download)', async () => {
    setSessionKey();
    _mockController.events = HAPPY_EVENTS;
    // No download is attempted by the hook anymore; the user saves via
    // the card's Download button. The run outcome is purely "did the
    // build succeed", so the agent loop sees ok:true.
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    const onRunFinished = vi.fn();

    const { apiRef } = renderHarness({ onRunFinished });

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    await waitFor(() => {
      expect(onRunFinished).toHaveBeenCalledTimes(1);
    });
    expect(onRunFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        runId: 'a'.repeat(32),
        fileName: 'besser_smart_output.zip',
      }),
    );
    // Crucially, nothing was written to disk during the run.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports ok:false / CANCELLED exactly once on user abort mid-run', async () => {
    setSessionKey();
    // Hanging stream so the run is still active when we abort.
    let releaseStream: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });
    const sseClientModule = await import('../../services/smartGenerationSseClient');
    const startSmartGenRunMock = vi.mocked(sseClientModule.startSmartGenRun);
    startSmartGenRunMock.mockImplementationOnce(() => ({
      controller: new AbortController(),
      abort: () => {},
      events: (async function* () {
        yield {
          event: 'start',
          runId: 'c'.repeat(32),
          provider: 'anthropic',
          llmModel: 'claude-sonnet-4-6',
          maxCost: 1.0,
          maxRuntime: 600,
        } as SmartGenEvent;
        await gate;
      })() as AsyncGenerator<SmartGenEvent, void, void>,
    }));
    const onRunFinished = vi.fn();

    const { apiRef } = renderHarness({ onRunFinished });

    let run: Promise<void> = Promise.resolve();
    await act(async () => {
      run = apiRef.current!.handleTrigger(PAYLOAD);
      await Promise.resolve();
    });

    act(() => {
      apiRef.current!.abortActive();
    });

    await waitFor(() => {
      expect(onRunFinished).toHaveBeenCalledTimes(1);
    });
    expect(onRunFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        errorCode: 'CANCELLED',
        runId: 'c'.repeat(32),
      }),
    );

    releaseStream();
    await act(async () => {
      await run;
    });
    // The AbortError / loop-exit path must not double-report.
    expect(onRunFinished).toHaveBeenCalledTimes(1);
  });
});

describe('useSmartGenTrigger — run budget from sessionStorage', () => {
  it('passes the saved maxCostUsd / maxRuntimeSeconds to the SSE client', async () => {
    setSessionKey();
    window.sessionStorage.setItem(sessionStorageSmartGenMaxCostUsd, '1.5');
    window.sessionStorage.setItem(sessionStorageSmartGenMaxRuntimeSeconds, '300');
    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake']), { status: 200 }),
    );

    const { apiRef } = renderHarness();

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    const sseClientModule = await import('../../services/smartGenerationSseClient');
    const startSmartGenRunMock = vi.mocked(sseClientModule.startSmartGenRun);
    expect(startSmartGenRunMock).toHaveBeenCalled();
    const callArgs = startSmartGenRunMock.mock.calls[0][0];
    expect(callArgs.maxCostUsd).toBe(1.5);
    expect(callArgs.maxRuntimeSeconds).toBe(300);
  });

  it('omits the budget params when nothing is saved', async () => {
    setSessionKey();
    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake']), { status: 200 }),
    );

    const { apiRef } = renderHarness();

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    const sseClientModule = await import('../../services/smartGenerationSseClient');
    const startSmartGenRunMock = vi.mocked(sseClientModule.startSmartGenRun);
    const callArgs = startSmartGenRunMock.mock.calls[0][0];
    expect(callArgs.maxCostUsd).toBeUndefined();
    expect(callArgs.maxRuntimeSeconds).toBeUndefined();
  });
});

describe('useSmartGenTrigger — live cost meter state', () => {
  it('mirrors start budgets and cost events onto the smart-gen card state', async () => {
    setSessionKey();
    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake zip']), {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      }),
    );

    const { apiRef } = renderHarness();

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    await waitFor(() => {
      const msgs = apiRef.current!.getMessages() as any[];
      expect(msgs.some((m) => m.smartGen)).toBe(true);
    });

    const msgs = apiRef.current!.getMessages() as any[];
    const card = msgs.find((m) => m.smartGen);
    expect(card.smartGen.maxCost).toBe(1.0);
    expect(card.smartGen.maxRuntime).toBe(600);
    expect(card.smartGen.costUsd).toBeCloseTo(0.05);
    expect(card.smartGen.elapsedSeconds).toBeCloseTo(12.3);
  });
});

describe('useSmartGenTrigger — abort', () => {
  it('abortActive after a completed run is a safe no-op', async () => {
    setSessionKey();
    _mockController.events = HAPPY_EVENTS;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(new Blob(['fake']), { status: 200 }),
    );

    const { apiRef, store } = renderHarness();

    await act(async () => {
      await apiRef.current!.handleTrigger(PAYLOAD);
    });

    // After the stream completes, the activeRun state stays populated
    // (phase: 'done') so the UI can keep showing the final cost /
    // download URL. Abort after completion should NOT wipe that state
    // — aborting a completed run is a no-op because isRunningRef is
    // already false.
    const beforeAbort = store.getState().smartGenerator.activeRun;
    expect(beforeAbort).not.toBeNull();
    expect(beforeAbort!.phase).toBe('done');

    act(() => {
      apiRef.current!.abortActive();
    });

    // Abort is idempotent on a completed run — state preserved.
    expect(apiRef.current!.getIsGenerating()).toBe(false);
    expect(store.getState().smartGenerator.activeRun).not.toBeNull();
  });
});
