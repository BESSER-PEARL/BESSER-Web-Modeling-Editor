/**
 * A request days after the last run: the run must start from the linked repo's
 * code. Before, the expired run made it a fresh build from the model.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { store } from '@/main/app/store/store';
import { conversationStore } from '@/main/features/assistant';
import { useSpecDrivenTrigger } from '@/main/features/spec-driven/hooks/useSpecDrivenTrigger';
import { writeProjectLastRun } from '@/main/features/spec-driven/storage';
import type { TriggerSpecDrivenPayload } from '@/main/features/spec-driven/types';
import * as sseClient from '@/main/features/spec-driven/services/specDrivenSseClient';
import * as confirm from '@/main/shared/services/confirm/globalConfirm';
import { markProjectGitHubSynced } from '@/main/shared/services/storage/projectGitHubLink';
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
  startSpecDrivenRun: vi.fn(() => ({
    controller: new AbortController(),
    abort: () => {},
    events: (async function* () {})(),
  })),
}));

vi.mock('@/main/shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return { ...mod, getSpecDrivenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)) };
});

vi.mock('@/main/features/spec-driven/services/modelChange', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return { ...mod, fetchModelChange: vi.fn(async () => null) };
});

vi.mock('@/main/shared/services/confirm/globalConfirm', () => ({ globalConfirm: vi.fn() }));

const importRepoAsRun = vi.fn();
vi.mock('@/main/shared/api/github', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  importRepoAsRun: (...args: unknown[]) => importRepoAsRun(...args),
}));
vi.mock('@/main/shared/services/github/githubAuth', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getGitHubSession: () => 'session-token',
}));

const PROJECT_ID = 'proj-linked-repo';
const PROJECT = {
  id: PROJECT_ID,
  name: 'P',
  diagrams: { ClassDiagram: [{ id: 'cd1', title: 'd', model: {} }] },
  currentDiagramIndices: { ClassDiagram: 0 },
} as any;
const EXPIRED = 'a'.repeat(32);
const IMPORTED = 'b'.repeat(32);
const SYNCED = 'c'.repeat(40);
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

type TriggerFn = (p: TriggerSpecDrivenPayload) => Promise<void>;

function Surface({ apiRef }: { apiRef: { current: TriggerFn | null } }) {
  const [, setIsGenerating] = React.useState(false);
  const currentProjectRef = React.useRef<any>(PROJECT);
  apiRef.current = useSpecDrivenTrigger({
    currentProjectRef,
    setMessages: conversationStore.setMessages,
    setIsGenerating,
  }).handleTrigger;
  return null;
}

const PAYLOAD: TriggerSpecDrivenPayload = {
  action: 'trigger_smart_generator',
  instructions: 'add a search bar',
  provider: 'anthropic',
  message: 'Starting…',
  planApproved: true,
};

const trigger = async (payload = PAYLOAD) => {
  const api: { current: TriggerFn | null } = { current: null };
  render(
    <Provider store={store}>
      <Surface apiRef={api} />
    </Provider>,
  );
  await act(async () => {
    await api.current!(payload);
  });
};

const chatText = () => conversationStore.getMessages().map((message: any) => String(message.content ?? '')).join('\n');

beforeEach(() => {
  localStorage.clear();
  sessionStorage.setItem(sessionStorageLlmApiKey, 'sk-test');
  sessionStorage.setItem(sessionStorageLlmProvider, 'anthropic');
  writeProjectLastRun(PROJECT_ID, EXPIRED, Date.now() - THREE_DAYS_MS);
  markProjectGitHubSynced({ owner: 'ana', repo: 'library', branch: 'main' }, PROJECT, SYNCED);
  importRepoAsRun.mockReset();
  importRepoAsRun.mockResolvedValue({
    run_id: IMPORTED, owner: 'ana', repo: 'library', branch: 'main', commit_sha: SYNCED,
    has_model: true, has_code: true, project: {}, recap: null,
  });
  vi.mocked(sseClient.startSpecDrivenRun).mockClear();
  vi.mocked(confirm.globalConfirm).mockReset();
});

afterEach(() => {
  cleanup();
  conversationStore.setMessages(() => []);
  sessionStorage.clear();
});

describe('useSpecDrivenTrigger on a project linked to GitHub', () => {
  it('edits the code on GitHub instead of rebuilding when the last run has expired', async () => {
    await trigger();
    await waitFor(() => expect(sseClient.startSpecDrivenRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(sseClient.startSpecDrivenRun).mock.calls[0][0]).toMatchObject({ mode: 'modify', baseRunId: IMPORTED });
    expect(chatText()).toContain('Continuing from');
  });

  it('starts no run and explains when local model changes would overwrite newer commits', async () => {
    importRepoAsRun.mockResolvedValue({
      run_id: IMPORTED, owner: 'ana', repo: 'library', branch: 'main', commit_sha: 'd'.repeat(40),
      has_model: true, has_code: true, project: {}, recap: null,
    });
    markProjectGitHubSynced({ owner: 'ana', repo: 'library', branch: 'main' }, { ...PROJECT, name: 'x', diagrams: {} }, SYNCED);
    await trigger();
    expect(sseClient.startSpecDrivenRun).not.toHaveBeenCalled();
    expect(chatText()).toContain('Save to GitHub');
  });

  it('starts no run when the user cancels the rebuild question', async () => {
    importRepoAsRun.mockRejectedValue(new Error('network'));
    vi.mocked(confirm.globalConfirm).mockResolvedValue(false);
    await trigger();
    expect(sseClient.startSpecDrivenRun).not.toHaveBeenCalled();
  });

  it('rebuilds only when the user agrees', async () => {
    importRepoAsRun.mockRejectedValue(new Error('network'));
    vi.mocked(confirm.globalConfirm).mockResolvedValue(true);
    await trigger();
    await waitFor(() => expect(sseClient.startSpecDrivenRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(sseClient.startSpecDrivenRun).mock.calls[0][0]).toMatchObject({ mode: 'generate' });
  });

  it('leaves a request that names its own mode alone', async () => {
    await trigger({ ...PAYLOAD, mode: 'generate' });
    await waitFor(() => expect(sseClient.startSpecDrivenRun).toHaveBeenCalledTimes(1));
    expect(importRepoAsRun).not.toHaveBeenCalled();
  });
});
