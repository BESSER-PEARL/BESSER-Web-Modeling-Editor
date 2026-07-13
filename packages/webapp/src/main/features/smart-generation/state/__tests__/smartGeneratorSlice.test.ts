import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import {
  beginRun,
  claimRunSlot,
  closeByokDialog,
  closePushDialog,
  completeRun,
  consumePendingTrigger,
  isSmartGenRunActive,
  openByokDialog,
  openPushDialog,
  releaseRunSlot,
  resetRun,
  setApiKeyPresent,
  setProvider,
  setRunError,
  smartGeneratorReducer,
  tryClaimRunSlot,
  updateCost,
  updatePhase,
} from '../smartGeneratorSlice';
import type { SmartGeneratorState } from '../smartGeneratorSlice';

const INITIAL: SmartGeneratorState = {
  byokDialogOpen: false,
  pushDialogRunId: null,
  provider: null,
  apiKeyInStore: false,
  pendingTrigger: null,
  activeRun: null,
  runStatus: 'idle',
  lastRunByProject: {},
};

const PENDING = {
  action: 'trigger_smart_generator' as const,
  instructions: 'build a thing',
};

function makeStore() {
  return configureStore({
    reducer: { smartGenerator: smartGeneratorReducer },
  });
}

describe('smartGeneratorSlice', () => {
  it('has the expected initial state', () => {
    const state = smartGeneratorReducer(undefined, { type: '@@init' });
    expect(state).toEqual(INITIAL);
  });

  it('openByokDialog sets the dialog open and stashes the pending trigger', () => {
    const pending = {
      action: 'trigger_smart_generator' as const,
      instructions: 'build a thing',
    };
    const next = smartGeneratorReducer(INITIAL, openByokDialog(pending));
    expect(next.byokDialogOpen).toBe(true);
    expect(next.pendingTrigger).toEqual(pending);
  });

  it('closeByokDialog only flips the dialog flag and preserves the pending trigger', () => {
    // The pending trigger must survive closeByokDialog so the resume
    // effect in useSmartGenTrigger can fire after a successful save.
    // Cancel paths clear it explicitly via clearPendingTrigger.
    const pending = { action: 'trigger_smart_generator' as const, instructions: 'x' };
    const dirty: SmartGeneratorState = {
      ...INITIAL,
      byokDialogOpen: true,
      pendingTrigger: pending,
    };
    const next = smartGeneratorReducer(dirty, closeByokDialog());
    expect(next.byokDialogOpen).toBe(false);
    expect(next.pendingTrigger).toEqual(pending);
  });

  it('openPushDialog stores the target run id and closePushDialog clears it', () => {
    // The app-level Push-to-GitHub dialog is Redux-driven (like the BYOK
    // dialog) so it never lives inside — and can't tear down — the drawer.
    const opened = smartGeneratorReducer(INITIAL, openPushDialog('run-123'));
    expect(opened.pushDialogRunId).toBe('run-123');

    const closed = smartGeneratorReducer(opened, closePushDialog());
    expect(closed.pushDialogRunId).toBeNull();
  });

  it('openPushDialog does not disturb byok / pending-trigger / last-run state', () => {
    const pending = { action: 'trigger_smart_generator' as const, instructions: 'x' };
    const dirty: SmartGeneratorState = {
      ...INITIAL,
      byokDialogOpen: true,
      pendingTrigger: pending,
      lastRunByProject: { p1: { runId: 'r1', at: 42 } },
    };
    const next = smartGeneratorReducer(dirty, openPushDialog('run-9'));
    expect(next.pushDialogRunId).toBe('run-9');
    expect(next.byokDialogOpen).toBe(true);
    expect(next.pendingTrigger).toEqual(pending);
    expect(next.lastRunByProject).toEqual({ p1: { runId: 'r1', at: 42 } });
  });

  it('setProvider and setApiKeyPresent persist flags only (no raw key)', () => {
    let state = smartGeneratorReducer(INITIAL, setProvider('anthropic'));
    state = smartGeneratorReducer(state, setApiKeyPresent(true));
    expect(state.provider).toBe('anthropic');
    expect(state.apiKeyInStore).toBe(true);
    // Raw key field should not exist at all
    expect((state as unknown as Record<string, unknown>).apiKey).toBeUndefined();
  });

  it('beginRun initialises an active run', () => {
    const state = smartGeneratorReducer(INITIAL, beginRun({ runId: 'abc' }));
    expect(state.activeRun).not.toBeNull();
    expect(state.activeRun!.runId).toBe('abc');
    expect(state.activeRun!.phase).toBe('select');
    expect(state.activeRun!.costUsd).toBe(0);
  });

  it('updatePhase and updateCost mutate the active run', () => {
    let state = smartGeneratorReducer(INITIAL, beginRun({ runId: 'abc' }));
    state = smartGeneratorReducer(state, updatePhase('generate'));
    state = smartGeneratorReducer(
      state,
      updateCost({ usd: 0.0123, elapsedSeconds: 42.5 }),
    );
    expect(state.activeRun!.phase).toBe('generate');
    expect(state.activeRun!.costUsd).toBeCloseTo(0.0123);
    expect(state.activeRun!.elapsedSeconds).toBeCloseTo(42.5);
  });

  it('completeRun records the download info', () => {
    let state = smartGeneratorReducer(INITIAL, beginRun({ runId: 'abc' }));
    state = smartGeneratorReducer(
      state,
      completeRun({
        downloadUrl: '/besser_api/download-smart/abc',
        fileName: 'app.zip',
        isZip: true,
      }),
    );
    expect(state.activeRun!.phase).toBe('done');
    expect(state.activeRun!.downloadUrl).toBe('/besser_api/download-smart/abc');
    expect(state.activeRun!.fileName).toBe('app.zip');
    expect(state.activeRun!.isZip).toBe(true);
  });

  it('setRunError flips phase to error', () => {
    let state = smartGeneratorReducer(INITIAL, beginRun({ runId: 'abc' }));
    state = smartGeneratorReducer(
      state,
      setRunError({ code: 'INVALID_KEY', message: 'no key' }),
    );
    expect(state.activeRun!.phase).toBe('error');
    expect(state.activeRun!.errorCode).toBe('INVALID_KEY');
    expect(state.activeRun!.errorMessage).toBe('no key');
  });

  it('resetRun clears the active run', () => {
    let state = smartGeneratorReducer(INITIAL, beginRun({ runId: 'abc' }));
    state = smartGeneratorReducer(state, resetRun());
    expect(state.activeRun).toBeNull();
  });
});

