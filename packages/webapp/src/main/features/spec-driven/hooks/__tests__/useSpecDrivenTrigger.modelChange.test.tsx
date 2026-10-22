/**
 * A second run within the modify window used to edit the previous app in
 * place whatever the model became: an unrelated model produced two apps side
 * by side (#659). Now an automatic modify first asks the backend how far the
 * model moved, and a large change or another app is the user's call. The
 * check and the question come before the run slot is claimed and before any
 * run card appears.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/main/app/store/store';
import { conversationStore } from '@/main/features/assistant/hooks/assistantConversationStore';
import { useSpecDrivenTrigger } from '@/main/features/spec-driven/hooks/useSpecDrivenTrigger';
import type { SpecDrivenRunResult } from '@/main/features/spec-driven/hooks/useSpecDrivenTrigger';
import { writeProjectLastRun } from '@/main/features/spec-driven/storage';
import type { TriggerSpecDrivenPayload } from '@/main/features/spec-driven/types';
import * as sseClient from '@/main/features/spec-driven/services/specDrivenSseClient';
import * as modelChange from '@/main/features/spec-driven/services/modelChange';
import * as confirm from '@/main/shared/services/confirm/globalConfirm';
import {
  sessionStorageSpecDrivenApiKey,
  sessionStorageSpecDrivenProvider,
} from '@/main/shared/constants/constant';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/main/features/spec-driven/services/specDrivenSseClient', () => ({
  followSpecDrivenRun: vi.fn(() => ({
    controller: new AbortController(),
    abort: vi.fn(),
    events: (async function* () {})(),
  })),
  startSpecDrivenRun: vi.fn(() => ({
    controller: new AbortController(),
    abort: () => {},
    events: (async function* () {})(),
  })),
}));

vi.mock('@/main/features/spec-driven/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return {
    ...mod,
    getSpecDrivenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)),
  };
});

vi.mock('@/main/features/spec-driven/services/modelChange', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return { ...mod, fetchModelChange: vi.fn() };
});

vi.mock('@/main/shared/services/confirm/globalConfirm', () => ({
  globalConfirm: vi.fn(),
}));

const PROJECT_ID = 'proj-model-change';
const BASE = 'c'.repeat(32);

type TriggerFn = (p: TriggerSpecDrivenPayload) => Promise<void>;
const stopRef: { current: (() => void) | null } = { current: null };
const generating: { current: boolean } = { current: false };
const finished = vi.fn<(result: SpecDrivenRunResult) => void>();

function Surface({ apiRef }: { apiRef: { current: TriggerFn | null } }) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  generating.current = isGenerating;
  const currentProjectRef = React.useRef<any>({
    id: PROJECT_ID,
    name: 'P',
    diagrams: { ClassDiagram: [{ id: 'cd1', title: 'd', model: {} }] },
    currentDiagramIndices: { ClassDiagram: 0 },
  });
  const hook = useSpecDrivenTrigger({
    currentProjectRef,
    setMessages: conversationStore.setMessages,
    setIsGenerating,
    onRunFinished: finished,
  });
  apiRef.current = hook.handleTrigger;
  stopRef.current = hook.abortActive;
  return null;
}

const PAYLOAD: TriggerSpecDrivenPayload = {
  action: 'trigger_smart_generator',
  instructions: 'Build the library app',
  provider: 'anthropic',
  message: 'Starting…',
  planApproved: true,
};

function mount() {
  const api: { current: TriggerFn | null } = { current: null };
  render(
    <Provider store={store}>
      <Surface apiRef={api} />
    </Provider>,
  );
  return api;
}

async function trigger(payload: TriggerSpecDrivenPayload = PAYLOAD) {
  const api = mount();
  await act(async () => {
    await api.current!(payload);
  });
  await waitFor(() => expect(vi.mocked(sseClient.startSpecDrivenRun)).toHaveBeenCalledTimes(1));
  return vi.mocked(sseClient.startSpecDrivenRun).mock.calls[0][0];
}

/** Nothing of a run is visible yet: no slot, no intro line, no card. */
function noRunYet() {
  expect(store.getState().specDriven.runStatus).toBe('idle');
  expect(conversationStore.getMessages()).toEqual([]);
  expect(vi.mocked(sseClient.startSpecDrivenRun)).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  conversationStore.clear();
  window.sessionStorage.clear();
  window.localStorage?.clear();
  window.sessionStorage.setItem(sessionStorageSpecDrivenApiKey, 'sk-test');
  window.sessionStorage.setItem(sessionStorageSpecDrivenProvider, 'anthropic');
  writeProjectLastRun(PROJECT_ID, BASE, Date.now() - 60_000);
});

