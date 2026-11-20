/**
 * An assistant-requested generation (`trigger_generator`) reports its outcome
 * to the agent as a `generator_result` frontend event. When the model validates
 * with warnings and the user chooses to fix them first, the agent is told why
 * (`warnings_declined`) instead of only getting a failure.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { specDrivenReducer } from '../../../../features/spec-driven';
import { ApollonEditorProvider } from '../../../editors';
import type { GenerationResult } from '../../../generation';

const fake = vi.hoisted(() => ({
  actionHandlers: [] as Array<(payload: Record<string, unknown>) => void>,
  sendFrontendEvent: vi.fn(() => 'sent' as const),
  onRunFinished: undefined as undefined | ((result: Record<string, unknown>) => void),
}));

vi.mock('../../../spec-driven', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../spec-driven')>();
  return {
    ...actual,
    useSpecDrivenTrigger: (options: Parameters<typeof actual.useSpecDrivenTrigger>[0]) => {
      fake.onRunFinished = options.onRunFinished as typeof fake.onRunFinished;
      return actual.useSpecDrivenTrigger(options);
    },
  };
});

vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services')>();
  const noopUnsub = () => {};
  class FakeAssistantClient {
    onMessage() { return noopUnsub; }
    onConnection() { return noopUnsub; }
    onTyping() { return noopUnsub; }
    onInjection() { return noopUnsub; }
    onAction(handler: (payload: Record<string, unknown>) => void) {
      fake.actionHandlers.push(handler);
      return noopUnsub;
    }
    clearHandlers() {}
    connect() { return Promise.resolve(); }
    disconnect() {}
    resetSession() {}
    setContextProvider() {}
    setHistoryProvider() {}
    sendMessage() { return 'sent' as const; }
    sendVoiceMessage() { return 'sent' as const; }
    sendFrontendEvent = fake.sendFrontendEvent;
    get connected() { return true; }
    get connectionState() { return 'connected'; }
  }
  const sharedFake = new FakeAssistantClient();
  return { ...actual, AssistantClient: FakeAssistantClient, getSharedAssistantClient: () => sharedFake };
});

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { useAssistantLogic } from '../useAssistantLogic';

type Hook = ReturnType<typeof useAssistantLogic>;
type OnGenerate = NonNullable<Parameters<typeof useAssistantLogic>[0]['onGenerate']>;

function Harness({ apiRef, onGenerate }: { apiRef: { current: Hook | null }; onGenerate: OnGenerate }) {
  apiRef.current = useAssistantLogic({ isActive: true, switchDiagram: async () => true, onGenerate, surface: 'workspace' });
  return null;
}

function renderHarness(onGenerate: OnGenerate) {
  const apiRef: { current: Hook | null } = { current: null };
  const store = configureStore({
    reducer: { workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer },
  });
  render(
    <Provider store={store}>
      <ApollonEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Harness apiRef={apiRef} onGenerate={onGenerate} />
      </ApollonEditorProvider>
    </Provider>,
  );
  return apiRef;
}

const triggerGenerator = async (generatorType: string) => {
  await act(async () => {
    fake.actionHandlers.forEach((handler) => handler({ action: 'trigger_generator', generatorType }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('generator_result sent to the agent', () => {
  it('reports warnings_declined when the user chose to fix the validation warnings first', async () => {
    const declined: GenerationResult = {
      ok: false,
      error: 'Generation cancelled to fix the validation warnings',
      reason: 'warnings_declined',
    };
    const onGenerate = vi.fn<OnGenerate>().mockResolvedValue(declined);
    const apiRef = renderHarness(onGenerate);
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await triggerGenerator('sql');

    expect(onGenerate).toHaveBeenCalledWith('sql', undefined);
    expect(fake.sendFrontendEvent).toHaveBeenCalledTimes(1);
    expect(fake.sendFrontendEvent).toHaveBeenCalledWith('generator_result', {
      ok: false,
      message: 'Generation cancelled to fix the validation warnings',
      metadata: { generatorType: 'sql', reason: 'warnings_declined' },
    });
  });

});

describe('a Spec-Driven run reported to the agent', () => {
  it.each(['modify', 'create', undefined])('says the mode the run had (%s)', async (mode) => {
    const apiRef = renderHarness(vi.fn<OnGenerate>());
    await waitFor(() => expect(fake.onRunFinished).toBeDefined());
    expect(apiRef.current).not.toBeNull();

    fake.onRunFinished!({ ok: true, runId: 'r'.repeat(32), mode });

    expect(fake.sendFrontendEvent).toHaveBeenCalledWith('generator_result', expect.objectContaining({
      metadata: expect.objectContaining({ smart: true, mode }),
    }));
  });
});

describe('a Spec-Driven run reported to the agent, by what it could show', () => {
  const REASON =
    'The app was generated, but it was never started, so nothing shows it runs (its startup timed out).';
  const report = async (result: Record<string, unknown>) => {
    const apiRef = renderHarness(vi.fn<OnGenerate>());
    await waitFor(() => expect(fake.onRunFinished).toBeDefined());
    expect(apiRef.current).not.toBeNull();
    fake.onRunFinished!({ ok: true, runId: 'r'.repeat(32), fileName: 'app.zip', incomplete: false, ...result });
    const calls = fake.sendFrontendEvent.mock.calls;
    const [, payload] = calls[calls.length - 1] as unknown as [string, { message: string; metadata: Record<string, unknown> }];
    return payload;
  };

  it('says a run that is not verified is not verified, and sends the new fields', async () => {
    const { message, metadata } = await report({
      mode: 'create', blockerCount: 1, notConfirmedCount: 0, unresolvedBlockerCount: 0, unverified: true, unverifiedReason: REASON,
      verificationCounts: { verified: 0, notVerified: 1, shippedUnenforced: 0, failed: 2 },
    });
    expect(message).toBe(`Spec-Driven Agent generated the app, but it is NOT verified; app.zip is ready for the user to download. ${REASON}`);
    expect(metadata).toMatchObject({
      blockerCount: 1,
      notConfirmedCount: 0,
      unresolvedBlockerCount: 0,
      unverified: true,
      unverifiedReason: REASON,
      verification: { failed: 2 },
    });
  });

  it('says an edit that is not verified is an update that was not verified', async () => {
    const updated = 'The app was updated, but it was never started, so nothing shows it runs (its startup timed out).';
    const { message } = await report({
      mode: 'modify', blockerCount: 1, notConfirmedCount: 1, unresolvedBlockerCount: 0, unverified: true, unverifiedReason: updated,
    });
    expect(message).toBe(`Spec-Driven Agent updated the app, but the update is NOT verified; app.zip is ready for the user to download. ${updated}`);
  });

  it('states the real blocker of a run that is not verified', async () => {
    const { message } = await report({
      mode: 'create', blockerCount: 2, notConfirmedCount: 0, unresolvedBlockerCount: 1, unverified: true, unverifiedReason: REASON,
    });
    expect(message).toBe(
      `Spec-Driven Agent generated the app, but it is NOT verified; app.zip is ready for the user to download. ${REASON} `
      + '1 unresolved implementation or verification issue remains.',
    );
  });

  it('does not count a check switched off on the server as a blocker', async () => {
    const { message, metadata } = await report({
      blockerCount: 1, notConfirmedCount: 0, unresolvedBlockerCount: 0, unverified: false,
    });
    expect(message).toBe('Spec-Driven Agent finished successfully — app.zip is ready for the user to download.');
    expect(metadata).toMatchObject({ blockerCount: 1, notConfirmedCount: 0, unresolvedBlockerCount: 0 });
  });

  it('counts findings not confirmed apart from blockers', async () => {
    expect((await report({ blockerCount: 3, notConfirmedCount: 3, unresolvedBlockerCount: 0 })).message).toBe(
      'Spec-Driven Agent finished successfully — app.zip is ready for the user to download. 3 checks could not be confirmed.',
    );
    cleanup();
    expect((await report({ blockerCount: 5, notConfirmedCount: 3, unresolvedBlockerCount: 2 })).message).toBe(
      'Spec-Driven Agent produced output, but 2 unresolved implementation or verification issues remain; '
      + 'app.zip is ready for the user to download. 3 checks could not be confirmed.',
    );
  });

  it('words an older backend exactly as before', async () => {
    const { message, metadata } = await report({ blockerCount: 2 });
    expect(message).toBe('Spec-Driven Agent finished successfully — app.zip is ready for the user to download. 2 checks could not be verified.');
    expect(JSON.parse(JSON.stringify(metadata))).not.toHaveProperty('notConfirmedCount');
    expect(JSON.parse(JSON.stringify(metadata))).not.toHaveProperty('unverified');
    expect(JSON.parse(JSON.stringify(metadata))).not.toHaveProperty('unresolvedBlockerCount');
  });
});
