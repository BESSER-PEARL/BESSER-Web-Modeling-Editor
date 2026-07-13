/**
 * Redux slice for the Smart Generator feature.
 *
 * Owns the UI-facing state: whether the BYOK dialog is open, which
 * provider the user picked, whether the key is currently in
 * sessionStorage, the pending trigger payload (so the dialog can resume
 * the run after the user saves their key), and a lightweight
 * live-run summary (phase, cost, elapsed time, download URL, error).
 *
 * The raw API key is NEVER stored in Redux. `apiKeyInStore` is a
 * boolean flag indicating whether sessionStorage currently holds one;
 * the actual key is read on demand from `features/smart-generation/storage.ts`.
 */

import { createSlice, type Dispatch, type PayloadAction } from '@reduxjs/toolkit';
import type {
  SmartGenErrorCode,
  SmartGenPhase,
  SmartGenProvider,
  SmartGenRunPhase,
  TriggerSmartGeneratorPayload,
} from '../types';

export type SmartGenRunStatus = 'idle' | 'running';

export interface SmartGenActiveRun {
  runId: string | null;
  phase: SmartGenRunPhase;
  costUsd: number;
  elapsedSeconds: number;
  downloadUrl: string | null;
  fileName: string | null;
  isZip: boolean;
  errorCode: SmartGenErrorCode | null;
  errorMessage: string | null;
}

export interface SmartGeneratorState {
  byokDialogOpen: boolean;
  /**
   * Run id whose "Push to GitHub" dialog is currently open, or ``null`` when
   * the dialog is closed. Like ``byokDialogOpen``, this drives an APP-LEVEL
   * dialog (mounted a sibling of the assistant drawer, not inside it) so
   * opening/closing the push dialog never touches the drawer's own lifecycle —
   * pressing Escape to dismiss the push dialog no longer closes the drawer and
   * loses the chat.
   */
  pushDialogRunId: string | null;
  provider: SmartGenProvider | null;
  apiKeyInStore: boolean;
  pendingTrigger: TriggerSmartGeneratorPayload | null;
  activeRun: SmartGenActiveRun | null;
  /**
   * GLOBAL single-run guard. The per-instance `isRunningRef` in
   * `useSmartGenTrigger` only protects one mounted hook instance —
   * AssistantWidget and AssistantWorkspaceDrawer each mount their own.
   * This flag lives in the (single) store so every instance can check
   * and claim the run slot synchronously via `tryClaimRunSlot`.
   */
  runStatus: SmartGenRunStatus;
  /**
   * Per-project record of the most recent SUCCESSFUL run, keyed by
   * project id. Drives incremental vibe-modify: a follow-up run reuses
   * the recorded `runId` as `base_run_id` while it's still fresh. Mirrored
   * to localStorage (see `localStorageSmartGenLastRunPrefix`) so it also
   * survives a reload; this in-memory copy is the same-session fast path.
   */
  lastRunByProject: Record<string, { runId: string; at: number }>;
}

const EMPTY_RUN: SmartGenActiveRun = {
  runId: null,
  phase: 'idle',
  costUsd: 0,
  elapsedSeconds: 0,
  downloadUrl: null,
  fileName: null,
  isZip: false,
  errorCode: null,
  errorMessage: null,
};

const initialState: SmartGeneratorState = {
  byokDialogOpen: false,
  pushDialogRunId: null,
  provider: null,
  apiKeyInStore: false,
  pendingTrigger: null,
  activeRun: null,
  runStatus: 'idle',
  lastRunByProject: {},
};

/** Error codes that are non-terminal warnings — the stream continues. */
const NON_TERMINAL_ERROR_CODES: ReadonlySet<SmartGenErrorCode> = new Set<SmartGenErrorCode>([
  'COST_CAP',
  'TIMEOUT',
  'INCOMPLETE',
]);

