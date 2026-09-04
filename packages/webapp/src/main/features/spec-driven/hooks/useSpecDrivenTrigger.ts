/**
 * useSpecDrivenTrigger
 *
 * Handles the `trigger_smart_generator` action emitted by the modeling
 * agent (see `handlers/smart_generation_handler.py` in modeling-agent).
 *
 * Flow:
 *   1. Modeling agent emits `trigger_smart_generator` via WebSocket.
 *   2. `useAssistantLogic.handleAction` hands the payload to
 *      `useSpecDrivenTrigger().handleTrigger(payload)` (fire-and-forget —
 *      the run is long and must not block the action queue).
 *   3. If sessionStorage has no BYOK key, `openByokDialog` stashes the
 *      payload in Redux; the modal fires `handleTrigger` again after
 *      the user saves a key.
 *   4. Fetches `/besser_api/spec-driven/generate` with the project payload,
 *      instructions, provider, and BYOK key.
 *   5. Appends ONE stub card message to the shared assistant chat
 *      (carrying a client-generated `liveKey`), then dispatches EVERY
 *      SSE event into the Redux spec-driven slice (`liveRunEvent`,
 *      keyed by `liveKey`). The run card subscribes to the slice entry
 *      directly (see `LiveSpecDrivenCard`), so live progress re-renders
 *      by construction — independent of which assistant surface is
 *      mounted, remounts mid-run, or owns this hook instance. If the
 *      card message disappears mid-run (New Chat on another surface, a
 *      project-switch race), the next event UPSERTS it back instead of
 *      silently no-oping (the old `idx === -1 → return prev` bug that
 *      left users staring at an empty bubble until the run finished).
 *   6. At the run's terminal point (`done`, terminal error, abort,
 *      stream cut) the final card state is snapshotted from the slice
 *      INTO the chat message and the slice entry is removed — history
 *      and the sessionStorage conversation persistence therefore work
 *      exactly as before (running cards stay excluded from persistence).
 *   7. `COST_CAP`, `TIMEOUT`, and `INCOMPLETE` are non-terminal
 *      warnings — they annotate the stream but wait for the `done`
 *      event. `COST_CAP` / `TIMEOUT` only ever arrive at the very end
 *      of a run, so they additionally arm a failsafe timeout in case
 *      the backend never sends `done`. `INCOMPLETE` can arrive mid-run
 *      (e.g. the base-expired "rebuilding from scratch" notice at the
 *      START of a modify run), so it must NOT arm the failsafe — doing
 *      so used to kill legitimate rebuilds 45s in.
 *
 * Concurrency: only ONE smart-gen run is allowed at a time — GLOBALLY,
 * across all mounted hook instances (AssistantWidget and
 * AssistantWorkspaceDrawer both mount one). The per-instance
 * `isRunningRef` is backed by `specDriven.runStatus` in the store,
 * claimed/consumed synchronously via the `tryClaimRunSlot` /
 * `consumePendingTrigger` thunks. A second `handleTrigger` call while a
 * run is active appends a warning message and returns without starting
 * anything.
 *
 * Non-goals:
 *   - The hook never touches the WebSocket, the modeling agent, or any
 *     modeling state. It only appends messages and consumes the SSE.
 *   - The BYOK key is read on demand from sessionStorage. It is never
 *     stored in any React state or Redux action payload.
 */

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

import type {
  Message as ChatKitMessage,
  SpecDrivenMessageState,
} from '@/components/chatbot-kit/ui/chat-message';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import type { BesserProject } from '../../../shared/types/project';
import { buildProjectPayloadForBackend } from '../../../shared/utils/projectExportUtils';

import {
  consumePendingTrigger,
  extractSpecDrivenRunId,
  isSpecDrivenRunActive,
  isValidSpecDrivenPhase,
  liveRunEnded,
  liveRunEvent,
  liveRunStarted,
  openByokDialog,
  readLiveSpecDrivenRun,
  releaseRunSlot,
  resetRun,
  setApiKeyPresent,
  setLastRunForProject,
  tryClaimRunSlot,
} from '../state/specDrivenSlice';
import {
  clearSessionKey,
  readFreeTierModel,
  readFreeTierSelected,
  readProjectLastRun,
  readSessionBudget,
  readSessionKey,
  writeFreeTierSelected,
  writeProjectLastRun,
} from '../storage';
import {
  startSpecDrivenRun,
  type StartSpecDrivenRunParams,
} from '../services/specDrivenSseClient';
import {
  getSpecDrivenConfig,
  resolveFreeRunModel,
} from '../services/specDrivenConfig';
import { decideRunMode } from '../runModeDecision';
import type {
  SpecDrivenEvent,
  SpecDrivenProvider,
  TriggerSpecDrivenPayload,
} from '../types';

// Longest we're willing to wait after a COST_CAP or TIMEOUT warning
// before we give up on the backend sending a `done` event and
// finalise the run ourselves. 45 seconds gives the orchestrator plenty
// of time to write its recipe file and zip the output even on a slow
// disk, while still freeing the user promptly if the backend hangs.
const COST_TIMEOUT_FAILSAFE_MS = 45_000;

