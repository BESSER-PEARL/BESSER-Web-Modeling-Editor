import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import {
  applySpecDrivenEvent,
  claimRunSlot,
  closeByokDialog,
  closePushDialog,
  consumePendingTrigger,
  isSpecDrivenRunActive,
  liveRunEnded,
  liveRunEvent,
  liveRunStarted,
  openByokDialog,
  openPushDialog,
  readLiveSpecDrivenRun,
  releaseRunSlot,
  resetRun,
  selectHasLiveSpecDrivenRun,
  selectLiveSpecDrivenRun,
  setApiKeyPresent,
  setProvider,
  specDrivenReducer,
  tryClaimRunSlot,
} from '../specDrivenSlice';
import type { SpecDrivenState } from '../specDrivenSlice';
import type { SpecDrivenEvent } from '../../types';

const INITIAL: SpecDrivenState = {
  byokDialogOpen: false,
  pushDialogRunId: null,
  provider: null,
  apiKeyInStore: false,
  pendingTrigger: null,
  runs: {},
  runStatus: 'idle',
  lastRunByProject: {},
};

const START_EVENT: SpecDrivenEvent = {
  event: 'start',
  runId: 'a'.repeat(32),
  provider: 'anthropic',
  llmModel: 'claude-sonnet-4-6',
  maxCost: 1.0,
  maxRuntime: 600,
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

  it('openByokDialog(null) opens settings mode WITHOUT discarding a pending trigger', () => {
    // The chat's "use your own API key" link opens the dialog with a null
    // payload. A run that is still waiting must survive so completing the
    // dialog continues it.
    const pending = { action: 'trigger_smart_generator' as const, instructions: 'x' };
    const dirty: SpecDrivenState = { ...INITIAL, pendingTrigger: pending };
    const next = specDrivenReducer(dirty, openByokDialog(null));
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

  it('liveRunStarted initialises an empty running card, keyed by run key', () => {
    const state = specDrivenReducer(INITIAL, liveRunStarted({ key: 'k1' }));
    expect(state.runs.k1).toEqual({
      phases: [],
      warnings: [],
      text: '',
      status: 'running',
    });
  });

  it('liveRunEvent applies stream events to the keyed live run', () => {
    let state = specDrivenReducer(INITIAL, liveRunStarted({ key: 'k1' }));
    state = specDrivenReducer(state, liveRunEvent({ key: 'k1', event: START_EVENT }));
    state = specDrivenReducer(
      state,
      liveRunEvent({
        key: 'k1',
        event: { event: 'phase', phase: 'generate', message: 'running fastapi' },
      }),
    );
    state = specDrivenReducer(
      state,
      liveRunEvent({
        key: 'k1',
        event: { event: 'cost', usd: 0.0123, turns: 1, elapsedSeconds: 42.5 },
      }),
    );
    const card = state.runs.k1;
    expect(card.runId).toBe('a'.repeat(32));
    expect(card.provider).toBe('anthropic');
    expect(card.model).toBe('claude-sonnet-4-6');
    expect(card.phases).toHaveLength(1);
    expect(card.phases[0].label).toBe('Running deterministic generator');
    expect(card.costUsd).toBeCloseTo(0.0123);
    expect(card.elapsedSeconds).toBeCloseTo(42.5);
    expect(card.status).toBe('running');
  });

  it('liveRunEvent keys runs independently (concurrent runs)', () => {
    let state = specDrivenReducer(INITIAL, liveRunStarted({ key: 'k1' }));
    state = specDrivenReducer(state, liveRunStarted({ key: 'k2' }));
    state = specDrivenReducer(
      state,
      liveRunEvent({ key: 'k1', event: { event: 'text', delta: 'run one' } }),
    );
    expect(state.runs.k1.text).toBe('run one');
    expect(state.runs.k2.text).toBe('');
  });

  it('a done event finishes the card with download coords and needsDownload', () => {
    let state = specDrivenReducer(INITIAL, liveRunStarted({ key: 'k1' }));
    state = specDrivenReducer(
      state,
      liveRunEvent({
        key: 'k1',
        event: {
          event: 'done',
          runId: 'a'.repeat(32),
          downloadUrl: `/besser_api/spec-driven/download/${'a'.repeat(32)}`,
          fileName: 'app.zip',
          isZip: true,
          recipe: { generator_used: 'fastapi_backend' },
        },
      }),
    );
    const card = state.runs.k1;
    expect(card.status).toBe('done');
    expect(card.needsDownload).toBe(true);
    expect(card.fileName).toBe('app.zip');
    expect(card.isZip).toBe(true);
    expect(card.generatorUsed).toBe('fastapi_backend');
  });

  it('a terminal error event flips the card to error with a red notice', () => {
    let state = specDrivenReducer(INITIAL, liveRunStarted({ key: 'k1' }));
    state = specDrivenReducer(
      state,
      liveRunEvent({
        key: 'k1',
        event: { event: 'error', code: 'INVALID_KEY', message: 'no key' },
      }),
    );
    const card = state.runs.k1;
    expect(card.status).toBe('error');
    expect(card.warnings).toEqual([
      { code: 'INVALID_KEY', message: 'no key', severity: 'error' },
    ]);
  });

  it('liveRunEnded drops the entry; events for an ended run are dropped', () => {
    let state = specDrivenReducer(INITIAL, liveRunStarted({ key: 'k1' }));
    state = specDrivenReducer(state, liveRunEnded({ key: 'k1' }));
    expect(state.runs.k1).toBeUndefined();
    // A straggler event never resurrects a finalized run.
    state = specDrivenReducer(
      state,
      liveRunEvent({ key: 'k1', event: { event: 'text', delta: 'late' } }),
    );
    expect(state.runs.k1).toBeUndefined();
  });

  it('resetRun releases the slot but keeps live entries for the finalize path', () => {
    let state = specDrivenReducer(INITIAL, claimRunSlot());
    state = specDrivenReducer(state, liveRunStarted({ key: 'k1' }));
    state = specDrivenReducer(state, resetRun());
    expect(state.runStatus).toBe('idle');
    // The trigger hook's finalizeLiveRun snapshots the card into the chat
    // message BEFORE dispatching liveRunEnded — resetRun must not race it.
    expect(state.runs.k1).toBeDefined();
  });
});

describe('specDrivenSlice — applySpecDrivenEvent (pure card reducer)', () => {
  const CARD = { phases: [], warnings: [], text: '', status: 'running' as const };

  it('an INCOMPLETE before any phase is an info notice, after a phase a warning', () => {
    const early = applySpecDrivenEvent(CARD, {
      event: 'error',
      code: 'INCOMPLETE',
      message: 'previous generation expired — rebuilding',
    });
    expect(early.status).toBe('running');
    expect(early.warnings[0].severity).toBe('info');

    const withPhase = applySpecDrivenEvent(CARD, {
      event: 'phase',
      phase: 'generate',
      message: '',
    });
    const late = applySpecDrivenEvent(withPhase, {
      event: 'error',
      code: 'INCOMPLETE',
      message: 'loop cut short',
    });
    expect(late.warnings[0].severity).toBe('warning');
  });

  it('COST_CAP is silent (no notice, status unchanged)', () => {
    const next = applySpecDrivenEvent(CARD, {
      event: 'error',
      code: 'COST_CAP',
      message: 'Cost cap reached ($1.01 > $1.00)',
    });
    expect(next).toEqual(CARD);
  });

  it('a tool_call before any phase gets an implicit Working phase', () => {
    const next = applySpecDrivenEvent(CARD, {
      event: 'tool_call',
      turn: 1,
      tool: 'write_file',
      status: 'executing',
    });
    expect(next.phases).toHaveLength(1);
    expect(next.phases[0].label).toBe('Working');
    expect(next.phases[0].toolCalls).toEqual([
      { turn: 1, tool: 'write_file', summary: undefined },
    ]);
  });

  it('model_update swaps the header model and adds a visible step note', () => {
    const next = applySpecDrivenEvent(CARD, {
      event: 'model_update',
      model: 'qwen3-coder:30b',
      previousModel: 'claude-sonnet-4-6',
      reason: 'primary_unavailable',
    });
    expect(next.model).toBe('qwen3-coder:30b');
    const row = next.phases.find((p) => p.phase === 'model');
    expect(row?.label).toBe('Switched to qwen3-coder:30b');
    expect(row?.message).toBe('The primary model was unavailable.');
  });
});

describe('specDrivenSlice — global runStatus guard', () => {
  it('claimRunSlot / releaseRunSlot toggle runStatus', () => {
    let state = specDrivenReducer(INITIAL, claimRunSlot());
    expect(state.runStatus).toBe('running');
    state = specDrivenReducer(state, releaseRunSlot());
    expect(state.runStatus).toBe('idle');
  });

  it('a done event and resetRun release the slot', () => {
    let state = specDrivenReducer(INITIAL, claimRunSlot());
    state = specDrivenReducer(state, liveRunStarted({ key: 'k1' }));
    state = specDrivenReducer(
      state,
      liveRunEvent({
        key: 'k1',
        event: {
          event: 'done',
          downloadUrl: `/dl/${'a'.repeat(32)}`,
          fileName: 'x.zip',
          isZip: true,
          recipe: {},
        },
      }),
    );
    expect(state.runStatus).toBe('idle');

    state = specDrivenReducer(state, claimRunSlot());
    state = specDrivenReducer(state, resetRun());
    expect(state.runStatus).toBe('idle');
  });

  it('terminal errors release the slot, non-terminal warnings do not', () => {
    let state = specDrivenReducer(INITIAL, claimRunSlot());
    state = specDrivenReducer(state, liveRunStarted({ key: 'k1' }));
    const errorEvent = (code: 'COST_CAP' | 'TIMEOUT' | 'INCOMPLETE' | 'INTERNAL') =>
      liveRunEvent({ key: 'k1', event: { event: 'error', code, message: 'x' } });
    // Non-terminal warnings — stream continues, slot stays claimed.
    state = specDrivenReducer(state, errorEvent('COST_CAP'));
    expect(state.runStatus).toBe('running');
    state = specDrivenReducer(state, errorEvent('TIMEOUT'));
    expect(state.runStatus).toBe('running');
    state = specDrivenReducer(state, errorEvent('INCOMPLETE'));
    expect(state.runStatus).toBe('running');
    // Terminal error — slot released.
    state = specDrivenReducer(state, errorEvent('INTERNAL'));
    expect(state.runStatus).toBe('idle');
  });
});

describe('specDrivenSlice — live-run selectors and reads', () => {
  it('selectLiveSpecDrivenRun / selectHasLiveSpecDrivenRun reflect the runs map', () => {
    const empty = { specDriven: specDrivenReducer(undefined, { type: '@@init' }) };
    expect(selectHasLiveSpecDrivenRun(empty)).toBe(false);
    expect(selectLiveSpecDrivenRun(empty, 'k1')).toBeUndefined();

    const withRun = {
      specDriven: specDrivenReducer(INITIAL, liveRunStarted({ key: 'k1' })),
    };
    expect(selectHasLiveSpecDrivenRun(withRun)).toBe(true);
    expect(selectLiveSpecDrivenRun(withRun, 'k1')?.status).toBe('running');
  });

  it('readLiveSpecDrivenRun reads the live store state, null once ended', () => {
    const store = makeStore();
    store.dispatch(liveRunStarted({ key: 'k1' }));
    expect(store.dispatch(readLiveSpecDrivenRun('k1'))).not.toBeNull();
    store.dispatch(liveRunEnded({ key: 'k1' }));
    expect(store.dispatch(readLiveSpecDrivenRun('k1'))).toBeNull();
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
