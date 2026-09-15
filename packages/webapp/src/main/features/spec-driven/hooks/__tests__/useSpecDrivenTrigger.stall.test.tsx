/**
 * Regression test for the frozen-run-card bug (run 9b851145 class).
 *
 * PRODUCTION MECHANISM: the browser's SSE fetch delivered the first
 * flush (start + phase "select"), then the transport went dead without
 * error or close — `reader.read()` stayed pending for the whole run.
 * The card painted the early events (proving the store-keyed paint path)
 * and then froze as "Running" FOREVER, silently: no exception, no
 * finalize, no notice, while the backend kept generating. Verified live:
 * the same origin streamed every frame over a direct TCP connection, so
 * the stall is a transport-path property the frontend must survive.
 *
 * The fix: `streamSse` has an opt-in liveness bound (the backend
 * heartbeats a cost tick every ~2s, so a minute of total silence is a
 * dead transport, never a slow run). This test goes through the REAL
 * layers — real fetch-level stream, real `streamSse`, real
 * `startSpecDrivenRun`, real hook, real Redux store — mocking only the
 * config fetch and toasts. It first proves the early events painted into
 * the slice (the exact frozen-card state), then proves the stall is
 * detected and the run terminates honestly instead of hanging forever.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { specDrivenReducer } from '../../state/specDrivenSlice';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { useSpecDrivenTrigger, type SpecDrivenRunResult } from '../useSpecDrivenTrigger';
import type { TriggerSpecDrivenPayload } from '../../types';
import {
  sessionStorageSpecDrivenApiKey,
  sessionStorageSpecDrivenProvider,
} from '../../../../shared/constants/constant';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

// Resolve the config synchronously so `startRun` never touches fetch for it —
// the ONLY fetch in this test is the SSE request itself.
vi.mock('../../services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../services/specDrivenConfig')>();
  return {
    ...mod,
    getSpecDrivenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)),
  };
});

const encoder = new TextEncoder();

/** SSE response whose stream delivers `frames` then goes silent forever —
 * the dead-transport signature (no close, no error, reads stay pending). */
