import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import {
  beginRun,
  claimRunSlot,
  closeByokDialog,
  closePushDialog,
  completeRun,
  consumePendingTrigger,
  isSpecDrivenRunActive,
  openByokDialog,
  openPushDialog,
  releaseRunSlot,
  resetRun,
  setApiKeyPresent,
  setProvider,
  setRunError,
  specDrivenReducer,
  tryClaimRunSlot,
  updateCost,
  updatePhase,
} from '../specDrivenSlice';
import type { SpecDrivenState } from '../specDrivenSlice';

const INITIAL: SpecDrivenState = {
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
    reducer: { specDriven: specDrivenReducer },
  });
}

describe('specDrivenSlice', () => {
  it('has the expected initial state', () => {
    const state = specDrivenReducer(undefined, { type: '@@init' });
    expect(state).toEqual(INITIAL);
  });

  it('openByokDialog sets the dialog open and stashes the pending trigger', () => {
    const pending = {
      action: 'trigger_smart_generator' as const,
      instructions: 'build a thing',
    };
    const next = specDrivenReducer(INITIAL, openByokDialog(pending));
    expect(next.byokDialogOpen).toBe(true);
    expect(next.pendingTrigger).toEqual(pending);
  });

  it('closeByokDialog only flips the dialog flag and preserves the pending trigger', () => {
    // The pending trigger must survive closeByokDialog so the resume
    // effect in useSpecDrivenTrigger can fire after a successful save.
    // Cancel paths clear it explicitly via clearPendingTrigger.
    const pending = { action: 'trigger_smart_generator' as const, instructions: 'x' };
    const dirty: SpecDrivenState = {
      ...INITIAL,
      byokDialogOpen: true,
      pendingTrigger: pending,
    };
    const next = specDrivenReducer(dirty, closeByokDialog());
    expect(next.byokDialogOpen).toBe(false);
    expect(next.pendingTrigger).toEqual(pending);
  });

  it('openPushDialog stores the target run id and closePushDialog clears it', () => {
    // The app-level Push-to-GitHub dialog is Redux-driven (like the BYOK
    // dialog) so it never lives inside — and can't tear down — the drawer.
    const opened = specDrivenReducer(INITIAL, openPushDialog('run-123'));
    expect(opened.pushDialogRunId).toBe('run-123');

    const closed = specDrivenReducer(opened, closePushDialog());
    expect(closed.pushDialogRunId).toBeNull();
  });

  it('openPushDialog does not disturb byok / pending-trigger / last-run state', () => {
    const pending = { action: 'trigger_smart_generator' as const, instructions: 'x' };
    const dirty: SpecDrivenState = {
      ...INITIAL,
      byokDialogOpen: true,
      pendingTrigger: pending,
      lastRunByProject: { p1: { runId: 'r1', at: 42 } },
    };
    const next = specDrivenReducer(dirty, openPushDialog('run-9'));
    expect(next.pushDialogRunId).toBe('run-9');
    expect(next.byokDialogOpen).toBe(true);
    expect(next.pendingTrigger).toEqual(pending);
    expect(next.lastRunByProject).toEqual({ p1: { runId: 'r1', at: 42 } });
  });

  it('setProvider and setApiKeyPresent persist flags only (no raw key)', () => {
    let state = specDrivenReducer(INITIAL, setProvider('anthropic'));
    state = specDrivenReducer(state, setApiKeyPresent(true));
    expect(state.provider).toBe('anthropic');
    expect(state.apiKeyInStore).toBe(true);
    // Raw key field should not exist at all
    expect((state as unknown as Record<string, unknown>).apiKey).toBeUndefined();
  });

  it('beginRun initialises an active run', () => {
    const state = specDrivenReducer(INITIAL, beginRun({ runId: 'abc' }));
    expect(state.activeRun).not.toBeNull();
    expect(state.activeRun!.runId).toBe('abc');
    expect(state.activeRun!.phase).toBe('select');
    expect(state.activeRun!.costUsd).toBe(0);
  });

  it('updatePhase and updateCost mutate the active run', () => {
    let state = specDrivenReducer(INITIAL, beginRun({ runId: 'abc' }));
    state = specDrivenReducer(state, updatePhase('generate'));
    state = specDrivenReducer(
      state,
      updateCost({ usd: 0.0123, elapsedSeconds: 42.5 }),
    );
    expect(state.activeRun!.phase).toBe('generate');
    expect(state.activeRun!.costUsd).toBeCloseTo(0.0123);
    expect(state.activeRun!.elapsedSeconds).toBeCloseTo(42.5);
  });

  it('completeRun records the download info', () => {
    let state = specDrivenReducer(INITIAL, beginRun({ runId: 'abc' }));
    state = specDrivenReducer(
      state,
      completeRun({
        downloadUrl: '/besser_api/spec-driven/download/abc',
        fileName: 'app.zip',
        isZip: true,
      }),
    );
    expect(state.activeRun!.phase).toBe('done');
    expect(state.activeRun!.downloadUrl).toBe('/besser_api/spec-driven/download/abc');
    expect(state.activeRun!.fileName).toBe('app.zip');
    expect(state.activeRun!.isZip).toBe(true);
  });

  it('setRunError flips phase to error', () => {
    let state = specDrivenReducer(INITIAL, beginRun({ runId: 'abc' }));
    state = specDrivenReducer(
      state,
      setRunError({ code: 'INVALID_KEY', message: 'no key' }),
    );
    expect(state.activeRun!.phase).toBe('error');
    expect(state.activeRun!.errorCode).toBe('INVALID_KEY');
    expect(state.activeRun!.errorMessage).toBe('no key');
  });

  it('resetRun clears the active run', () => {
    let state = specDrivenReducer(INITIAL, beginRun({ runId: 'abc' }));
    state = specDrivenReducer(state, resetRun());
    expect(state.activeRun).toBeNull();
  });
});

