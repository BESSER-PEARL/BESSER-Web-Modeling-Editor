import { describe, expect, it } from 'vitest';
import {
  beginRun,
  closeByokDialog,
  completeRun,
  openByokDialog,
  resetRun,
  setApiKeyPresent,
  setProvider,
  setRunError,
  smartGeneratorReducer,
  updateCost,
  updatePhase,
} from '../smartGeneratorSlice';
import type { SmartGeneratorState } from '../smartGeneratorSlice';

const INITIAL: SmartGeneratorState = {
  byokDialogOpen: false,
  provider: null,
  apiKeyInStore: false,
  pendingTrigger: null,
  activeRun: null,
};

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