describe('smartGeneratorSlice — global runStatus guard', () => {
  it('beginRun flips runStatus to running', () => {
    const state = smartGeneratorReducer(INITIAL, beginRun({ runId: 'abc' }));
    expect(state.runStatus).toBe('running');
  });

  it('claimRunSlot / releaseRunSlot toggle runStatus', () => {
    let state = smartGeneratorReducer(INITIAL, claimRunSlot());
    expect(state.runStatus).toBe('running');
    state = smartGeneratorReducer(state, releaseRunSlot());
    expect(state.runStatus).toBe('idle');
  });

  it('completeRun and resetRun release the slot', () => {
    let state = smartGeneratorReducer(INITIAL, beginRun({ runId: 'abc' }));
    state = smartGeneratorReducer(
      state,
      completeRun({ downloadUrl: '/dl/abc', fileName: 'x.zip', isZip: true }),
    );
    expect(state.runStatus).toBe('idle');

    state = smartGeneratorReducer(state, beginRun({ runId: 'def' }));
    state = smartGeneratorReducer(state, resetRun());
    expect(state.runStatus).toBe('idle');
  });

  it('terminal errors release the slot, non-terminal warnings do not', () => {
    let state = smartGeneratorReducer(INITIAL, beginRun({ runId: 'abc' }));
    // Non-terminal warning — stream continues, slot stays claimed.
    state = smartGeneratorReducer(
      state,
      setRunError({ code: 'COST_CAP', message: 'cap reached' }),
    );
    expect(state.runStatus).toBe('running');
    state = smartGeneratorReducer(
      state,
      setRunError({ code: 'TIMEOUT', message: 'time cap reached' }),
    );
    expect(state.runStatus).toBe('running');
    state = smartGeneratorReducer(
      state,
      setRunError({ code: 'INCOMPLETE', message: 'partial result available' }),
    );
    expect(state.runStatus).toBe('running');
    // Terminal error — slot released.
    state = smartGeneratorReducer(
      state,
      setRunError({ code: 'INTERNAL', message: 'boom' }),
    );
    expect(state.runStatus).toBe('idle');
  });
});

describe('smartGeneratorSlice — atomic thunks', () => {
  it('consumePendingTrigger returns the trigger once and null afterwards', () => {
    const store = makeStore();
    store.dispatch(openByokDialog(PENDING));

    const first = store.dispatch(consumePendingTrigger());
    expect(first).toEqual(PENDING);
    expect(store.getState().smartGenerator.pendingTrigger).toBeNull();

    // Second consumer (the other mounted hook instance) gets nothing.
    const second = store.dispatch(consumePendingTrigger());
    expect(second).toBeNull();
  });

  it('consumePendingTrigger returns null while a run is active and keeps the trigger', () => {
    const store = makeStore();
    store.dispatch(openByokDialog(PENDING));
    store.dispatch(claimRunSlot());

    expect(store.dispatch(consumePendingTrigger())).toBeNull();
    // Trigger remains pending for after the active run finishes.
    expect(store.getState().smartGenerator.pendingTrigger).toEqual(PENDING);
  });

  it('tryClaimRunSlot claims exactly once until released', () => {
    const store = makeStore();
    expect(store.dispatch(tryClaimRunSlot())).toBe(true);
    expect(store.dispatch(tryClaimRunSlot())).toBe(false);
    expect(store.dispatch(isSmartGenRunActive())).toBe(true);
    store.dispatch(releaseRunSlot());
    expect(store.dispatch(isSmartGenRunActive())).toBe(false);
    expect(store.dispatch(tryClaimRunSlot())).toBe(true);
  });
});
