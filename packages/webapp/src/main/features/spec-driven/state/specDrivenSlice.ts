/**
 * Redux slice for the Smart Generator feature.
 *
 * Owns the UI-facing state: whether the BYOK dialog is open, which
 * provider the user picked, whether the key is currently in
 * sessionStorage, the pending trigger payload (so the dialog can resume
 * the run after the user saves their key), and — crucially — the LIVE
 * state of every in-flight run, keyed by a client-generated run key
 * (`runs`).
 *
 * LIVE RUN ARCHITECTURE: while a spec-driven run streams, its chat
 * message carries only a stub (`specDriven.liveKey`); every SSE event is
 * dispatched into `runs[liveKey]` via `liveRunEvent`, and the run card
 * (see `LiveSpecDrivenCard` in chat-message.tsx) SUBSCRIBES to that
 * entry with `useAppSelector`. Re-rendering therefore happens by
 * construction, regardless of which assistant surface (widget / drawer)
 * is mounted, remounts mid-run, or owns the SSE loop. At the run's
 * terminal point the trigger hook writes the final snapshot INTO the
 * message (history + sessionStorage persistence unchanged) and removes
 * the slice entry via `liveRunEnded`.
 *
 * The raw API key is NEVER stored in Redux. `apiKeyInStore` is a
 * boolean flag indicating whether sessionStorage currently holds one;
 * the actual key is read on demand from `features/spec-driven/storage.ts`.
 */

import { createSlice, type Dispatch, type PayloadAction } from '@reduxjs/toolkit';
// Type-only import — erased at runtime, so no runtime dependency on the
// component module. The card state shape is defined next to the card.
import type { SpecDrivenMessageState } from '@/components/chatbot-kit/ui/chat-message';
import type {
  SpecDrivenErrorCode,
  SpecDrivenEvent,
  SpecDrivenPhase,
  SpecDrivenProvider,
  TriggerSpecDrivenPayload,
} from '../types';

export type SpecDrivenRunStatus = 'idle' | 'running';

/** Human-readable labels for the backend's run phases. */
export const SPEC_DRIVEN_PHASE_LABELS: Record<SpecDrivenPhase, string> = {
  select: 'Selecting generator',
  generate: 'Running deterministic generator',
  gap: 'Analysing gaps',
  customize: 'Customising output',
  validate: 'Validating',
};

const VALID_PHASES: ReadonlySet<SpecDrivenPhase> = new Set<SpecDrivenPhase>([
  'select',
  'generate',
  'gap',
  'customize',
  'validate',
]);

export const isValidSpecDrivenPhase = (value: unknown): value is SpecDrivenPhase =>
  typeof value === 'string' && VALID_PHASES.has(value as SpecDrivenPhase);

/**
 * Extract the 32-hex run_id from a backend-provided downloadUrl such as
 * `/besser_api/spec-driven/download/7f3c…`. Returns `null` on failure — the
 * caller must handle that explicitly rather than silently using an
 * empty string as a sentinel.
 */
