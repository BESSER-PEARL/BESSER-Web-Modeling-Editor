/**
 * A request made after the last run's workspace expired, while the server
 * still keeps its download: the server edits the app from that download, so
 * the run edits it in place. Whether it can is the server's answer, not the
 * browser's clock.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/main/app/store/store';
import { conversationStore } from '@/main/features/assistant';
import { useSpecDrivenTrigger } from '@/main/features/spec-driven/hooks/useSpecDrivenTrigger';
import { readLastGeneration } from '@/main/features/spec-driven/lastGeneration';
import { writeProjectLastRun } from '@/main/features/spec-driven/storage';
import type { SpecDrivenEvent, TriggerSpecDrivenPayload } from '@/main/features/spec-driven/types';
import * as sseClient from '@/main/features/spec-driven/services/specDrivenSseClient';
import { previewSpecDrivenRun } from '@/main/shared/api/specDriven';
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

const HOUR_S = 3600;
vi.mock('@/main/shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<any>();
  const config = { ...mod.FALLBACK_SMART_GEN_CONFIG, download_ttl_seconds: 3 * 3600, archive_ttl_seconds: 24 * 3600 };
  return {
    ...mod,
    getSpecDrivenConfig: vi.fn(() => Promise.resolve(config)),
    peekServerSpecDrivenConfig: vi.fn(() => config),
  };
});

vi.mock('@/main/shared/api/specDriven', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  previewSpecDrivenRun: vi.fn(),
}));

const PROJECT_ID = 'proj-archive-base';
const BASE = 'e'.repeat(32);
const RUN = 'f'.repeat(32);

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

/** Run a request to the end; the run's own parameters. */
async function trigger() {
  vi.mocked(sseClient.startSpecDrivenRun).mockImplementation((params) => {
    params.onRunAccepted?.(RUN);
    return {
      controller: new AbortController(),
      abort: () => {},
      events: (async function* () {
        yield { event: 'start', runId: RUN, provider: 'anthropic' } as SpecDrivenEvent;
        yield { event: 'done', runId: RUN, downloadUrl: `/spec-driven/download/${RUN}`, fileName: 'app.zip', isZip: true } as SpecDrivenEvent;
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
    await api.current!({ action: 'trigger_smart_generator', instructions: 'Add a due date to tasks.', planApproved: true });
  });
  await waitFor(() => expect(store.getState().specDriven.runStatus).toBe('idle'));
  return vi.mocked(sseClient.startSpecDrivenRun).mock.calls[0][0];
}

const preview = (fields: Record<string, unknown>) => ({ model_change: null, ...fields }) as never;

const notices = () =>
  conversationStore.getMessages().find((m) => m.specDriven)?.specDriven?.warnings ?? [];

const REBUILD_NOTICE = {
  code: 'BASE_EXPIRED',
  severity: 'info',
  message: 'The previous run can no longer be edited in place, so the application is rebuilt from the model and the original request.',
};

beforeEach(() => {
  vi.clearAllMocks();
  conversationStore.clear();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.sessionStorage.setItem(sessionStorageLlmApiKey, 'sk-test');
  window.sessionStorage.setItem(sessionStorageLlmProvider, 'anthropic');
  writeProjectLastRun(PROJECT_ID, BASE, Date.now() - 4 * HOUR_S * 1000);
});

afterEach(() => {
  cleanup();
});

describe('a request after the workspace expired, within the download lifetime', () => {
  it('edits the app when the server says it can, and tells the assistant it has not expired', async () => {
    expect(readLastGeneration(PROJECT_ID)?.expired).toBe(false);
    vi.mocked(previewSpecDrivenRun).mockResolvedValue(preview({ base_available: true }));

    const params = await trigger();

    expect(vi.mocked(previewSpecDrivenRun)).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'modify', base_run_id: BASE }), expect.anything(),
    );
    expect(params).toMatchObject({ mode: 'modify', baseRunId: BASE });
    expect(notices()).toEqual([]);
  });

  it('rebuilds, and says so on the card, when the server says it cannot', async () => {
    vi.mocked(previewSpecDrivenRun).mockResolvedValue(preview({ base_available: false }));

    const params = await trigger();

    expect(params.mode).toBe('generate');
    expect(params.baseRunId).toBeUndefined();
    expect(notices()).toEqual([REBUILD_NOTICE]);
  });

  it('rebuilds by the workspace lifetime, as before, when the server does not say', async () => {
    vi.mocked(previewSpecDrivenRun).mockResolvedValue(preview({}));

    const params = await trigger();

    expect(params.mode).toBe('generate');
    expect(notices()).toEqual([REBUILD_NOTICE]);
  });
});

describe('a request after the download lifetime', () => {
  it('rebuilds without asking the server, and the assistant hears the result expired', async () => {
    writeProjectLastRun(PROJECT_ID, BASE, Date.now() - 25 * HOUR_S * 1000);
    expect(readLastGeneration(PROJECT_ID)?.expired).toBe(true);

    const params = await trigger();

    expect(vi.mocked(previewSpecDrivenRun)).not.toHaveBeenCalled();
    expect(params.mode).toBe('generate');
    expect(notices()).toEqual([REBUILD_NOTICE]);
  });
});
