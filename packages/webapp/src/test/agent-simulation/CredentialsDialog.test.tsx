import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { agentSimulationReducer } from '@/main/features/agent-simulation/agentSimulationSlice';
import { agentSimulationCredentialStore } from '@/main/features/agent-simulation/credentialStore';
import { CredentialsDialog } from '@/main/features/agent-simulation/CredentialsDialog';

const fetchMock = vi.fn();

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function renderDialog(onOpenChange = vi.fn()) {
  const store = configureStore({ reducer: { agentSimulation: agentSimulationReducer } });
  render(
    <Provider store={store}>
      <CredentialsDialog
        open
        onOpenChange={onOpenChange}
        diagramTitle="Greeter"
        diagramModel={{ elements: {} }}
        diagramConfig={{ agentPlatform: 'websocket' }}
      />
    </Provider>,
  );
  return { store, onOpenChange };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  agentSimulationCredentialStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CredentialsDialog', () => {
  it('renders the title, key inputs and fetches the limits', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ memoryMb: 512 }));
    renderDialog();

    expect(screen.getByText('Simulate Agent: Greeter')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('hf_...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('r8_...')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/simulation\/limits$/);
  });

  it('submits without putting the API keys into Redux', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).endsWith('/simulation/sessions') ? jsonResponse({ sessionId: 'sess-1' }) : jsonResponse({}),
    );
    const { store, onOpenChange } = renderDialog();

    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-secret' } });
    fireEvent.click(screen.getByRole('button', { name: /Start Simulation/ }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(store.getState().agentSimulation.status).toBe('running'));

    const state = store.getState().agentSimulation;
    expect(state.startPayload).toEqual({
      title: 'Greeter',
      model: { elements: {} },
      config: { agentPlatform: 'websocket' },
      configYaml: undefined,
    });
    expect(JSON.stringify(state)).not.toContain('sk-secret');
    expect(agentSimulationCredentialStore.get()).toEqual({ openAiApiKey: 'sk-secret' });

    const startCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/simulation/sessions'));
    expect(startCall).toBeDefined();
    const body = JSON.parse((startCall![1] as RequestInit).body as string);
    expect(body.credentials).toEqual({ openAiApiKey: 'sk-secret' });
  });
});