export const extractSpecDrivenRunId = (downloadUrl: string): string | null => {
  if (typeof downloadUrl !== 'string' || downloadUrl.length === 0) return null;
  // Canonical form: the backend writes `run_id = uuid.uuid4().hex` so
  // it's always exactly 32 lowercase hex chars. Match on that.
  const hexMatch = downloadUrl.match(/([a-f0-9]{32})(?:[/?#]|$)/i);
  if (hexMatch) return hexMatch[1].toLowerCase();
  return null;
};

/**
 * PURE per-event reducer for a live run card: apply one SSE event to the
 * card state and return the next state. This is the single place that
 * turns stream events into what the run card renders — the Redux reducer
 * below delegates to it, and tests exercise it directly.
 *
 * Event semantics (ported verbatim from the old in-hook updaters):
 *  - `phase_update` attaches details to the most recent phase entry that
 *    matches the event's phase name; if none exists yet (out-of-order
 *    events) it is skipped — the chevron only opens when there's
 *    something to show.
 *  - `tool_call` before any phase gets an implicit "Working" phase so
 *    the row still has a home in the timeline.
 *  - `model_update` swaps the header model and adds a visible step note.
 *  - `error` with COST_CAP is silent (its message quotes dollar
 *    estimates we don't consider reliable enough to show); TIMEOUT /
 *    INCOMPLETE are non-terminal notices — an INCOMPLETE that arrives
 *    before any phase is a run-SETUP note rendered as info, not a
 *    warning banner. Every other code is terminal: status → 'error'.
 */
export function applySpecDrivenEvent(
  card: SpecDrivenMessageState,
  event: SpecDrivenEvent,
): SpecDrivenMessageState {
  switch (event.event) {
    case 'start': {
      return {
        ...card,
        runId: event.runId,
        provider: event.provider,
        model: event.llmModel,
        maxCost: event.maxCost,
        maxRuntime: event.maxRuntime,
      };
    }
    case 'phase': {
      const valid = isValidSpecDrivenPhase(event.phase);
      return {
        ...card,
        phases: [
          ...card.phases,
          {
            phase: String(event.phase),
            label: valid ? SPEC_DRIVEN_PHASE_LABELS[event.phase] : String(event.phase),
            message: event.message,
            toolCalls: [],
          },
        ],
      };
    }
    case 'phase_update': {
      const phases = [...card.phases];
      for (let i = phases.length - 1; i >= 0; i--) {
        if (phases[i].phase === event.phase) {
          phases[i] = {
            ...phases[i],
            details: event.details,
            message:
              typeof event.message === 'string' && event.message.length > 0
                ? event.message
                : phases[i].message,
          };
          break;
        }
      }
      return { ...card, phases };
    }
    case 'tool_call': {
      const phases = [...card.phases];
      if (phases.length === 0) {
        phases.push({ phase: 'working', label: 'Working', message: '', toolCalls: [] });
      }
      const last = phases[phases.length - 1];
      phases[phases.length - 1] = {
        ...last,
        toolCalls: [
          ...last.toolCalls,
          { turn: event.turn, tool: event.tool, summary: event.summary },
        ],
      };
      return { ...card, phases };
    }
    case 'text': {
      return { ...card, text: card.text + event.delta };
    }
    case 'model_update': {
      const note =
        event.reason === 'primary_unavailable'
          ? 'The primary model was unavailable.'
          : 'The serving model changed mid-run.';
      return {
        ...card,
        model: event.model,
        phases: [
          ...card.phases,
          { phase: 'model', label: `Switched to ${event.model}`, message: note, toolCalls: [] },
        ],
      };
    }
    case 'cost': {
      return { ...card, costUsd: event.usd, elapsedSeconds: event.elapsedSeconds };
    }
    case 'done': {
      return {
        ...card,
        runId: event.runId || extractSpecDrivenRunId(event.downloadUrl) || card.runId,
        downloadUrl: event.downloadUrl,
        fileName: event.fileName,
        isZip: event.isZip,
        generatorUsed:
          typeof event.recipe?.generator_used === 'string'
            ? event.recipe.generator_used
            : undefined,
        fileCount:
          typeof event.fileCount === 'number' && event.fileCount > 0
            ? event.fileCount
            : undefined,
        tokensUsed:
          typeof event.tokensUsed === 'number' && event.tokensUsed > 0
            ? event.tokensUsed
            : undefined,
        status: 'done',
        // The run never auto-saves the artifact (consent fix) — the card
        // surfaces an explicit Download button instead.
        needsDownload: true,
      };
    }
    case 'error': {
      if (event.code === 'COST_CAP') return card;
      if (event.code === 'TIMEOUT' || event.code === 'INCOMPLETE') {
        return {
          ...card,
          warnings: [
            ...card.warnings,
            {
              code: event.code,
              message: event.message,
              severity:
                event.code === 'INCOMPLETE' && card.phases.length === 0
                  ? ('info' as const)
                  : ('warning' as const),
            },
          ],
        };
      }
      return {
        ...card,
        status: 'error',
        warnings: [
          ...card.warnings,
          { code: event.code, message: event.message, severity: 'error' as const },
        ],
      };
    }
    default:
      return card;
  }
}

export interface SpecDrivenState {
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
  provider: SpecDrivenProvider | null;
  apiKeyInStore: boolean;
  pendingTrigger: TriggerSpecDrivenPayload | null;
  /**
   * LIVE state of every in-flight run, keyed by the client-generated run
   * key (`liveKey`) that the run's chat-message stub carries. Every SSE
   * event updates the entry (`liveRunEvent`); the run card subscribes by
   * key via `selectLiveSpecDrivenRun`. Entries are removed at the run's
   * terminal point (`liveRunEnded`) after the final snapshot has been
   * written into the chat message. Keyed — never a single-run field — so
   * simultaneous runs each drive their own card.
   */
  runs: Record<string, SpecDrivenMessageState>;
  /**
   * GLOBAL single-run guard. The per-instance `isRunningRef` in
   * `useSpecDrivenTrigger` only protects one mounted hook instance —
   * AssistantWidget and AssistantWorkspaceDrawer each mount their own.
   * This flag lives in the (single) store so every instance can check
   * and claim the run slot synchronously via `tryClaimRunSlot`.
   */
  runStatus: SpecDrivenRunStatus;
  /**
   * Per-project record of the most recent SUCCESSFUL run, keyed by
   * project id. Drives incremental vibe-modify: a follow-up run reuses
   * the recorded `runId` as `base_run_id` while it's still fresh. Mirrored
   * to localStorage (see `localStorageSpecDrivenLastRunPrefix`) so it also
   * survives a reload; this in-memory copy is the same-session fast path.
   */
  lastRunByProject: Record<string, { runId: string; at: number }>;
}

/** Initial card state for a freshly started live run. */
const EMPTY_CARD: SpecDrivenMessageState = {
  phases: [],
  warnings: [],
  text: '',
  status: 'running',
};

const initialState: SpecDrivenState = {
  byokDialogOpen: false,
  pushDialogRunId: null,
  provider: null,
  apiKeyInStore: false,
  pendingTrigger: null,
  runs: {},
  runStatus: 'idle',
  lastRunByProject: {},
};

/** Error codes that are non-terminal warnings — the stream continues. */
const NON_TERMINAL_ERROR_CODES: ReadonlySet<SpecDrivenErrorCode> = new Set<SpecDrivenErrorCode>([
  'COST_CAP',
  'TIMEOUT',
  'INCOMPLETE',
]);

const specDrivenSlice = createSlice({
  name: 'specDriven',
  initialState,
  reducers: {
    openByokDialog(
      state,
      action: PayloadAction<TriggerSpecDrivenPayload | null>,
    ) {
      state.byokDialogOpen = true;
      // A null payload opens the dialog in settings mode (e.g. the chat's
      // "use your own API key" link) WITHOUT discarding a trigger that is
      // still waiting to run — completing the dialog then continues that
      // run. A non-null payload replaces the pending trigger.
      if (action.payload !== null) {
        state.pendingTrigger = action.payload;
      }
    },
    closeByokDialog(state) {
      // Only flip the dialog flag — pendingTrigger is preserved so the
      // resume effect in useSpecDrivenTrigger can fire after the user saves
      // their key. Cancel paths must dispatch clearPendingTrigger explicitly.
      state.byokDialogOpen = false;
    },
    approvePendingTrigger(
      state,
      action: PayloadAction<TriggerSpecDrivenPayload>,
    ) {
      state.pendingTrigger = action.payload;
      state.byokDialogOpen = false;
    },
    /**
     * Open the app-level "Push to GitHub" dialog for a finished run. Stores
     * the run id so the single app-level dialog instance knows what to push;
     * the connect-first / linked-repo logic lives in useSpecDrivenGithubPush.
     */
    openPushDialog(state, action: PayloadAction<string>) {
      state.pushDialogRunId = action.payload;
    },
    /** Close the app-level "Push to GitHub" dialog. */
    closePushDialog(state) {
      state.pushDialogRunId = null;
    },
    setProvider(state, action: PayloadAction<SpecDrivenProvider | null>) {
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
    /**
     * A live run started: create its slice entry BEFORE the card message
     * is appended, so the card's store subscription finds it on first
     * paint. Keyed by the client-generated run key the message carries.
     */
    liveRunStarted(state, action: PayloadAction<{ key: string }>) {
      state.runs[action.payload.key] = { ...EMPTY_CARD };
    },
    /**
     * Apply ONE SSE event (or a synthetic terminal event from the trigger
     * hook, e.g. `INTERNAL` on a stream cut) to a live run. This is the
     * single write path for everything the run card renders while
     * streaming. Events for a run that has already been finalized
     * (entry removed) are dropped — a finalized run never resurrects.
     *
     * Also owns the early global-slot release the old `completeRun` /
     * `setRunError` reducers provided: `done` and terminal errors free
     * `runStatus` immediately (the trigger hook's `finally` releases it
     * again — idempotent) while non-terminal warnings keep it claimed.
     */
    liveRunEvent(
      state,
      action: PayloadAction<{ key: string; event: SpecDrivenEvent }>,
    ) {
      const { key, event } = action.payload;
      const card = state.runs[key];
      if (card) {
        state.runs[key] = applySpecDrivenEvent(card, event);
      }
      if (event.event === 'done') {
        state.runStatus = 'idle';
      } else if (
        event.event === 'error' &&
        !NON_TERMINAL_ERROR_CODES.has(event.code)
      ) {
        state.runStatus = 'idle';
      }
    },
    /**
     * Drop a live run's slice entry. Dispatched by the trigger hook's
     * finalize path AFTER the final snapshot has been written into the
     * chat message — the card then renders the message snapshot instead.
     */
    liveRunEnded(state, action: PayloadAction<{ key: string }>) {
      delete state.runs[action.payload.key];
    },
    /**
     * Release the global run slot on a user abort. Live-run entries are
     * NOT cleared here — the trigger hook's finalize path writes each
     * run's final snapshot into its chat message first, then removes the
     * entry via `liveRunEnded`.
     */
    resetRun(state) {
      state.runStatus = 'idle';
    },
    /**
     * Record the most recent successful run for a project (incremental
     * vibe-modify). Dispatched from `useSpecDrivenTrigger`'s `done` handler
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
  liveRunStarted,
  liveRunEvent,
  liveRunEnded,
  resetRun,
  setLastRunForProject,
} = specDrivenSlice.actions;

export const specDrivenReducer = specDrivenSlice.reducer;
export default specDrivenSlice.reducer;

/* ------------------------------------------------------------------ */
/*  Synchronous thunks (atomic reads against the LIVE store state)     */
/* ------------------------------------------------------------------ */

/**
 * Minimal state shape these thunks need — kept structural (instead of
 * importing the app `RootState`) to avoid a circular import with the
 * store module and so per-test stores type-check too.
 */
type SpecDrivenSliceState = { specDriven: SpecDrivenState };

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
    getState: () => SpecDrivenSliceState,
  ): TriggerSpecDrivenPayload | null => {
    const s = getState().specDriven;
    if (!s.pendingTrigger || s.runStatus === 'running') return null;
    const trigger = s.pendingTrigger;
    dispatch(specDrivenSlice.actions.clearPendingTrigger());
    return trigger;
  };
}

/**
 * Atomically claim the global run slot. Returns `true` when this caller
 * now owns the slot; `false` when another run is already active.
 */
export function tryClaimRunSlot() {
  return (dispatch: Dispatch, getState: () => SpecDrivenSliceState): boolean => {
    if (getState().specDriven.runStatus === 'running') return false;
    dispatch(specDrivenSlice.actions.claimRunSlot());
    return true;
  };
}

/**
 * Synchronous fresh-state read of the global run guard (unlike a
 * `useAppSelector` value, which can be stale within the same commit).
 */
export function isSpecDrivenRunActive() {
  return (_dispatch: Dispatch, getState: () => SpecDrivenSliceState): boolean =>
    getState().specDriven.runStatus === 'running';
}

/**
 * Synchronous fresh-state read of a live run's card state, or `null`
 * when the run doesn't exist (never started, or already finalized).
 * Used by the trigger hook's finalize path to snapshot the run into its
 * chat message, and as the "is this run still live?" gate.
 */
export function readLiveSpecDrivenRun(key: string) {
  return (
    _dispatch: Dispatch,
    getState: () => SpecDrivenSliceState,
  ): SpecDrivenMessageState | null => getState().specDriven.runs[key] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Selectors                                                          */
/* ------------------------------------------------------------------ */

/**
 * The live card state for one run, by its client run key. The run card
 * subscribes with this — every SSE event dispatched via `liveRunEvent`
 * re-renders the card by construction, whatever surface it lives in.
 */
export const selectLiveSpecDrivenRun = (
  state: SpecDrivenSliceState,
  key: string,
): SpecDrivenMessageState | undefined => state.specDriven.runs[key];

/**
 * Whether ANY spec-driven run is currently live. The assistant surfaces
 * use this to suppress the chat's "Typing" indicator while a run card is
 * showing its own progress (the chip used to stick for the whole run).
 */
export const selectHasLiveSpecDrivenRun = (state: SpecDrivenSliceState): boolean => {
  for (const _key in state.specDriven.runs) return true;
  return false;
};