const smartGeneratorSlice = createSlice({
  name: 'smartGenerator',
  initialState,
  reducers: {
    openByokDialog(
      state,
      action: PayloadAction<TriggerSmartGeneratorPayload | null>,
    ) {
      state.byokDialogOpen = true;
      state.pendingTrigger = action.payload;
    },
    closeByokDialog(state) {
      // Only flip the dialog flag — pendingTrigger is preserved so the
      // resume effect in useSmartGenTrigger can fire after the user saves
      // their key. Cancel paths must dispatch clearPendingTrigger explicitly.
      state.byokDialogOpen = false;
    },
    approvePendingTrigger(
      state,
      action: PayloadAction<TriggerSmartGeneratorPayload>,
    ) {
      state.pendingTrigger = action.payload;
      state.byokDialogOpen = false;
    },
    /**
     * Open the app-level "Push to GitHub" dialog for a finished run. Stores
     * the run id so the single app-level dialog instance knows what to push;
     * the connect-first / linked-repo logic lives in useSmartGenGithubPush.
     */
    openPushDialog(state, action: PayloadAction<string>) {
      state.pushDialogRunId = action.payload;
    },
    /** Close the app-level "Push to GitHub" dialog. */
    closePushDialog(state) {
      state.pushDialogRunId = null;
    },
    setProvider(state, action: PayloadAction<SmartGenProvider | null>) {
      state.provider = action.payload;
    },
    setApiKeyPresent(state, action: PayloadAction<boolean>) {
      state.apiKeyInStore = action.payload;
    },
    /** Consume and return the pending trigger (used by the trigger hook). */
    clearPendingTrigger(state) {
      state.pendingTrigger = null;
    },
    /**
     * Synchronously claim the global run slot. Dispatched by
     * `tryClaimRunSlot` before any awaits in `startRun` so two hook
     * instances racing in the same React commit can never both start.
     */
    claimRunSlot(state) {
      state.runStatus = 'running';
    },
    /** Release the global run slot (paired with claimRunSlot). */
    releaseRunSlot(state) {
      state.runStatus = 'idle';
    },
    beginRun(state, action: PayloadAction<{ runId: string }>) {
      state.runStatus = 'running';
      state.activeRun = {
        ...EMPTY_RUN,
        runId: action.payload.runId,
        phase: 'select',
      };
    },
    updatePhase(state, action: PayloadAction<SmartGenPhase>) {
      if (state.activeRun) state.activeRun.phase = action.payload;
    },
    updateCost(
      state,
      action: PayloadAction<{ usd: number; elapsedSeconds: number }>,
    ) {
      if (state.activeRun) {
        state.activeRun.costUsd = action.payload.usd;
        state.activeRun.elapsedSeconds = action.payload.elapsedSeconds;
      }
    },
    completeRun(
      state,
      action: PayloadAction<{
        downloadUrl: string;
        fileName: string;
        isZip: boolean;
      }>,
    ) {
      state.runStatus = 'idle';
      if (state.activeRun) {
        state.activeRun.phase = 'done';
        state.activeRun.downloadUrl = action.payload.downloadUrl;
        state.activeRun.fileName = action.payload.fileName;
        state.activeRun.isZip = action.payload.isZip;
      }
    },
    setRunError(
      state,
      action: PayloadAction<{
        code: SmartGenErrorCode;
        message: string;
      }>,
    ) {
      // COST_CAP / TIMEOUT are non-terminal warnings — the stream keeps
      // running and a `done` event follows, so the run slot stays claimed.
      if (!NON_TERMINAL_ERROR_CODES.has(action.payload.code)) {
        state.runStatus = 'idle';
      }
      if (state.activeRun) {
        state.activeRun.phase = 'error';
        state.activeRun.errorCode = action.payload.code;
        state.activeRun.errorMessage = action.payload.message;
      }
    },
    resetRun(state) {
      state.runStatus = 'idle';
      state.activeRun = null;
    },
    /**
     * Record the most recent successful run for a project (incremental
     * vibe-modify). Dispatched from `useSmartGenTrigger`'s `done` handler
     * alongside the localStorage mirror. Ignores empty ids defensively.
     */
    setLastRunForProject(
      state,
      action: PayloadAction<{ projectId: string; runId: string; at: number }>,
    ) {
      const { projectId, runId, at } = action.payload;
      if (!projectId || !runId) return;
      state.lastRunByProject[projectId] = { runId, at };
    },
  },
});

export const {
  openByokDialog,
  closeByokDialog,
  approvePendingTrigger,
  openPushDialog,
  closePushDialog,
  setProvider,
  setApiKeyPresent,
  clearPendingTrigger,
  claimRunSlot,
  releaseRunSlot,
  beginRun,
  updatePhase,
  updateCost,
  completeRun,
  setRunError,
  resetRun,
  setLastRunForProject,
} = smartGeneratorSlice.actions;

export const smartGeneratorReducer = smartGeneratorSlice.reducer;
export default smartGeneratorSlice.reducer;

/* ------------------------------------------------------------------ */
/*  Synchronous thunks (atomic reads against the LIVE store state)     */
/* ------------------------------------------------------------------ */

/**
 * Minimal state shape these thunks need — kept structural (instead of
 * importing the app `RootState`) to avoid a circular import with the
 * store module and so per-test stores type-check too.
 */
type SmartGenSliceState = { smartGenerator: SmartGeneratorState };

/**
 * Atomically consume the pending trigger.
 *
 * Reads the LIVE store state via `getState()` (never a possibly-stale
 * selector snapshot). Returns `null` when there is no pending trigger
 * or a run is already active; otherwise clears the trigger in the same
 * synchronous dispatch and returns it. Because Redux dispatch is
 * synchronous, when two mounted hook instances' resume effects fire in
 * the same React commit only the FIRST call gets the trigger — the
 * second sees `pendingTrigger === null` and backs off. This is the fix
 * for the double-paid-run race.
 */
export function consumePendingTrigger() {
  return (
    dispatch: Dispatch,
    getState: () => SmartGenSliceState,
  ): TriggerSmartGeneratorPayload | null => {
    const s = getState().smartGenerator;
    if (!s.pendingTrigger || s.runStatus === 'running') return null;
    const trigger = s.pendingTrigger;
    dispatch(smartGeneratorSlice.actions.clearPendingTrigger());
    return trigger;
  };
}

/**
 * Atomically claim the global run slot. Returns `true` when this caller
 * now owns the slot; `false` when another run is already active.
 */
export function tryClaimRunSlot() {
  return (dispatch: Dispatch, getState: () => SmartGenSliceState): boolean => {
    if (getState().smartGenerator.runStatus === 'running') return false;
    dispatch(smartGeneratorSlice.actions.claimRunSlot());
    return true;
  };
}

/**
 * Synchronous fresh-state read of the global run guard (unlike a
 * `useAppSelector` value, which can be stale within the same commit).
 */
export function isSmartGenRunActive() {
  return (_dispatch: Dispatch, getState: () => SmartGenSliceState): boolean =>
    getState().smartGenerator.runStatus === 'running';
}
