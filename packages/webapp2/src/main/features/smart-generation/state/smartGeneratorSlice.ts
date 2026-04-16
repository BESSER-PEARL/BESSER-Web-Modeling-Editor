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

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  SmartGenErrorCode,
  SmartGenPhase,
  SmartGenProvider,
  SmartGenRunPhase,
  TriggerSmartGeneratorPayload,
} from '../types';

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
  provider: SmartGenProvider | null;
  apiKeyInStore: boolean;
  pendingTrigger: TriggerSmartGeneratorPayload | null;
  activeRun: SmartGenActiveRun | null;
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
  provider: null,
  apiKeyInStore: false,
  pendingTrigger: null,
  activeRun: null,
};

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
      state.byokDialogOpen = false;
      state.pendingTrigger = null;
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
    beginRun(state, action: PayloadAction<{ runId: string }>) {
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
      if (state.activeRun) {
        state.activeRun.phase = 'error';
        state.activeRun.errorCode = action.payload.code;
        state.activeRun.errorMessage = action.payload.message;
      }
    },
    resetRun(state) {
      state.activeRun = null;
    },
  },
});

export const {
  openByokDialog,
  closeByokDialog,
  setProvider,
  setApiKeyPresent,
  clearPendingTrigger,
  beginRun,
  updatePhase,
  updateCost,
  completeRun,
  setRunError,
  resetRun,
} = smartGeneratorSlice.actions;

export const smartGeneratorReducer = smartGeneratorSlice.reducer;
export default smartGeneratorSlice.reducer;