function deadAfter(frames: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      // ...and never close: the transport is dead, not finished.
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const START_FRAME =
  'event: start\ndata: {"event":"start","runId":"9b851145aaaaaaaaaaaaaaaaaaaaaaaa",' +
  '"provider":"free","llmModel":"meituan/LongCat-2.0:free","maxCost":1.0,"maxRuntime":900}\n\n';
const SELECT_FRAME =
  'event: phase\ndata: {"event":"phase","phase":"select","message":"Selecting generator"}\n\n';

function makeStore() {
  return configureStore({
    reducer: {
      workspace: workspaceReducer,
      errors: errorReducer,
      specDriven: specDrivenReducer,
    },
  });
}

interface HarnessAPI {
  handleTrigger: (payload: TriggerSpecDrivenPayload) => Promise<void>;
  getMessages: () => any[];
}

function Harness(props: {
  apiRef: { current: HarnessAPI | null };
  onRunFinished?: (result: SpecDrivenRunResult) => void;
}) {
  const [messages, setMessages] = React.useState<any[]>([]);
  const [, setIsGenerating] = React.useState(false);
  const currentProjectRef = React.useRef<any>({
    id: 'stall-project',
    name: 'StallProject',
    diagrams: { ClassDiagram: [{ id: 'cd1', title: 'd', model: {} }] },
    currentDiagramIndices: { ClassDiagram: 0 },
  });
  const hook = useSpecDrivenTrigger({
    currentProjectRef,
    setMessages,
    setIsGenerating,
    onRunFinished: props.onRunFinished,
  });
  props.apiRef.current = {
    handleTrigger: hook.handleTrigger,
    getMessages: () => messages,
  };
  return null;
}

const PAYLOAD: TriggerSpecDrivenPayload = {
  action: 'trigger_smart_generator',
  instructions: 'build a thing',
  provider: 'anthropic',
  message: 'Starting…',
  planApproved: true,
};

const flushMicrotasks = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

describe('useSpecDrivenTrigger — dead mid-run transport (frozen card regression)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.sessionStorage.clear();
  window.localStorage?.clear();
    window.sessionStorage.setItem(sessionStorageSpecDrivenApiKey, 'sk-test');
    window.sessionStorage.setItem(sessionStorageSpecDrivenProvider, 'anthropic');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage?.clear();
  });

  it('paints the early events, then detects the stall and finalizes the card honestly', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(deadAfter([START_FRAME, SELECT_FRAME]));

    const store = makeStore();
    const apiRef: { current: HarnessAPI | null } = { current: null };
    const onRunFinished = vi.fn();
    render(
      <Provider store={store}>
        <Harness apiRef={apiRef} onRunFinished={onRunFinished} />
      </Provider>,
    );

    let run: Promise<void> = Promise.resolve();
    await act(async () => {
      run = apiRef.current!.handleTrigger(PAYLOAD);
      await flushMicrotasks();
    });

    // ---- The frozen-card state, reproduced through the real layers ----
    // The early frames flowed: the slice entry the card renders carries
    // the run header and the select phase, still 'running'.
    const stub = apiRef.current!.getMessages().find((m) => m.specDriven);
    expect(stub).toBeTruthy();
    const liveKey = stub.specDriven.liveKey as string;
    const live = store.getState().specDriven.runs[liveKey];
    expect(live).toBeTruthy();
    expect(live.runId).toBe('9b851145aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(live.phases.map((p) => p.phase)).toEqual(['select']);
    expect(live.status).toBe('running');
    expect(store.getState().specDriven.runStatus).toBe('running');

    // ---- One minute of total silence: the watchdog must end the run ----
    // (Pre-fix, this advanced nothing: reader.read() stayed pending and
    // the card stayed 'running' forever.)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
      await flushMicrotasks();
      await run;
    });

    // The live entry is finalized INTO the message as a terminal error…
    expect(Object.keys(store.getState().specDriven.runs)).toHaveLength(0);
    const finalized = apiRef.current!.getMessages().find((m) => m.specDriven);
    expect(finalized.specDriven.liveKey).toBeUndefined();
    expect(finalized.specDriven.status).toBe('error');
    const notice = finalized.specDriven.warnings.find((w: any) =>
      /went quiet/.test(w.message),
    );
    expect(notice).toBeTruthy();
    expect(notice.severity).toBe('error');
    // …the chat explains the condition (this copy is what a Report-issue
    // log carries, so a future stall self-identifies)…
    expect(
      apiRef.current!.getMessages().some(
        (m) => m.isError && /went quiet/.test(m.content ?? ''),
      ),
    ).toBe(true);
    // …the global run slot is released, and the outcome reported once.
    expect(store.getState().specDriven.runStatus).toBe('idle');
    expect(onRunFinished).toHaveBeenCalledTimes(1);
    expect(onRunFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        errorCode: 'INTERNAL',
        runId: '9b851145aaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    );
  });

  it('a healthy stream that completes within pauses shorter than the bound is untouched', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        c.enqueue(encoder.encode(START_FRAME));
        c.enqueue(encoder.encode(SELECT_FRAME));
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const store = makeStore();
    const apiRef: { current: HarnessAPI | null } = { current: null };
    render(
      <Provider store={store}>
        <Harness apiRef={apiRef} />
      </Provider>,
    );

    let run: Promise<void> = Promise.resolve();
    await act(async () => {
      run = apiRef.current!.handleTrigger(PAYLOAD);
      await flushMicrotasks();
    });

    // 40s pause (inside the 60s bound), then the run finishes normally.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
      controller.enqueue(
        encoder.encode(
          'event: done\ndata: {"event":"done","runId":"9b851145aaaaaaaaaaaaaaaaaaaaaaaa",' +
            '"downloadUrl":"/besser_api/spec-driven/download/9b851145aaaaaaaaaaaaaaaaaaaaaaaa",' +
            '"fileName":"out.zip","isZip":true,"recipe":{}}\n\n',
        ),
      );
      controller.close();
      await flushMicrotasks();
      await run;
    });

    const finalized = apiRef.current!.getMessages().find((m) => m.specDriven);
    expect(finalized.specDriven.status).toBe('done');
    expect(finalized.specDriven.warnings).toHaveLength(0);
    expect(store.getState().specDriven.runStatus).toBe('idle');
  });
});
