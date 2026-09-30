import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {
  agentSimulationReducer,
  appendStdoutLine,
  reportRuntimeError,
  restartAgentSimulationThunk,
  setError,
  startAgentSimulationThunk,
  stopAgentSimulationThunk,
  validateAgentThunk,
} from '@/main/features/agent-simulation/agentSimulationSlice';
import { agentSimulationCredentialStore } from '@/main/features/agent-simulation/credentialStore';
import {
  buildAgentSimulationAuthFrame,
  getAgentSimulationWebSocketUrl,
  toWebSocketBaseUrl,
} from '@/main/shared/api/agentSimulation';

const makeStore = () => configureStore({ reducer: { agentSimulation: agentSimulationReducer } });

const payload = { title: 'Greeter', model: { elements: {} }, config: { agentPlatform: 'websocket' } };
const credentials = { openAiApiKey: 'sk-secret' };

interface MockResponseInit {
  status?: number;
  body?: unknown;
}

function mockResponse({ status = 200, body = {} }: MockResponseInit = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status text',
    json: async () => body,
  };
}

const fetchMock = vi.fn();

function lastRequest(index = fetchMock.mock.calls.length - 1) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return {
    url,
    init,
    headers: init.headers as Record<string, string>,
    body: init.body ? JSON.parse(init.body as string) : undefined,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  agentSimulationCredentialStore.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('agentSimulation slice — lifecycle', () => {
  it('start → validate → running, with credentials sent but kept out of Redux', async () => {
    const store = makeStore();
    sessionStorage.setItem('github_session', 'gh-123');

    fetchMock.mockResolvedValueOnce(
      mockResponse({ body: { valid: true, agentCode: 'print(1)', eventList: ['e1'], errors: [] } }),
    );
    const validation = await store.dispatch(validateAgentThunk(payload));
    expect(validateAgentThunk.fulfilled.match(validation)).toBe(true);
    expect(store.getState().agentSimulation.status).toBe('idle');
    expect(store.getState().agentSimulation.agentCode).toBe('print(1)');
    expect(lastRequest().url).toMatch(/\/simulation\/validate$/);
    expect(lastRequest().headers['X-GitHub-Session']).toBe('gh-123');

    agentSimulationCredentialStore.set(credentials);
    fetchMock.mockResolvedValueOnce(mockResponse({ body: { sessionId: 'sess-1', eventList: ['e1', 'e2'] } }));
    const pending = store.dispatch(startAgentSimulationThunk(payload));
    expect(store.getState().agentSimulation.status).toBe('starting');
    await pending;

    const state = store.getState().agentSimulation;
    expect(state.status).toBe('running');
    expect(state.sessionId).toBe('sess-1');
    expect(state.eventList).toEqual(['e1', 'e2']);
    expect(state.startPayload).toEqual(payload);
    expect(JSON.stringify(state)).not.toContain('sk-secret');

    const start = lastRequest();
    expect(start.url).toMatch(/\/simulation\/sessions$/);
    expect(start.init.method).toBe('POST');
    expect(start.body.credentials).toEqual(credentials);
  });

  it('stop → idle, clears session, payload and the credential store', async () => {
    const store = makeStore();
    agentSimulationCredentialStore.set(credentials);
    fetchMock.mockResolvedValueOnce(mockResponse({ body: { sessionId: 'sess-1' } }));
    await store.dispatch(startAgentSimulationThunk(payload));

    fetchMock.mockResolvedValueOnce(mockResponse({ body: { ok: true } }));
    await store.dispatch(stopAgentSimulationThunk());

    const state = store.getState().agentSimulation;
    expect(state.status).toBe('idle');
    expect(state.sessionId).toBeNull();
    expect(state.startPayload).toBeNull();
    expect(agentSimulationCredentialStore.get()).toBeUndefined();
    expect(lastRequest().url).toMatch(/\/simulation\/sessions\/sess-1$/);
    expect(lastRequest().init.method).toBe('DELETE');
  });

  it('stop still resets to idle when the DELETE fails', async () => {
    const store = makeStore();
    fetchMock.mockResolvedValueOnce(mockResponse({ body: { sessionId: 'sess-1' } }));
    await store.dispatch(startAgentSimulationThunk(payload));

    fetchMock.mockResolvedValueOnce(mockResponse({ status: 500, body: { detail: 'boom' } }));
    await store.dispatch(stopAgentSimulationThunk());
    expect(store.getState().agentSimulation.status).toBe('idle');
  });

  it('restart re-uses the non-secret payload and the stored credentials', async () => {
    const store = makeStore();
    agentSimulationCredentialStore.set(credentials);
    fetchMock.mockResolvedValueOnce(mockResponse({ body: { sessionId: 'sess-1' } }));
    await store.dispatch(startAgentSimulationThunk(payload));
    store.dispatch(appendStdoutLine('old output'));

    fetchMock
      .mockResolvedValueOnce(mockResponse({ body: { ok: true } })) // DELETE old session
      .mockResolvedValueOnce(mockResponse({ body: { sessionId: 'sess-2', eventList: ['x'] } }));
    await store.dispatch(restartAgentSimulationThunk());

    const state = store.getState().agentSimulation;
    expect(state.status).toBe('running');
    expect(state.sessionId).toBe('sess-2');
    expect(state.stdoutLines).toEqual([]);

    const deleteCall = lastRequest(1);
    expect(deleteCall.init.method).toBe('DELETE');
    expect(deleteCall.url).toMatch(/\/simulation\/sessions\/sess-1$/);

    const restart = lastRequest(2);
    expect(restart.init.method).toBe('POST');
    expect(restart.body).toEqual({ ...payload, credentials });
  });

  it('restart without a previous start is rejected with a message', async () => {
    const store = makeStore();
    const result = await store.dispatch(restartAgentSimulationThunk());
    expect(restartAgentSimulationThunk.rejected.match(result)).toBe(true);
    expect(store.getState().agentSimulation.status).toBe('error');
    expect(store.getState().agentSimulation.error).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the backend `detail` (not raw JSON) when start fails', async () => {
    const store = makeStore();
    fetchMock.mockResolvedValueOnce(
      mockResponse({ status: 401, body: { detail: 'GitHub authentication required for agent simulation.' } }),
    );
    await store.dispatch(startAgentSimulationThunk(payload));

    const state = store.getState().agentSimulation;
    expect(state.status).toBe('error');
    expect(state.error).toBe('GitHub authentication required for agent simulation.');
  });

  it('uses a translated fallback (not the raw network message) on network failure', async () => {
    const store = makeStore();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await store.dispatch(startAgentSimulationThunk(payload));
    const { error } = store.getState().agentSimulation;
    expect(error).toBeTruthy();
    expect(error).not.toBe('Failed to fetch');
  });

  it('records validation failures without changing the lifecycle status', async () => {
    const store = makeStore();
    fetchMock.mockResolvedValueOnce(mockResponse({ status: 400, body: { detail: 'Bad agent' } }));
    await store.dispatch(validateAgentThunk(payload));
    const state = store.getState().agentSimulation;
    expect(state.status).toBe('idle');
    expect(state.validationErrors).toEqual(['Bad agent']);
  });
});

describe('agentSimulation slice — reducers', () => {
  it('reportRuntimeError writes to the terminal and leaves the status alone', async () => {
    const store = makeStore();
    fetchMock.mockResolvedValueOnce(mockResponse({ body: { sessionId: 'sess-1' } }));
    await store.dispatch(startAgentSimulationThunk(payload));

    store.dispatch(reportRuntimeError('intent classifier crashed'));
    const state = store.getState().agentSimulation;
    expect(state.status).toBe('running');
    expect(state.error).toBeNull();
    expect(state.stdoutLines).toEqual(['[error] intent classifier crashed']);
  });

  it('setError is a lifecycle error', () => {
    const store = makeStore();
    store.dispatch(setError('auth failed'));
    expect(store.getState().agentSimulation.status).toBe('error');
    expect(store.getState().agentSimulation.error).toBe('auth failed');
  });

  it('caps the terminal buffer', () => {
    const store = makeStore();
    for (let i = 0; i < 2005; i += 1) store.dispatch(appendStdoutLine(`line ${i}`));
    const lines = store.getState().agentSimulation.stdoutLines;
    expect(lines).toHaveLength(2000);
    expect(lines[lines.length - 1]).toBe('line 2004');
  });
});

describe('agentSimulation API helpers', () => {
  it('derives the WebSocket base from the backend URL', () => {
    expect(toWebSocketBaseUrl('https://editor.example.org/besser_api')).toBe('wss://editor.example.org/besser_api');
    expect(toWebSocketBaseUrl('http://localhost:9000/besser_api')).toBe('ws://localhost:9000/besser_api');
    expect(toWebSocketBaseUrl(undefined)).toBeNull();
    expect(getAgentSimulationWebSocketUrl('abc', 'https://x.org/api')).toBe('wss://x.org/api/simulation/abc/ws');
  });

  it('never puts the GitHub session in the WebSocket URL', () => {
    sessionStorage.setItem('github_session', 'gh-123');
    expect(getAgentSimulationWebSocketUrl('abc', 'https://x.org/api')).not.toContain('gh-123');
    expect(JSON.parse(buildAgentSimulationAuthFrame())).toEqual({ type: 'auth', githubSession: 'gh-123' });
  });

  it('sends an empty githubSession when signed out', () => {
    expect(JSON.parse(buildAgentSimulationAuthFrame())).toEqual({ type: 'auth', githubSession: '' });
  });
});