// Incremental vibe-modify window used when the server's
// `download_ttl_seconds` is unavailable. Mirrors the backend default
// (BESSER_LLM_DOWNLOAD_TTL_SECONDS = 1800s / 30 min): after this the
// backend has garbage-collected the run's output, so a rebuild is forced.
const DEFAULT_DOWNLOAD_TTL_SECONDS = 1800;

const isNonTerminalErrorEvent = (event: SpecDrivenEvent): boolean =>
  event.event === 'error' &&
  (event.code === 'COST_CAP' ||
    event.code === 'TIMEOUT' ||
    event.code === 'INCOMPLETE');

const createMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `smart-gen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// Initial stub state for a fresh smart-gen run card. The chat message
// carries only this stub (plus the `liveKey` linking it to the Redux
// slice entry); the LIVE state the card renders is owned by
// `specDriven.runs[liveKey]` and updated on every SSE event.
const emptyCard = (liveKey: string): SpecDrivenMessageState => ({
  liveKey,
  phases: [],
  warnings: [],
  text: '',
  status: 'running',
});

const VALID_PROVIDERS: ReadonlySet<SpecDrivenProvider> = new Set<SpecDrivenProvider>([
  'anthropic',
  'openai',
  'mistral',
  'pia',
  'local',
  'free',
]);

const isValidProvider = (value: unknown): value is SpecDrivenProvider =>
  typeof value === 'string' && VALID_PROVIDERS.has(value as SpecDrivenProvider);

/**
 * Terminal outcome of a smart-gen run, reported exactly once per run
 * via `onRunFinished` — used by the assistant orchestrator to close
 * the agent loop (`generator_result` frontend event).
 */
export interface SpecDrivenRunResult {
  ok: boolean;
  runId?: string;
  errorCode?: string;
  fileName?: string;
  costUsd?: number;
  generatorUsed?: string;
  /** Set on a successful run that was nonetheless cut short — the output
   * may be missing requested changes. Carried so the modeling agent can
   * report the outcome honestly instead of an unqualified success. */
  incomplete?: boolean;
  incompleteReason?: string;
  /** Unresolved blocker-severity issues left by a run whose loop
   * COMPLETED (0 / undefined for genuinely cut-short runs). Lets the
   * agent report "finished with N unresolved issues" instead of the
   * misleading "stopped early". */
  blockerCount?: number;
}

export interface UseSpecDrivenTriggerOptions {
  currentProjectRef: React.MutableRefObject<BesserProject | null | undefined>;
  setMessages: React.Dispatch<React.SetStateAction<ChatKitMessage[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  /**
   * Invoked EXACTLY ONCE per run at its terminal point: after the
   * download attempt on `done` (ok = download success), on a terminal
   * error event, or on user abort (errorCode 'CANCELLED').
   */
  onRunFinished?: (result: SpecDrivenRunResult) => void;
}

export interface UseSpecDrivenTriggerReturn {
  handleTrigger: (payload: TriggerSpecDrivenPayload) => Promise<void>;
  abortActive: () => void;
}

export function useSpecDrivenTrigger(
  options: UseSpecDrivenTriggerOptions,
): UseSpecDrivenTriggerReturn {
  const dispatch = useAppDispatch();
  const { currentProjectRef, setMessages, setIsGenerating } = options;

  // Exactly one smart-gen run is allowed at a time. We guard against
  // accidental double-triggers (two rapid agent actions, double-save in
  // the BYOK modal, etc.).
  const isRunningRef = useRef(false);
  const abortRef = useRef<(() => void) | null>(null);
  // Set to `true` by `abortActive`; read by `handleSseEvent` to skip
  // expensive follow-up work (download fetch) after the user has
  // asked to stop. Can't use isRunningRef for this because that's
  // flipped to false by the finally block *after* the for-await loop
  // exits, not mid-event.
  const abortRequestedRef = useRef(false);

  // Timeout handle for the COST_CAP/TIMEOUT failsafe. Cleared when
  // the `done` event finally arrives, or when the stream finishes
  // naturally, or on abort.
  const failsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- onRunFinished bookkeeping ----
  // The callback is kept in a ref so an inline arrow passed by the
  // caller doesn't thrash the useCallback dep chains below.
  const onRunFinishedRef = useRef(options.onRunFinished);
  onRunFinishedRef.current = options.onRunFinished;
  // `true` until a run starts, then flipped back to `true` at the first
  // terminal report — guaranteeing exactly-once semantics even when
  // overlapping terminal paths fire (e.g. abortActive + AbortError catch).
  const runFinishedReportedRef = useRef(true);
  // Latest runId / cost observed on the stream, for terminal reports.
  const currentRunIdRef = useRef<string | undefined>(undefined);
  const lastCostRef = useRef<number | undefined>(undefined);
  // The active run's live key + card message id, so `abortActive` can
  // finalize the card immediately (a hung stream may never surface the
  // AbortError that would otherwise drive the finalize path).
  const activeCardRef = useRef<{ liveKey: string; streamingId: string } | null>(
    null,
  );

  const reportRunFinished = useCallback((result: SpecDrivenRunResult) => {
    if (runFinishedReportedRef.current) return;
    runFinishedReportedRef.current = true;
    try {
      onRunFinishedRef.current?.(result);
    } catch (err) {
      console.error('[useSpecDrivenTrigger] onRunFinished callback failed', err);
    }
  }, []);

  // Track mount state — used ONLY to skip the per-surface
  // `setIsGenerating` after unmount. The run itself deliberately keeps
  // streaming past an unmount: all its state lives outside React (the
  // Redux slice + the shared conversation store), so the card keeps
  // updating and the run finalizes correctly even if the owning surface
  // unmounts or remounts mid-run.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const pendingTrigger = useAppSelector((s) => s.specDriven.pendingTrigger);
  const apiKeyInStore = useAppSelector((s) => s.specDriven.apiKeyInStore);
  const byokDialogOpen = useAppSelector((s) => s.specDriven.byokDialogOpen);

  const appendAssistantMessage = useCallback(
    (content: string, extras?: Partial<ChatKitMessage>): string => {
      const id = createMessageId();
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: 'assistant',
          content,
          createdAt: new Date(),
          ...extras,
        } as ChatKitMessage,
      ]);
      return id;
    },
    [setMessages],
  );

  /**
   * Write `card` into the run's chat message — updating it in place when
   * the message exists, and RECREATING it when it doesn't (upsert).
   *
   * The previous implementation silently dropped the write when the
   * message id wasn't found (`idx === -1 → return prev`), which turned
   * every subsequent live update into an invisible no-op once anything
   * removed the card message from the list. Now the card is re-appended
   * with the same id, so run state stays visible no matter what happened
   * to the conversation in between.
   */
  const upsertCardMessage = useCallback(
    (
      messageId: string,
      card: SpecDrivenMessageState,
      opts: { stopStreaming?: boolean } = {},
    ) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx === -1) {
          return [
            ...prev,
            {
              id: messageId,
              role: 'assistant',
              content: '',
              createdAt: new Date(),
              isStreaming: opts.stopStreaming ? false : true,
              specDriven: card,
            } as ChatKitMessage,
          ];
        }
        const current = prev[idx];
        const updated: ChatKitMessage = {
          ...current,
          specDriven: card,
          isStreaming: opts.stopStreaming ? false : current.isStreaming,
        };
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
      });
    },
    [setMessages],
  );

  /**
   * Upsert path for live events: make sure the run's card message exists
   * in the conversation. If something removed it mid-run (New Chat fired
   * from a surface that doesn't own this run, a project-switch race),
   * recreate the stub — the card itself renders from the Redux slice, so
   * a recreated stub immediately shows the full live state again.
   */
  const ensureCardMessage = useCallback(
    (messageId: string, liveKey: string) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === messageId)) return prev;
        return [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: '',
            createdAt: new Date(),
            isStreaming: true,
            specDriven: emptyCard(liveKey),
          } as ChatKitMessage,
        ];
      });
    },
    [setMessages],
  );

  const appendErrorToChat = useCallback(
    (content: string) => {
      appendAssistantMessage(content, { isError: true });
    },
    [appendAssistantMessage],
  );

  const clearFailsafeTimer = useCallback(() => {
    if (failsafeTimerRef.current !== null) {
      clearTimeout(failsafeTimerRef.current);
      failsafeTimerRef.current = null;
    }
  }, []);

  /**
   * Terminal point for a run's LIVE state. Reads the final card from the
   * Redux slice, removes the slice entry, and writes the snapshot INTO
   * the chat message (upserting if the message is gone) with streaming
   * flipped off and the `liveKey` dropped — so history and the
   * sessionStorage conversation persistence work on the plain message
   * exactly as before (running cards stay excluded from persistence;
   * the finalized snapshot is persisted).
   *
   * Idempotent: the first caller wins; once the slice entry is gone
   * every later call is a no-op. `statusIfRunning` maps a card that is
   * still 'running' at finalize time (user abort, stream cut, failsafe)
   * to its terminal status; `done`/`error` statuses set by the event
   * reducer are never overwritten.
   */
  const finalizeLiveRun = useCallback(
    (
      liveKey: string,
      messageId: string,
      opts: { statusIfRunning?: 'done' | 'error' } = {},
    ) => {
      const live = dispatch(readLiveSpecDrivenRun(liveKey));
      if (!live) return;
      dispatch(liveRunEnded({ key: liveKey }));
      const snapshot: SpecDrivenMessageState = {
        ...live,
        liveKey: undefined,
        status:
          live.status === 'running'
            ? (opts.statusIfRunning ?? 'done')
            : live.status,
      };
      upsertCardMessage(messageId, snapshot, { stopStreaming: true });
    },
    [dispatch, upsertCardMessage],
  );

  /**
   * Process one SSE event. STATE FIRST: every event is dispatched into
   * the Redux slice (`liveRunEvent` — the single write path for what the
   * run card renders), and the card message is upserted so the live card
   * always has a home in the chat. The switch below then performs the
   * per-event SIDE EFFECTS only (refs, toasts, terminal chat messages,
   * the run-outcome report, the failsafe timer).
   */
  const handleSseEvent = useCallback(
    async (
      event: SpecDrivenEvent,
      run: { liveKey: string; streamingId: string; projectId: string },
    ): Promise<void> => {
      if (abortRequestedRef.current) return;
      // A finalized run accepts no more events: once its slice entry is
      // gone (failsafe fired, user aborted) the message already holds
      // the terminal snapshot — never resurrect it.
      if (!dispatch(readLiveSpecDrivenRun(run.liveKey))) return;

      dispatch(liveRunEvent({ key: run.liveKey, event }));
      ensureCardMessage(run.streamingId, run.liveKey);

      switch (event.event) {
        case 'start': {
          if (!isValidProvider(event.provider)) {
            console.warn('[useSpecDrivenTrigger] start event with invalid provider', event);
          }
          currentRunIdRef.current = event.runId;
          return;
        }
        case 'phase': {
          if (!isValidSpecDrivenPhase(event.phase)) {
            console.warn('[useSpecDrivenTrigger] phase event with unknown phase', event);
          }
          return;
        }
        case 'phase_update':
        case 'tool_call':
        case 'text':
        case 'model_update': {
          // Pure card-state events — fully handled by the slice reducer.
          return;
        }
        case 'cost': {
          lastCostRef.current = event.usd;
          return;
        }
        case 'done': {
          clearFailsafeTimer();
          if (abortRequestedRef.current) return;
          const doneRunId =
            event.runId || extractSpecDrivenRunId(event.downloadUrl) || undefined;
          if (doneRunId) currentRunIdRef.current = doneRunId;
          // The deterministic Phase-1 generator BESSER ran (e.g. `fastapi`,
          // `django`, `web_app`). It's the only reliable "what was generated"
          // signal available client-side — a richer summary (file count, full
          // stack) would need a dedicated backend field on the done event.
          const generatorUsed =
            typeof event.recipe?.generator_used === 'string'
              ? event.recipe.generator_used
              : undefined;
          // Concrete "what was generated" facts from the backend done event.
          const fileCount =
            typeof event.fileCount === 'number' && event.fileCount > 0
              ? event.fileCount
              : undefined;
          const topLevel = Array.isArray(event.topLevel) ? event.topLevel : [];
          // Unresolved blocker-severity issues left by a run whose loop
          // COMPLETED. When > 0 the run did NOT "stop early" — it
          // finished, with issues — and the copy must say so.
          const blockerCount =
            typeof event.blockerCount === 'number' && event.blockerCount > 0
              ? event.blockerCount
              : 0;
          // Record this successful run as the base for a future
          // incremental vibe-modify of the SAME project — both in the
          // slice (same-session fast path) and localStorage (survives a
          // reload). The next `startRun` reads this back and, while still
          // within the download TTL, sends `mode:'modify'` + base_run_id.
          if (doneRunId && run.projectId) {
            const at = Date.now();
            dispatch(
              setLastRunForProject({ projectId: run.projectId, runId: doneRunId, at }),
            );
            writeProjectLastRun(run.projectId, doneRunId, at);
          }
          // The slice reducer already flipped the card to 'done' with
          // `needsDownload` — we deliberately do NOT auto-save the file
          // to the user's disk (testers reported the webapp being
          // downloaded "without consent"); the card surfaces an explicit
          // Download button instead, and the backend keeps the file for
          // ~30 min. Snapshot the finished card into the chat message
          // and drop the live entry.
          finalizeLiveRun(run.liveKey, run.streamingId);
          {
            // Concrete "what was generated" summary from the backend done
            // event: how many files, which generator, and the top-level
            // entries. The download itself is a small inline button on the
            // compact run card — no big card, no "to your device" verbosity.
            const filesPhrase = fileCount
              ? `**${fileCount}** file${fileCount === 1 ? '' : 's'}`
              : 'your application code';
            const withGen = generatorUsed
              ? ` with BESSER's \`${generatorUsed}\` generator`
              : '';
            const topPhrase = topLevel.length
              ? ` Top level: ${topLevel
                  .slice(0, 8)
                  .map((e) => `\`${e}\``)
                  .join(', ')}${topLevel.length > 8 ? ', …' : ''}.`
              : '';
            // Three outcomes, three honest messages:
            //   - clean success;
            //   - the loop COMPLETED but left blocker-severity issues
            //     (blockerCount > 0) — the run did not "stop early", it
            //     finished with unresolved issues;
            //   - the loop was genuinely cut short (turn cap, provider
            //     error, cancellation) — "stopped early" is accurate.
            const incompleteMessage =
              blockerCount > 0
                ? `⚠️ Generated ${filesPhrase}${withGen}, but the run **finished with ${blockerCount} unresolved issue${blockerCount === 1 ? '' : 's'} that may stop the app from running**.${topPhrase} You can resume the run to fix ${blockerCount === 1 ? 'it' : 'them'}, or use the **Download** button on the run card to save the code as-is.`
                : `⚠️ Generated ${filesPhrase}${withGen}, but the run **stopped early — the output may be incomplete**.${event.incompleteReason ? ` ${event.incompleteReason}` : ``}${topPhrase} You can resume the run to finish the remaining changes. Use the **Download** button on the run card to save it.`;
            appendAssistantMessage(
              event.incomplete
                ? incompleteMessage
                : `✅ Generated ${filesPhrase}${withGen}.${topPhrase} Use the **Download** button on the run card to save it.`,
            );
            toast.success('Spec-Driven Agent finished -- ready to download');
          }
          // The run itself succeeded; the user simply hasn't saved the
          // file yet. Report ok so the modeling agent sees a successful
          // build -- download is now a user-driven step, not part of the run.
          reportRunFinished({
            ok: true,
            runId: doneRunId,
            fileName: event.fileName,
            costUsd: lastCostRef.current,
            generatorUsed,
            incomplete: event.incomplete,
            incompleteReason: event.incompleteReason,
            blockerCount: blockerCount > 0 ? blockerCount : undefined,
          });
          return;
        }
        case 'error': {
          if (
            event.code === 'COST_CAP' ||
            event.code === 'TIMEOUT' ||
            event.code === 'INCOMPLETE'
          ) {
            // Non-terminal — the stream continues; the `done` event will
            // follow. The slice reducer already recorded the notice on
            // the card (COST_CAP deliberately silently: its message
            // quotes dollar estimates we don't consider reliable enough
            // to show; an INCOMPLETE before any phase renders as info).
            //
            // Failsafe: COST_CAP / TIMEOUT only ever arrive at the very
            // end of a run, so `done` should follow within seconds — if
            // it doesn't, finalise ourselves after 45s. INCOMPLETE must
            // NOT arm this: it can arrive mid-run (the base-expired
            // notice at the START of a modify run) when the run still
            // has many minutes of legitimate work ahead.
            if (
              (event.code === 'COST_CAP' || event.code === 'TIMEOUT') &&
              failsafeTimerRef.current === null
            ) {
              const warningCode = event.code;
              failsafeTimerRef.current = setTimeout(() => {
                if (!isRunningRef.current || abortRequestedRef.current) return;
                console.error(
                  '[useSpecDrivenTrigger] no done event within failsafe window',
                  { runId: currentRunIdRef.current, lastWarning: warningCode },
                );
                finalizeLiveRun(run.liveKey, run.streamingId, {
                  statusIfRunning: 'error',
                });
                appendErrorToChat(
                  `The run ended unexpectedly before reporting a result. ` +
                    `You can retry the run; if this keeps happening, the ` +
                    `model provider may be temporarily unavailable.`,
                );
                toast.error('Spec-Driven Agent run ended without a result');
                reportRunFinished({
                  ok: false,
                  runId: currentRunIdRef.current,
                  errorCode: warningCode,
                  costUsd: lastCostRef.current,
                });
                abortActiveInternal();
              }, COST_TIMEOUT_FAILSAFE_MS);
            }
            return;
          }
          if (event.code === 'INVALID_KEY') {
            clearSessionKey();
            dispatch(setApiKeyPresent(false));
          }
          clearFailsafeTimer();
          // The slice reducer marked the card terminally errored (red
          // status pill + red notice) — snapshot it into the message so
          // the user can see the run failed without scrolling to the toast.
          finalizeLiveRun(run.liveKey, run.streamingId);
          appendErrorToChat(
            `❌ Spec-Driven Agent error (${event.code}): ${event.message}`,
          );
          toast.error(`Spec-Driven Agent: ${event.code}`);
          reportRunFinished({
            ok: false,
            runId: currentRunIdRef.current,
            errorCode: event.code,
            costUsd: lastCostRef.current,
          });
          return;
        }
        default: {
          // Unknown event — log for schema-drift visibility during
          // development. Never throws on the stream.
          if (typeof console !== 'undefined') {
            // eslint-disable-next-line no-console
            console.warn('[useSpecDrivenTrigger] unknown SSE event', event);
          }
          return;
        }
      }
    },
    // `abortActiveInternal` is declared below via a ref so it doesn't
    // need to be in the deps array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      appendAssistantMessage,
      appendErrorToChat,
      clearFailsafeTimer,
      dispatch,
      ensureCardMessage,
      finalizeLiveRun,
      reportRunFinished,
    ],
  );

  // Declared via a ref so `handleSseEvent`'s failsafe timer can invoke
  // it without creating a circular useCallback dep.
  const abortActiveInternalRef = useRef<() => void>(() => {
    /* initialised below */
  });

  const abortActiveInternal = useCallback(() => {
    abortActiveInternalRef.current();
  }, []);

  /**
   * Do the actual SSE run after we know we have a key. Kept separate so
   * both the direct trigger path and the "resume after BYOK save" path
   * call the same implementation.
   */
  const startRun = useCallback(
    async (payload: TriggerSpecDrivenPayload) => {
      if (!payload.planApproved) {
        dispatch(openByokDialog(payload));
        return;
      }
      // Guard against BOTH a re-entrant call on this instance
      // (isRunningRef) and a run owned by the OTHER mounted hook
      // instance (global runStatus, read synchronously from the live
      // store — a useAppSelector value could be stale in this commit).
      if (isRunningRef.current || dispatch(isSpecDrivenRunActive())) {
        appendErrorToChat(
          'Spec-Driven Agent is already running — please wait for it to finish or click Stop.',
        );
        return;
      }

      // The keyless free tier authorises a run without a BYOK key. When it's
      // selected, `key` may be null and we take the free path below (provider
      // 'free', no api_key/model/base_url — the server injects them).
      const freeSelected = readFreeTierSelected();
      const key = readSessionKey();
      if (!freeSelected && !key) {
        dispatch(openByokDialog(payload));
        return;
      }

      const project = currentProjectRef.current;
      if (!project) {
        appendErrorToChat('Spec-Driven Agent needs an open project.');
        toast.error('Spec-Driven Agent needs an open project');
        return;
      }
      const runProject = {
        id: project.id,
        name: project.name?.trim() || undefined,
      };

      // Resolve the provider with runtime validation — never trust
      // untyped payload fields to match the StartSpecDrivenRunParams
      // union without checking.
      //
      // IMPORTANT priority order: the provider stored alongside the
      // BYOK key in sessionStorage wins over any hint in the trigger
      // payload. The agent's ``payload.provider`` is just a
      // suggestion; the BYOK dropdown is the authoritative source of
      // which provider to use because it's tied to the key the user
      // actually pasted. Reversing this priority (the old bug) caused
      // a user who picked OpenAI in the dropdown to have their run
      // dispatched with ``provider=anthropic`` anyway — because the
      // modeling agent's default hint is ``anthropic`` — so the
      // Anthropic API rejected the OpenAI key with a 401 and the
      // orchestrator silently fell through to the Phase 1 deterministic
      // FastAPI output instead of the stack the user asked for.
      const rawProvider: unknown = freeSelected
        ? 'free'
        : (key?.provider ?? payload.provider);
      if (!isValidProvider(rawProvider)) {
        appendErrorToChat(
          `Spec-Driven Agent: unknown provider ${String(rawProvider)}. Please save a valid key.`,
        );
        toast.error('Spec-Driven Agent: invalid provider');
        return;
      }
      const provider: SpecDrivenProvider = rawProvider;

      // Point of no return: atomically claim the GLOBAL run slot. All
      // code from the guard at the top of this function down to here is
      // synchronous, so two instances racing in the same commit resolve
      // deterministically — the first dispatch claims, the second sees
      // 'running' and backs off.
      if (!dispatch(tryClaimRunSlot())) {
        appendErrorToChat(
          'Spec-Driven Agent is already running — please wait for it to finish or click Stop.',
        );
        return;
      }

      // The free-tier / BYOK choice was already conveyed by the confirmation
      // copy shown before the run (see the agent's
      // ``_build_smart_gen_confirmation``), so we no longer append a mid-run
      // free-tier note here — the intro line below is enough.
      const introText =
        typeof payload.message === 'string' && payload.message.trim().length > 0
          ? payload.message
          : 'Starting smart generation…';
      appendAssistantMessage(introText);
      // Client-generated run key: created BEFORE the backend assigns its
      // run id, it links the card message (`specDriven.liveKey`) to the
      // Redux slice entry every SSE event updates. Register the slice
      // entry first so the card's store subscription finds it on its
      // very first paint.
      const liveKey = createMessageId();
      dispatch(liveRunStarted({ key: liveKey }));
      const streamingId = appendAssistantMessage('', {
        isStreaming: true,
        specDriven: emptyCard(liveKey),
      });

      isRunningRef.current = true;
      abortRequestedRef.current = false;
      runFinishedReportedRef.current = false;
      currentRunIdRef.current = undefined;
      lastCostRef.current = undefined;
      activeCardRef.current = { liveKey, streamingId };
      // The run card is the progress surface from here on — CLEAR the
      // chat's typing indicator instead of pinning it for the whole run
      // (the "Typing" chip used to stick until the run finished).
      setIsGenerating(false);

      // Route the project through the same normaliser the existing
      // deterministic ``/generate-output-from-project`` path uses.
      // This strips empty diagrams, normalises the project name, and
      // otherwise mirrors the payload shape the backend already
      // expects — so a smart-gen run of project X behaves identically
      // to a deterministic run of project X at the payload-level.
      const normalisedProject = buildProjectPayloadForBackend(project);

      // Model-selection priority:
      //   1. User's explicit choice from the BYOK dialog (sessionStorage) —
      //      ALWAYS wins. This is what the user picked in the dropdown,
      //      so it must be honored.
      //   2. Agent's ``payload.llmModel`` hint — only if it's for the
      //      SAME provider as the effective run. If the user overrode
      //      the provider (e.g. picked OpenAI while the agent hinted
      //      Anthropic), the hint names an Anthropic model that OpenAI
      //      would reject with ``model_not_found`` (HTTP 404). Drop it.
      //   3. ``undefined`` — lets the backend's
      //      ``_DEFAULT_MODELS[provider]`` pick a safe default.
      // Free tier: the server pins the model, with ONE exception — the user
      // may explicitly pick the server's advertised non-default free model
      // (see below, after the config is available).
      let llmModel: string | undefined = freeSelected ? undefined : key?.llmModel;
      if (!freeSelected && !llmModel) {
        llmModel =
          payload.provider !== undefined && payload.provider !== provider
            ? undefined
            : payload.llmModel;
      }

      // User-chosen run budget from the BYOK dialog (sessionStorage).
      // When absent the fields stay undefined and the backend applies
      // its own defaults — the SSE client only serialises set values.
      const budget = readSessionBudget();

      // `getSpecDrivenConfig` is cached and never rejects (resolves to the
      // fallback), so the values below are always defined.
      const cfg = await getSpecDrivenConfig();

      // Free tier model: send the stored explicit choice only when the
      // server currently advertises it as a non-default free model. The
      // default (or any stale/unknown stored id) omits llm_model — the
      // identical wire shape to a run without any model choice.
      if (freeSelected) {
        llmModel = resolveFreeRunModel(cfg.free_tier, readFreeTierModel());
      }

      // Incremental vibe-modify decision. Look up the previous successful
      // run for THIS project and, if it's still within the backend's
      // download-TTL window, edit that app in place (`mode:'modify'` +
      // baseRunId) instead of rebuilding. The decision is automatic; an
      // explicit `mode` on the trigger payload overrides it.
      const ttlSeconds =
        cfg.download_ttl_seconds || DEFAULT_DOWNLOAD_TTL_SECONDS;
      const runDecision = decideRunMode({
        lastRun: readProjectLastRun(project.id),
        nowMs: Date.now(),
        ttlSeconds,
        explicitMode: payload.mode,
        explicitBaseRunId: payload.baseRunId,
      });

      const runParams: StartSpecDrivenRunParams = {
        project: normalisedProject,
        instructions: payload.instructions,
        provider,
        apiKey: freeSelected ? '' : (key?.apiKey ?? ''),
        llmModel,
        baseUrl: freeSelected ? undefined : key?.baseUrl,
        maxCostUsd: budget?.maxCostUsd,
        maxRuntimeSeconds: budget?.maxRuntimeSeconds,
        mode: runDecision.mode,
        baseRunId: runDecision.baseRunId,
        primaryKindOverride: payload.primaryKindOverride,
        targetGeneratorOverride: payload.targetGeneratorOverride,
        skipDeterministicGenerator: payload.skipDeterministicGenerator,
      };

      let handle;
      try {
        handle = startSpecDrivenRun(runParams);
      } catch (err) {
        const message = `Spec-Driven Agent failed to start: ${err instanceof Error ? err.message : String(err)}`;
        dispatch(
          liveRunEvent({
            key: liveKey,
            event: { event: 'error', code: 'INTERNAL', message },
          }),
        );
        finalizeLiveRun(liveKey, streamingId, { statusIfRunning: 'error' });
        appendErrorToChat(message);
        toast.error('Spec-Driven Agent failed to start');
        isRunningRef.current = false;
        activeCardRef.current = null;
        setIsGenerating(false);
        dispatch(releaseRunSlot());
        reportRunFinished({ ok: false, errorCode: 'INTERNAL' });
        return;
      }

      abortRef.current = handle.abort;

      const runCtx = { liveKey, streamingId, projectId: runProject.id };
      let terminalEventSeen = false;
      try {
        // NOTE: the loop deliberately does NOT stop when this hook's
        // surface unmounts. All run state lives outside React (the Redux
        // slice + the shared conversation store), so the stream keeps
        // being consumed and the card keeps updating even if the owning
        // surface unmounts or remounts mid-run. `mountedRef` only guards
        // the per-surface `setIsGenerating` below.
        for await (const event of handle.events) {
          if (abortRequestedRef.current) break;
          if (event.event === 'done' || (event.event === 'error' && !isNonTerminalErrorEvent(event))) {
            terminalEventSeen = true;
          }
          await handleSseEvent(event, runCtx);
        }
        if (!abortRequestedRef.current && !terminalEventSeen) {
          const message = 'The generation stream closed before reporting a final result.';
          // Synthetic terminal event through the SAME single write path
          // as real SSE errors — the card gets the red status + notice.
          dispatch(
            liveRunEvent({
              key: liveKey,
              event: { event: 'error', code: 'INTERNAL', message },
            }),
          );
          finalizeLiveRun(liveKey, streamingId, { statusIfRunning: 'error' });
          appendErrorToChat(`Spec-Driven Agent stream ended early: ${message}`);
          toast.error('Spec-Driven Agent stream ended early');
          reportRunFinished({
            ok: false,
            runId: currentRunIdRef.current,
            errorCode: 'INTERNAL',
            costUsd: lastCostRef.current,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Expected: user-triggered abort surfaces as an AbortError.
        // Treat it as a soft stop (no toast) so the chat doesn't look
        // like an error occurred.
        const isAbort =
          err instanceof DOMException && err.name === 'AbortError';
        if (isAbort) {
          finalizeLiveRun(liveKey, streamingId);
          appendAssistantMessage('⏹ Spec-Driven Agent run stopped by user.');
          reportRunFinished({
            ok: false,
            runId: currentRunIdRef.current,
            errorCode: 'CANCELLED',
            costUsd: lastCostRef.current,
          });
        } else {
          dispatch(
            liveRunEvent({
              key: liveKey,
              event: { event: 'error', code: 'INTERNAL', message: msg },
            }),
          );
          finalizeLiveRun(liveKey, streamingId, { statusIfRunning: 'error' });
          appendErrorToChat(`Spec-Driven Agent stream error: ${msg}`);
          toast.error('Spec-Driven Agent stream error');
          reportRunFinished({
            ok: false,
            runId: currentRunIdRef.current,
            errorCode: 'INTERNAL',
            costUsd: lastCostRef.current,
          });
        }
      } finally {
        abortRef.current = null;
        isRunningRef.current = false;
        clearFailsafeTimer();
        // Belt-and-braces: any exit path that skipped the terminal
        // handling above (e.g. the abort break without an AbortError)
        // still snapshots the card into the message and drops the live
        // entry — finalizeLiveRun is idempotent.
        finalizeLiveRun(liveKey, streamingId);
        activeCardRef.current = null;
        // Release the global run slot in EVERY exit path — including a
        // stream that simply ends without a `done` event (backend
        // closed early), which dispatches nothing else.
        dispatch(releaseRunSlot());
        if (mountedRef.current) setIsGenerating(false);
      }
    },
    [
      appendAssistantMessage,
      appendErrorToChat,
      clearFailsafeTimer,
      currentProjectRef,
      dispatch,
      finalizeLiveRun,
      handleSseEvent,
      reportRunFinished,
      setIsGenerating,
    ],
  );

  /**
   * Main entry point called from `useAssistantLogic.handleAction`.
   * Decides whether to open the BYOK modal or start the run immediately.
   */
  const handleTrigger = useCallback(
    async (payload: TriggerSpecDrivenPayload) => {
      // Check the per-instance ref AND the global run flag (fresh from
      // the store) — the run may be owned by the other mounted instance.
      if (isRunningRef.current || dispatch(isSpecDrivenRunActive())) {
        appendErrorToChat(
          'Spec-Driven Agent is already running — please wait for it to finish or click Stop.',
        );
        return;
      }
      // Already authorised — a BYOK key is stored, or the free tier was
      // opted into on a previous run: start directly. `planApproved` is set
      // here because there is no separate plan-review step; the BYOK popup
      // used to be the only thing that set it.
      if (readSessionKey() || readFreeTierSelected()) {
        await startRun({ ...payload, planApproved: true });
        return;
      }
      // First run, no key: DON'T interrupt with the BYOK popup. Default to
      // the keyless free tier and run immediately — the run's chat note
      // (see `startRun`) tells the user they can add their own API key for
      // higher-quality results. Only fall back to the dialog when the server
      // doesn't actually offer the free tier (old backend / offline →
      // config.free_tier.available === false).
      const cfg = await getSpecDrivenConfig();
      if (cfg.free_tier.available) {
        writeFreeTierSelected(true);
        await startRun({ ...payload, planApproved: true });
        return;
      }
      dispatch(openByokDialog(payload));
    },
    [appendErrorToChat, dispatch, startRun],
  );

  /**
   * If there's a pending trigger AND the user just saved a key (the
   * dialog is closed and `apiKeyInStore` flipped to true), resume the
   * run automatically.
   *
   * BOTH always-mounted hook instances (AssistantWidget +
   * AssistantWorkspaceDrawer) run this effect in the same React commit
   * with the same closure-captured `pendingTrigger`. Consumption MUST
   * therefore go through `consumePendingTrigger`, which reads the LIVE
   * store state and clears the trigger in one synchronous dispatch —
   * only the first instance gets a non-null trigger, so only one paid
   * run can ever start.
   */
  useEffect(() => {
    if (!pendingTrigger) return;
    if (byokDialogOpen) return;
    // Resume when the run is authorised: a BYOK key was saved, OR the keyless
    // free tier was opted into (which sets no apiKeyInStore — without this the
    // free run would silently never start).
    if (!apiKeyInStore && !readFreeTierSelected()) return;
    if (isRunningRef.current) return;
    const trigger = dispatch(consumePendingTrigger());
    if (!trigger) return;
    void startRun(trigger);
  }, [pendingTrigger, apiKeyInStore, byokDialogOpen, dispatch, startRun]);

  const abortActive = useCallback(() => {
    abortRequestedRef.current = true;
    clearFailsafeTimer();
    if (abortRef.current) {
      try {
        abortRef.current();
      } catch {
        /* ignore */
      }
      abortRef.current = null;
    }
    // Only reset run state if a run was actually in progress. We
    // intentionally do NOT close the BYOK dialog here — the user may
    // have it open for a different future run, and forcibly closing
    // it would disrupt that flow.
    if (isRunningRef.current) {
      isRunningRef.current = false;
      setIsGenerating(false);
      dispatch(resetRun());
      // Snapshot the card into the message NOW — a hung stream may never
      // surface the AbortError that would otherwise drive the finalize
      // path in startRun's catch/finally (both of which stay idempotent
      // no-ops after this).
      if (activeCardRef.current) {
        finalizeLiveRun(
          activeCardRef.current.liveKey,
          activeCardRef.current.streamingId,
        );
        activeCardRef.current = null;
      }
      // User-initiated stop is a terminal outcome — report it (the
      // exactly-once guard in reportRunFinished absorbs the AbortError
      // catch in startRun firing right after this).
      reportRunFinished({
        ok: false,
        runId: currentRunIdRef.current,
        errorCode: 'CANCELLED',
        costUsd: lastCostRef.current,
      });
    }
  }, [clearFailsafeTimer, dispatch, finalizeLiveRun, reportRunFinished, setIsGenerating]);

  // Wire up the internal ref so the failsafe timer callback can
  // invoke the same abort logic without circular deps.
  abortActiveInternalRef.current = abortActive;

  return { handleTrigger, abortActive };
}