describe('specDrivenSlice — global runStatus guard', () => {
  it('beginRun flips runStatus to running', () => {
    const state = specDrivenReducer(INITIAL, beginRun({ runId: 'abc' }));
    expect(state.runStatus).toBe('running');
  });

  it('claimRunSlot / releaseRunSlot toggle runStatus', () => {
    let state = specDrivenReducer(INITIAL, claimRunSlot());
    expect(state.runStatus).toBe('running');
    state = specDrivenReducer(state, releaseRunSlot());
    expect(state.runStatus).toBe('idle');
  });

  it('completeRun and resetRun release the slot', () => {
    let state = specDrivenReducer(INITIAL, beginRun({ runId: 'abc' }));
    state = specDrivenReducer(
      state,
      completeRun({ downloadUrl: '/dl/abc', fileName: 'x.zip', isZip: true }),
    );
    expect(state.runStatus).toBe('idle');

    state = specDrivenReducer(state, beginRun({ runId: 'def' }));
    state = specDrivenReducer(state, resetRun());
    expect(state.runStatus).toBe('idle');
  });

  it('terminal errors release the slot, non-terminal warnings do not', () => {
    let state = specDrivenReducer(INITIAL, beginRun({ runId: 'abc' }));
    // Non-terminal warning — stream continues, slot stays claimed.
    state = specDrivenReducer(
      state,
      setRunError({ code: 'COST_CAP', message: 'cap reached' }),
    );
    expect(state.runStatus).toBe('running');
    state = specDrivenReducer(
      state,
      setRunError({ code: 'TIMEOUT', message: 'time cap reached' }),
    );
    expect(state.runStatus).toBe('running');
    state = specDrivenReducer(
      state,
      setRunError({ code: 'INCOMPLETE', message: 'partial result available' }),
    );
    expect(state.runStatus).toBe('running');
    // Terminal error — slot released.
    state = specDrivenReducer(
      state,
      setRunError({ code: 'INTERNAL', message: 'boom' }),
    );
    expect(state.runStatus).toBe('idle');
  });
});

describe('specDrivenSlice — atomic thunks', () => {
  it('consumePendingTrigger returns the trigger once and null afterwards', () => {
    const store = makeStore();
    store.dispatch(openByokDialog(PENDING));

    const first = store.dispatch(consumePendingTrigger());
    expect(first).toEqual(PENDING);
    expect(store.getState().specDriven.pendingTrigger).toBeNull();

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
    expect(store.getState().specDriven.pendingTrigger).toEqual(PENDING);
  });

  it('tryClaimRunSlot claims exactly once until released', () => {
    const store = makeStore();
    expect(store.dispatch(tryClaimRunSlot())).toBe(true);
    expect(store.dispatch(tryClaimRunSlot())).toBe(false);
    expect(store.dispatch(isSpecDrivenRunActive())).toBe(true);
    store.dispatch(releaseRunSlot());
    expect(store.dispatch(isSpecDrivenRunActive())).toBe(false);
    expect(store.dispatch(tryClaimRunSlot())).toBe(true);
  });
});