afterEach(() => {
  cleanup();
  conversationStore.clear();
  window.localStorage?.clear();
});

describe('second run: the model changed since the base app', () => {
  it('asks on an unrelated model and starts fresh when the user chooses so', async () => {
    vi.mocked(modelChange.fetchModelChange).mockResolvedValue({ verdict: 'unrelated', gone: 0.86, removed: ['Room'], added: ['Book'] });
    vi.mocked(confirm.globalConfirm).mockResolvedValue(true);

    const params = await trigger();

    expect(vi.mocked(modelChange.fetchModelChange)).toHaveBeenCalledWith(
      expect.anything(), PAYLOAD.instructions, BASE, expect.any(AbortSignal),
    );
    expect(vi.mocked(confirm.globalConfirm)).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: 'Start fresh', cancelLabel: 'Update the existing app' }),
    );
    expect(params.mode).toBe('generate');
    expect(params.baseRunId).toBeUndefined();
  });

  it('updates the existing app when the user keeps it on a large change', async () => {
    vi.mocked(modelChange.fetchModelChange).mockResolvedValue({ verdict: 'large', gone: 0.64, removed: ['Room.price'], added: [] });
    vi.mocked(confirm.globalConfirm).mockResolvedValue(false);

    const params = await trigger();

    expect(vi.mocked(confirm.globalConfirm)).toHaveBeenCalledTimes(1);
    expect(params.mode).toBe('modify');
    expect(params.baseRunId).toBe(BASE);
  });

  it('does not ask on a small change, nor when the comparison is unavailable', async () => {
    vi.mocked(modelChange.fetchModelChange).mockResolvedValue({ verdict: 'small', gone: 0, removed: [], added: [] });
    expect((await trigger()).mode).toBe('modify');
    cleanup();
    vi.mocked(sseClient.startSpecDrivenRun).mockClear();

    vi.mocked(modelChange.fetchModelChange).mockResolvedValue(null);
    expect((await trigger()).mode).toBe('modify');
    expect(vi.mocked(confirm.globalConfirm)).not.toHaveBeenCalled();
  });

  it('leaves an explicit mode from the agent alone', async () => {
    const params = await trigger({ ...PAYLOAD, mode: 'modify', baseRunId: BASE });
    expect(params.mode).toBe('modify');
    expect(vi.mocked(modelChange.fetchModelChange)).not.toHaveBeenCalled();
  });
});

