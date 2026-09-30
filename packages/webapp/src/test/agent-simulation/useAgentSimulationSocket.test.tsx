import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import {
  agentSimulationReducer,
  startAgentSimulationThunk,
} from '@/main/features/agent-simulation/agentSimulationSlice';
import { useAgentSimulationSocket } from '@/main/features/agent-simulation/useAgentSimulationSocket';

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  closeCalls: Array<number | undefined> = [];
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number) {
    this.closeCalls.push(code);
    this.readyState = MockWebSocket.CLOSED;
  }

  // --- test helpers ---
  serverOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  serverMessage(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent);
  }

  serverClose(code: number) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  }
}

const fetchMock = vi.fn();

async function setupRunningSession() {
  const store = configureStore({ reducer: { agentSimulation: agentSimulationReducer } });
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ sessionId: 'sess-1' }) });
  await store.dispatch(startAgentSimulationThunk({ title: 'A', model: {} }));
  const onBafFrame = vi.fn();
  const onRuntimeError = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => <Provider store={store}>{children}</Provider>;
  const hook = renderHook(
    ({ sessionId }: { sessionId: string | null }) => useAgentSimulationSocket(sessionId, { onBafFrame, onRuntimeError }),
    { wrapper, initialProps: { sessionId: 'sess-1' as string | null } },
  );
  const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
  return { store, hook, ws, onBafFrame, onRuntimeError };
}

beforeEach(() => {
  MockWebSocket.instances = [];
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('WebSocket', MockWebSocket);
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAgentSimulationSocket', () => {
  it('opens the session socket without credentials in the URL and sends the auth frame first', async () => {
    sessionStorage.setItem('github_session', 'gh-secret');
    const { hook, ws } = await setupRunningSession();

    expect(ws.url).toMatch(/^wss?:\/\/.+\/simulation\/sess-1\/ws$/);
    expect(ws.url).not.toContain('gh-secret');
    expect(hook.result.current.status).toBe('connecting');

    act(() => ws.serverOpen());
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'auth', githubSession: 'gh-secret' });
    expect(hook.result.current.status).toBe('connecting');

    act(() => ws.serverMessage({ type: 'auth_ok' }));
    expect(hook.result.current.status).toBe('connected');

    act(() => hook.result.current.send('user_message', 'hello'));
    expect(JSON.parse(ws.sent[1])).toEqual({ action: 'user_message', message: 'hello' });
  });

  it('routes state_change and stdout frames to the store', async () => {
    const { store, ws } = await setupRunningSession();
    act(() => {
      ws.serverOpen();
      ws.serverMessage({ type: 'state_change', state: 'greeting', transition: 'hi' });
      ws.serverMessage({ type: 'stdout', line: 'agent started' });
      ws.serverMessage('not json at all');
    });
    const state = store.getState().agentSimulation;
    expect(state.currentState).toBe('greeting');
    expect(state.lastTransition).toBe('hi');
    expect(state.stdoutLines).toEqual(['agent started', 'not json at all']);
  });

  it('forwards BAF frames to the chat handler', async () => {
    const { ws, onBafFrame } = await setupRunningSession();
    act(() => ws.serverMessage({ action: 'agent_reply_str', message: 'Hello!' }));
    expect(onBafFrame).toHaveBeenCalledWith({ action: 'agent_reply_str', message: 'Hello!' });
  });

  it('keeps the session running and the socket open on an agent runtime error', async () => {
    const { store, ws, hook, onRuntimeError } = await setupRunningSession();
    act(() => {
      ws.serverOpen();
      ws.serverMessage({ type: 'auth_ok' });
      ws.serverMessage({ type: 'error', message: 'LLM quota exceeded' });
    });

    const state = store.getState().agentSimulation;
    expect(state.status).toBe('running');
    expect(state.error).toBeNull();
    expect(state.stdoutLines).toContain('[error] LLM quota exceeded');
    expect(onRuntimeError).toHaveBeenCalledWith('LLM quota exceeded');
    expect(ws.closeCalls).toHaveLength(0);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(hook.result.current.status).toBe('connected');
  });

  it('turns a 4401 close into a lifecycle "authentication required" error', async () => {
    const { store, ws, hook } = await setupRunningSession();
    act(() => {
      ws.serverOpen();
      ws.serverClose(4401);
    });
    const state = store.getState().agentSimulation;
    expect(state.status).toBe('error');
    expect(state.error).toBeTruthy();
    expect(hook.result.current.status).toBe('error');
  });

  it('a normal close just marks the socket disconnected', async () => {
    const { store, ws, hook } = await setupRunningSession();
    act(() => {
      ws.serverOpen();
      ws.serverClose(1000);
    });
    expect(store.getState().agentSimulation.status).toBe('running');
    expect(hook.result.current.status).toBe('disconnected');
  });

  it('closes cleanly when the session ends and on unmount', async () => {
    const { hook, ws } = await setupRunningSession();
    act(() => ws.serverOpen());

    hook.rerender({ sessionId: null });
    expect(ws.closeCalls).toEqual([1000]);
    expect(hook.result.current.status).toBe('disconnected');

    hook.rerender({ sessionId: 'sess-2' });
    const second = MockWebSocket.instances[1];
    expect(second.url).toMatch(/\/simulation\/sess-2\/ws$/);
    act(() => second.serverOpen());
    hook.unmount();
    expect(second.closeCalls).toEqual([1000]);
  });
});
