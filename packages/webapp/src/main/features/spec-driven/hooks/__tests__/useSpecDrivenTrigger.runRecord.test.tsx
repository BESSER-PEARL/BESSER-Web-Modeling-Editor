/**
 * What a finished run leaves in the project's last-run record: the base of the
 * next modify run, and the request it was started with.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/main/app/store/store';
import { conversationStore } from '@/main/features/assistant';
import { useSpecDrivenTrigger } from '@/main/features/spec-driven/hooks/useSpecDrivenTrigger';
import { readProjectLastRun } from '@/main/features/spec-driven/storage';
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

/** Start a run whose stream yields `events`, and wait until it has ended. */
async function runWith(events: SpecDrivenEvent[], instructions: string) {
  vi.mocked(sseClient.startSpecDrivenRun).mockImplementation((params) => {
    params.onRunAccepted?.(RUN);
    return {
      controller: new AbortController(),
      abort: () => {},
      events: (async function* () {
        for (const event of events) yield event;
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

const done = (overrides: Partial<Extract<SpecDrivenEvent, { event: 'done' }>> = {}): SpecDrivenEvent => ({
  event: 'done',
  runId: RUN,
  downloadUrl: `/spec-driven/download/${RUN}`,
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
      [{ event: 'start', runId: RUN, provider: 'anthropic' } as SpecDrivenEvent, done()],
      "## Assistant's notes (may be inaccurate)\n\nNotes.\n\n## The user's original request, verbatim\n\nBuild a task board.",
    );
    const record = readProjectLastRun(PROJECT_ID);
    expect(record?.runId).toBe(RUN);
    expect(record?.request).toBe("## The user's original request, verbatim\n\nBuild a task board.");
  });
});