describe('second run: the question comes before the run', () => {
  it('shows no run card and claims no slot until the user answers', async () => {
    let answer: ((startFresh: boolean) => void) | undefined;
    vi.mocked(modelChange.fetchModelChange).mockImplementation(async () => {
      noRunYet();
      return { verdict: 'unrelated', gone: 0.9, removed: ['Room'], added: ['Book'] };
    });
    vi.mocked(confirm.globalConfirm).mockImplementation(
      () => new Promise((resolve) => { answer = resolve; }),
    );
    const api = mount();
    let running: Promise<void> | undefined;
    act(() => { running = api.current!(PAYLOAD); });
    await waitFor(() => expect(answer).toBeDefined());

    noRunYet();

    await act(async () => {
      answer!(true);
      await running;
    });
    expect(vi.mocked(sseClient.startSpecDrivenRun)).toHaveBeenCalledTimes(1);
    const messages = conversationStore.getMessages();
    expect(messages[0]?.content).toBe(PAYLOAD.message);
    expect(messages.some((m) => (m as { specDriven?: unknown }).specDriven)).toBe(true);
  });

  it('keeps Stop available during the check', async () => {
    let finish: ((change: null) => void) | undefined;
    vi.mocked(modelChange.fetchModelChange).mockImplementation(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    const api = mount();
    let running: Promise<void> | undefined;
    act(() => { running = api.current!(PAYLOAD); });
    await waitFor(() => expect(finish).toBeDefined());

    // The composer shows Stop while generating; the run card is not there yet.
    expect(generating.current).toBe(true);
    noRunYet();

    await act(async () => {
      finish!(null);
      await running;
    });
    expect(vi.mocked(sseClient.startSpecDrivenRun)).toHaveBeenCalledTimes(1);
  });

  it('refuses a second trigger while the question is open', async () => {
    vi.mocked(modelChange.fetchModelChange).mockResolvedValue({ verdict: 'large', gone: 0.6, removed: [], added: [] });
    let answer: ((startFresh: boolean) => void) | undefined;
    vi.mocked(confirm.globalConfirm).mockImplementation(
      () => new Promise((resolve) => { answer = resolve; }),
    );
    const api = mount();
    let running: Promise<void> | undefined;
    act(() => { running = api.current!(PAYLOAD); });
    await waitFor(() => expect(answer).toBeDefined());

    await act(async () => { await api.current!(PAYLOAD); });
    expect(vi.mocked(confirm.globalConfirm)).toHaveBeenCalledTimes(1);
    expect(conversationStore.getMessages().map((m) => m.content)).toEqual([
      expect.stringContaining('already running'),
    ]);

    await act(async () => {
      answer!(false);
      await running;
    });
    expect(vi.mocked(sseClient.startSpecDrivenRun)).toHaveBeenCalledTimes(1);
  });

  it('stop while the model check is pending: no card, no run, the agent hears it was cancelled', async () => {
    let checkSignal: AbortSignal | undefined;
    vi.mocked(modelChange.fetchModelChange).mockImplementation(
      (_p, _i, _b, signal) => new Promise((resolve) => {
        checkSignal = signal;
        signal?.addEventListener('abort', () => resolve(null));
      }),
    );
    const api = mount();
    let running: Promise<void> | undefined;
    act(() => { running = api.current!(PAYLOAD); });
    await waitFor(() => expect(checkSignal).toBeDefined());
    act(() => stopRef.current!());
    await act(async () => { await running; });

    expect(checkSignal!.aborted).toBe(true);
    noRunYet();
    expect(generating.current).toBe(false);
    expect(finished).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledWith(expect.objectContaining({ ok: false, errorCode: 'CANCELLED' }));
  });

  it('stop while the question is open closes it and the run never starts', async () => {
    vi.mocked(modelChange.fetchModelChange).mockResolvedValue({ verdict: 'large', gone: 0.64, removed: [], added: [] });
    let dialogSignal: AbortSignal | undefined;
    vi.mocked(confirm.globalConfirm).mockImplementation(
      (options) => new Promise((resolve) => {
        dialogSignal = options.signal;
        options.signal?.addEventListener('abort', () => resolve(false));
      }),
    );
    const api = mount();
    let running: Promise<void> | undefined;
    act(() => { running = api.current!(PAYLOAD); });
    await waitFor(() => expect(dialogSignal).toBeDefined());
    act(() => stopRef.current!());
    await act(async () => { await running; });

    expect(dialogSignal!.aborted).toBe(true);
    noRunYet();
    expect(finished).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'CANCELLED' }));
  });
});
