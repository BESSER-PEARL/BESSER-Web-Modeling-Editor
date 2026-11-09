import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/api-client';

const captureEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/services/analytics/lazy-analytics', () => ({ captureEvent }));

const api = vi.hoisted(() => ({ startSession: vi.fn(), stopSession: vi.fn() }));
vi.mock('@/main/shared/api/agentSimulation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/main/shared/api/agentSimulation')>()),
  agentSimulationApi: api,
}));

import {
  agentSimulationReducer,
  startAgentSimulationThunk,
  stopAgentSimulationThunk,
} from '../agentSimulationSlice';
import { agentSimulationCredentialStore } from '../credentialStore';

const makeStore = () => configureStore({ reducer: { agentSimulation: agentSimulationReducer } });
const payload = { title: 'Secret agent', model: {}, config: {} };

describe('agent simulation analytics', () => {
  beforeEach(() => {
    captureEvent.mockClear();
    api.startSession.mockReset();
    api.stopSession.mockReset().mockResolvedValue(undefined);
    agentSimulationCredentialStore.clear();
  });

  it('tracks a failed start with the error kind, and no started event', async () => {
    api.startSession.mockRejectedValue(new ApiError(503, 'sandbox full'));
    await makeStore().dispatch(startAgentSimulationThunk(payload));

    expect(captureEvent).toHaveBeenCalledWith('agent_simulation_start_failed', {
      reason: 'start',
      error_type: 'ApiError',
      http_status: 503,
      network_error: false,
    });
    expect(captureEvent).not.toHaveBeenCalledWith('agent_simulation_started', expect.anything());
  });

  it('tracks a started session with which key kinds it runs on, never the keys or title', async () => {
    api.startSession.mockResolvedValue({ sessionId: 's1', eventList: [] });
    agentSimulationCredentialStore.set({ openAiApiKey: 'sk-secret' });
    const store = makeStore();
    await store.dispatch(startAgentSimulationThunk(payload));

    expect(captureEvent).toHaveBeenCalledWith('agent_simulation_started', {
      key_mode: 'own',
      has_openai_key: true,
      has_hf_token: false,
      has_replicate_key: false,
    });

    await store.dispatch(stopAgentSimulationThunk('stop_button'));
    expect(captureEvent).toHaveBeenCalledWith(
      'agent_simulation_stopped',
      expect.objectContaining({ source: 'stop_button', duration_s: expect.any(Number) }),
    );
    expect(JSON.stringify(captureEvent.mock.calls)).not.toMatch(/sk-secret|Secret agent/);
  });
});
