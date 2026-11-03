/**
 * Every Spec-Driven run sends `spec_run_started` and exactly one terminal event
 * (completed / failed / cancelled), and a run that cannot start says why.
 * Real fetch-level stream, SSE client, hook and store; only the analytics
 * `track`, the config fetch and toasts are mocked.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { specDrivenReducer } from '../../state/specDrivenSlice';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { useSpecDrivenTrigger } from '../useSpecDrivenTrigger';
import type { TriggerSpecDrivenPayload } from '../../types';
import { track } from '../../../../shared/services/analytics/events';
import {
  sessionStorageLlmApiKey,
  sessionStorageLlmProvider,
} from '../../../../shared/constants/constant';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../../shared/services/analytics/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/services/analytics/events')>()),
  track: vi.fn(),
}));

vi.mock('../../../../shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../../shared/services/specDrivenConfig')>();
  return {
    ...mod,
    getSpecDrivenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)),
  };
});

const encoder = new TextEncoder();
const RUN_ID = '9b851145aaaaaaaaaaaaaaaaaaaaaaaa';
const START_FRAME =
  `event: start\ndata: {"event":"start","runId":"${RUN_ID}",` +
  '"provider":"anthropic","maxCost":1.0,"maxRuntime":900}\n\n';
const DONE_FRAME =
  `event: done\ndata: {"event":"done","runId":"${RUN_ID}",` +
  `"downloadUrl":"/besser_api/spec-driven/download/${RUN_ID}",` +
  '"fileName":"out.zip","isZip":true,"fileCount":12,"tokensUsed":3400,' +
  '"recipe":{"generator_used":"fastapi"}}\n\n';
const ERROR_FRAME = 'event: error\ndata: {"event":"error","code":"UPSTREAM_LLM","message":"Acme model said no"}\n\n';

/** An SSE response that delivers `frames` and closes. */
function streamOf(frames: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function makeStore() {
  return configureStore({
    reducer: { workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer },
  });
}

function Harness(props: { apiRef: { current: ((p: TriggerSpecDrivenPayload) => Promise<void>) | null } }) {
  const [, setMessages] = React.useState<any[]>([]);
  const [, setIsGenerating] = React.useState(false);
  const currentProjectRef = React.useRef<any>({
    id: 'analytics-project',
    name: 'AcmeSecretProject',
    diagrams: { ClassDiagram: [{ id: 'cd1', title: 'd', model: {} }] },
    currentDiagramIndices: { ClassDiagram: 0 },
  });
  const hook = useSpecDrivenTrigger({ currentProjectRef, setMessages, setIsGenerating });
  props.apiRef.current = hook.handleTrigger;
  return null;
}

const PAYLOAD: TriggerSpecDrivenPayload = {
  action: 'trigger_smart_generator',
  instructions: 'build the Acme booking app',
  provider: 'anthropic',
  message: 'Starting…',
  planApproved: true,
};

const flushMicrotasks = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

async function runOnce(response: Response): Promise<void> {
  globalThis.fetch = vi.fn().mockResolvedValue(response);
  const apiRef: { current: ((p: TriggerSpecDrivenPayload) => Promise<void>) | null } = { current: null };
  render(
    <Provider store={makeStore()}>
      <Harness apiRef={apiRef} />
    </Provider>,
  );
  await act(async () => {
    await apiRef.current!(PAYLOAD);
    await flushMicrotasks();
  });
}

const sent = (event: string) => vi.mocked(track).mock.calls.filter(([name]) => name === event).map(([, props]) => props);
const terminalEvents = () =>
  vi.mocked(track).mock.calls.filter(([name]) =>
    ['spec_run_completed', 'spec_run_failed', 'spec_run_cancelled'].includes(name),
  );

describe('Spec-Driven run analytics', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.mocked(track).mockClear();
    window.sessionStorage.clear();
    window.localStorage?.clear();
    window.sessionStorage.setItem(sessionStorageLlmApiKey, 'sk-test');
    window.sessionStorage.setItem(sessionStorageLlmProvider, 'anthropic');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.sessionStorage.clear();
    window.localStorage?.clear();
  });

  it('sends started, then completed with the result facts', async () => {
    await runOnce(streamOf([START_FRAME, DONE_FRAME]));

    expect(sent('spec_run_started')).toEqual([
      expect.objectContaining({ tier: 'own_key', provider: 'anthropic', run_mode: 'generate', reattached: false }),
    ]);
    expect(terminalEvents()).toHaveLength(1);
    expect(sent('spec_run_completed')[0]).toMatchObject({
      outcome: 'success',
      generator_used: 'fastapi',
      file_count: 12,
      tokens_used: 3400,
      is_zip: true,
      run_mode: 'generate',
      duration_ms: expect.any(Number),
    });
  });

  it('reports a server error as failed at the server stage, without its message', async () => {
    await runOnce(streamOf([START_FRAME, ERROR_FRAME]));

    expect(terminalEvents()).toHaveLength(1);
    expect(sent('spec_run_failed')[0]).toMatchObject({ error_code: 'UPSTREAM_LLM', stage: 'server' });
    expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toMatch(/Acme/);
  });

  it('reports a rejected start request with its HTTP status', async () => {
    await runOnce(new Response('busy', { status: 503 }));

    expect(terminalEvents()).toHaveLength(1);
    expect(sent('spec_run_failed')[0]).toMatchObject({
      error_code: 'INTERNAL',
      stage: 'stream',
      error_type: 'SseHttpError',
      http_status: 503,
      network_error: false,
    });
  });

  it('reports a stream that closes without a result', async () => {
    await runOnce(streamOf([START_FRAME]));

    expect(terminalEvents()).toHaveLength(1);
    expect(sent('spec_run_failed')[0]).toMatchObject({ stage: 'stream', error_type: 'Error', events_received: 1 });
  });

  it('runs a first keyless run on the free tier when the server offers it', async () => {
    const { getSpecDrivenConfig, FALLBACK_SMART_GEN_CONFIG } = await import('../../../../shared/services/specDrivenConfig');
    const withFreeTier = { ...FALLBACK_SMART_GEN_CONFIG, free_tier: { available: true, model: null, models: [] } };
    vi.mocked(getSpecDrivenConfig).mockResolvedValueOnce(withFreeTier).mockResolvedValueOnce(withFreeTier);
    window.sessionStorage.clear();
    await runOnce(streamOf([START_FRAME, DONE_FRAME]));

    expect(sent('spec_run_started')[0]).toMatchObject({ tier: 'free', provider: 'free' });
    expect(sent('spec_run_completed')).toHaveLength(1);
  });

  it('says a key is needed when the server offers no free tier', async () => {
    // The fallback config (no server) offers none.
    window.sessionStorage.clear();
    await runOnce(streamOf([]));

    expect(sent('spec_run_blocked')).toEqual([{ reason: 'needs_key' }]);
    expect(sent('spec_run_started')).toHaveLength(0);
  });
});
