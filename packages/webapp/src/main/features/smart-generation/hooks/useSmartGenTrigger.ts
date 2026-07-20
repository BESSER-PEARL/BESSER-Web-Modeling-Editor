/**
 * useSmartGenTrigger
 *
 * Handles the `trigger_smart_generator` action emitted by the modeling
 * agent (see `handlers/smart_generation_handler.py` in modeling-agent).
 *
 * Flow:
 *   1. Modeling agent emits `trigger_smart_generator` via WebSocket.
 *   2. `useAssistantLogic.handleAction` hands the payload to
 *      `useSmartGenTrigger().handleTrigger(payload)` (fire-and-forget —
 *      the run is long and must not block the action queue).
 *   3. If sessionStorage has no BYOK key, `openByokDialog` stashes the
 *      payload in Redux; the modal fires `handleTrigger` again after
 *      the user saves a key.
 *   4. Fetches `/besser_api/smart-generate` with the project payload,
 *      instructions, provider, and BYOK key.
 *   5. Yields each SSE event and injects it into the shared assistant
 *      chat as a streaming assistant message — reusing the chunk-append
 *      semantics from `useStreamingResponse`.
 *   6. On `done`, the download is fetched and finalised in the SAME
 *      try block that writes the success message — so a download
 *      failure produces an error message, never a stale ✅ bubble.
 *   7. `COST_CAP` and `TIMEOUT` are non-terminal warnings — they
 *      annotate the stream but wait for the `done` event (with a
 *      failsafe timeout in case the backend never sends `done`).
 *
 * Concurrency: only ONE smart-gen run is allowed at a time — GLOBALLY,
 * across all mounted hook instances (AssistantWidget and
 * AssistantWorkspaceDrawer both mount one). The per-instance
 * `isRunningRef` is backed by `smartGenerator.runStatus` in the store,
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
  SmartGenMessageState,
} from '@/components/chatbot-kit/ui/chat-message';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import type { BesserProject } from '../../../shared/types/project';
import { fetchAndSaveSmartGenArtifact } from '../../../shared/utils/smartGenDownload';
import { buildProjectPayloadForBackend } from '../../../shared/utils/projectExportUtils';

import {
  beginRun,
  completeRun,
  consumePendingTrigger,
  isSmartGenRunActive,
  openByokDialog,
  releaseRunSlot,
  resetRun,
  setApiKeyPresent,
  setLastRunForProject,
  setRunError,
  tryClaimRunSlot,
  updateCost,
  updatePhase,
} from '../state/smartGeneratorSlice';
import {
  clearSessionKey,
  readFreeTierSelected,
  readProjectLastRun,
  readSessionBudget,
  readSessionKey,
  writeProjectLastRun,
} from '../storage';
import {
  startSmartGenRun,
  type StartSmartGenRunParams,
} from '../services/smartGenerationSseClient';
import { getSmartGenConfig } from '../services/smartGenConfig';
import { decideRunMode } from '../runModeDecision';
import type {
  SmartGenEvent,
  SmartGenPhase,
  SmartGenProvider,
  TriggerSmartGeneratorPayload,
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

const isNonTerminalErrorEvent = (event: SmartGenEvent): boolean =>
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

const PHASE_LABELS: Record<SmartGenPhase, string> = {
  select: 'Selecting generator',
  generate: 'Running deterministic generator',
  gap: 'Analysing gaps',
  customize: 'Customising output',
  validate: 'Validating',
};

const VALID_PHASES: ReadonlySet<SmartGenPhase> = new Set<SmartGenPhase>([
  'select',
  'generate',
  'gap',
  'customize',
  'validate',
]);

const VALID_PROVIDERS: ReadonlySet<SmartGenProvider> = new Set<SmartGenProvider>([
  'anthropic',
  'openai',
  'mistral',
  'pia',
  'local',
  'free',
]);

/**
 * Extract the 32-hex run_id from a backend-provided downloadUrl such as
 * `/besser_api/download-smart/7f3c…`. Returns `null` on failure — the
 * caller must handle that explicitly rather than silently using an
 * empty string as a sentinel.
 */
const extractRunId = (downloadUrl: string): string | null => {
  if (typeof downloadUrl !== 'string' || downloadUrl.length === 0) return null;
  // Canonical form: the backend writes `run_id = uuid.uuid4().hex` so
  // it's always exactly 32 lowercase hex chars. Match on that.
  const hexMatch = downloadUrl.match(/([a-f0-9]{32})(?:[/?#]|$)/i);
  if (hexMatch) return hexMatch[1].toLowerCase();
  return null;
};

const isValidProvider = (value: unknown): value is SmartGenProvider =>
  typeof value === 'string' && VALID_PROVIDERS.has(value as SmartGenProvider);

const isValidPhase = (value: unknown): value is SmartGenPhase =>
  typeof value === 'string' && VALID_PHASES.has(value as SmartGenPhase);

/**
 * Terminal outcome of a smart-gen run, reported exactly once per run
 * via `onRunFinished` — used by the assistant orchestrator to close
 * the agent loop (`generator_result` frontend event).
 */
export interface SmartGenRunResult {
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
}

export interface UseSmartGenTriggerOptions {
  currentProjectRef: React.MutableRefObject<BesserProject | null | undefined>;
  setMessages: React.Dispatch<React.SetStateAction<ChatKitMessage[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  /**
   * Invoked EXACTLY ONCE per run at its terminal point: after the
   * download attempt on `done` (ok = download success), on a terminal
   * error event, or on user abort (errorCode 'CANCELLED').
   */
  onRunFinished?: (result: SmartGenRunResult) => void;
}

export interface UseSmartGenTriggerReturn {
  handleTrigger: (payload: TriggerSmartGeneratorPayload) => Promise<void>;
  abortActive: () => void;
}

export function useSmartGenTrigger(
  options: UseSmartGenTriggerOptions,
): UseSmartGenTriggerReturn {
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

  const reportRunFinished = useCallback((result: SmartGenRunResult) => {
    if (runFinishedReportedRef.current) return;
    runFinishedReportedRef.current = true;
    try {
      onRunFinishedRef.current?.(result);
    } catch (err) {
      console.error('[useSmartGenTrigger] onRunFinished callback failed', err);
    }
  }, []);

  // Track mount state so we can bail out if the user navigates away
  // mid-stream and avoid setState-on-unmounted warnings.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const pendingTrigger = useAppSelector((s) => s.smartGenerator.pendingTrigger);
  const apiKeyInStore = useAppSelector((s) => s.smartGenerator.apiKeyInStore);
  const byokDialogOpen = useAppSelector((s) => s.smartGenerator.byokDialogOpen);

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

  // Initial structured state for a fresh smart-gen run. Stored on the
  // streaming message under ``smartGen`` and rendered as a card by
  // ``ChatMessage``.
  const emptySmartGen = (): SmartGenMessageState => ({
    phases: [],
    warnings: [],
    text: '',
    status: 'running',
  });

  const updateSmartGen = useCallback(
    (
      messageId: string,
      updater: (s: SmartGenMessageState) => SmartGenMessageState,
      opts: { stopStreaming?: boolean } = {},
    ) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx === -1) return prev;
        const current = prev[idx];
        const before = current.smartGen ?? emptySmartGen();
        const updated: ChatKitMessage = {
          ...current,
          smartGen: updater(before),
          isStreaming: opts.stopStreaming ? false : true,
        };
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
      });
    },
    [setMessages],
  );

  const finalizeStreamingMessage = useCallback(
    (messageId: string) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx === -1) return prev;
        const current = prev[idx];
        const updated: ChatKitMessage = {
          ...current,
          isStreaming: false,
          smartGen: current.smartGen
            ? {
                ...current.smartGen,
                // Only flip to 'done' if not already 'error' — error is
                // terminal and shouldn't be overwritten by a finalize call
                // that comes from the natural end of the stream.
                status:
                  current.smartGen.status === 'error' ? 'error' : 'done',
              }
            : current.smartGen,
        };
        return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
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
   * Download the generated output and trigger a browser save. The
   * actual blob fetch/save lives in the shared
   * `fetchAndSaveSmartGenArtifact` helper (also used by the
   * SmartGenCard "Download again" button); this wrapper only resolves
   * the runId.
   *
   * Returns an object describing the outcome:
   *   - ``{ ok: true, sizeBytes }`` on success, so the caller can render
   *     a friendlier completion message with the payload size.
   *   - ``{ ok: false }`` on any failure — used to pick the error branch.
   */
  const fetchAndSaveDownload = useCallback(
    async (
      downloadUrl: string,
      fileName: string,
      isZip: boolean,
      explicitRunId?: string,
    ): Promise<{ ok: true; sizeBytes: number } | { ok: false }> => {
      // Newer backends carry the run id on the done event itself; the
      // regex over downloadUrl stays as a fallback for older backends.
      const runId = explicitRunId || extractRunId(downloadUrl);
      if (!runId) {
        return { ok: false };
      }
      return fetchAndSaveSmartGenArtifact(runId, fileName, isZip);
    },
    [],
  );

  /** Human-readable byte size — never wider than ``XXXX.X MB``. */
  const _formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Process one SSE event. Separated so the main `for await` loop stays
   * readable and each event type has a clear local block.
   */
  const handleSseEvent = useCallback(
    async (
      event: SmartGenEvent,
      streamingId: string,
      runProject: { id: string; name?: string },
    ): Promise<void> => {
      if (abortRequestedRef.current) return;
      switch (event.event) {
        case 'start': {
          if (!isValidProvider(event.provider)) {
            console.warn('[useSmartGenTrigger] start event with invalid provider', event);
          }
          currentRunIdRef.current = event.runId;
          dispatch(beginRun({ runId: event.runId }));
          updateSmartGen(streamingId, (s) => ({
            ...s,
            runId: event.runId,
            provider: event.provider,
            model: event.llmModel,
            maxCost: event.maxCost,
            maxRuntime: event.maxRuntime,
          }));
          return;
        }
        case 'phase': {
          if (!isValidPhase(event.phase)) {
            console.warn('[useSmartGenTrigger] phase event with unknown phase', event);
            updateSmartGen(streamingId, (s) => ({
              ...s,
              phases: [
                ...s.phases,
                {
                  phase: String(event.phase),
                  label: String(event.phase),
                  message: event.message,
                  toolCalls: [],
                },
              ],
            }));
            return;
          }
          dispatch(updatePhase(event.phase));
          const label = PHASE_LABELS[event.phase];
          updateSmartGen(streamingId, (s) => ({
            ...s,
            phases: [
              ...s.phases,
              {
                phase: event.phase,
                label,
                message: event.message,
                toolCalls: [],
              },
            ],
          }));
          return;
        }
        case 'phase_update': {
          // Attach details (and optionally an updated message) to the
          // most recent phase entry that matches this event's phase
          // name. The backend uses this to surface the gap analyser's
          // task list after the planning LLM call returns. If no
          // matching phase exists yet (events arrived out of order),
          // skip — the chevron only opens when there's something to show.
          updateSmartGen(streamingId, (s) => {
            const phases = [...s.phases];
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
            return { ...s, phases };
          });
          return;
        }
        case 'tool_call': {
          updateSmartGen(streamingId, (s) => {
            const phases = [...s.phases];
            // If a tool call arrives before any phase event, attach it to
            // an implicit "Working" phase so the row still has a home in
            // the timeline rather than disappearing.
            if (phases.length === 0) {
              phases.push({
                phase: 'working',
                label: 'Working',
                message: '',
                toolCalls: [],
              });
            }
            const last = phases[phases.length - 1];
            phases[phases.length - 1] = {
              ...last,
              toolCalls: [
                ...last.toolCalls,
                { turn: event.turn, tool: event.tool, summary: event.summary },
              ],
            };
            return { ...s, phases };
          });
          return;
        }
        case 'text': {
          updateSmartGen(streamingId, (s) => ({
            ...s,
            text: s.text + event.delta,
          }));
          return;
        }
        case 'cost': {
          dispatch(updateCost({ usd: event.usd, elapsedSeconds: event.elapsedSeconds }));
          lastCostRef.current = event.usd;
          // Mirror onto the chat card so the user sees a live
          // `$spent / $budget · elapsed / max` meter while the run burns
          // their BYOK budget.
          updateSmartGen(streamingId, (s) => ({
            ...s,
            costUsd: event.usd,
            elapsedSeconds: event.elapsedSeconds,
          }));
          return;
        }
        case 'done': {
          clearFailsafeTimer();
          if (abortRequestedRef.current) return;
          const doneRunId =
            event.runId || extractRunId(event.downloadUrl) || undefined;
          if (doneRunId) currentRunIdRef.current = doneRunId;
          // Record this successful run as the base for a future
          // incremental vibe-modify of the SAME project — both in the
          // slice (same-session fast path) and localStorage (survives a
          // reload). The next `startRun` reads this back and, while still
          // within the download TTL, sends `mode:'modify'` + base_run_id.
          {
            const doneProjectId = runProject.id;
            if (doneRunId && doneProjectId) {
              const at = Date.now();
              dispatch(
                setLastRunForProject({ projectId: doneProjectId, runId: doneRunId, at }),
              );
              writeProjectLastRun(doneProjectId, doneRunId, at);
            }
          }
          dispatch(
            completeRun({
              downloadUrl: event.downloadUrl,
              fileName: event.fileName,
              isZip: event.isZip,
            }),
          );
          // We deliberately do NOT auto-save the file to the user's disk
          // here — testers reported the webapp being downloaded "without
          // consent". Instead the card surfaces an explicit Download
          // button (`needsDownload`) the user clicks when ready. The
          // backend keeps the file for ~30 min and allows repeated
          // downloads, so the button works whenever the user is ready.
          updateSmartGen(
            streamingId,
            (s) => ({
              ...s,
              runId: doneRunId ?? s.runId,
              downloadUrl: event.downloadUrl,
              fileName: event.fileName,
              isZip: event.isZip,
              status: 'done',
              needsDownload: true,
            }),
            { stopStreaming: true },
          );
          finalizeStreamingMessage(streamingId);
          {
            // Prefer the open project's name over the backend-generated
            // UUID-suffixed zip filename. Falls back to the raw filename
            // when we don't have a project (defensive -- shouldn't happen
            // since the run is guarded on an open project).
            const projectName = runProject.name;
            const niceLabel = projectName ? `**${projectName}**` : `\`${event.fileName}\``;
            appendAssistantMessage(
              (event.incomplete
                ? `⚠️ Smart generator finished building ${niceLabel}, but the run **stopped early — the output may be incomplete**.${event.incompleteReason ? ` ${event.incompleteReason}` : ``} You can resume the run to finish the remaining changes.

`
                : `✅ Smart generator finished building ${niceLabel}.

`) +
                `  Click **Download** on the run card to save \`${event.fileName}\` to your device.`,
            );
            toast.success('Spec-Driven Agent finished -- ready to download');
          }
          const generatorUsed =
            typeof event.recipe?.generator_used === 'string'
              ? event.recipe.generator_used
              : undefined;
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
          });
          return;
        }
        case 'error': {
          dispatch(setRunError({ code: event.code, message: event.message }));
          if (
            event.code === 'COST_CAP' ||
            event.code === 'TIMEOUT' ||
            event.code === 'INCOMPLETE'
          ) {
            // Warning — stream continues; the `done` event will follow.
            // But if the backend hangs and never sends `done`, the
            // failsafe timer finalises the run ourselves after 45s.
            // COST_CAP is handled silently: its message quotes dollar
            // estimates we don't consider reliable enough to show
            // (product decision) — the run still finalises normally.
            // TIMEOUT / INCOMPLETE surface a warning on the run card.
            if (event.code === 'TIMEOUT' || event.code === 'INCOMPLETE') {
              updateSmartGen(streamingId, (s) => ({
                ...s,
                warnings: [
                  ...s.warnings,
                  { code: event.code, message: event.message },
                ],
              }));
            }
            if (failsafeTimerRef.current === null) {
              const warningCode = event.code;
              failsafeTimerRef.current = setTimeout(() => {
                if (!isRunningRef.current || abortRequestedRef.current) return;
                finalizeStreamingMessage(streamingId);
                appendErrorToChat(
                  `Spec-Driven Agent exceeded the cost/runtime cap and the ` +
                    `backend did not finalise the run. You may need to retry ` +
                    `with a larger budget.`,
                );
                toast.error('Spec-Driven Agent cap reached — no response');
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
          // Mark the streaming card as terminally errored before flipping
          // ``isStreaming`` off — the card's status pill becomes red so the
          // user can see the run failed without scrolling to the toast.
          updateSmartGen(
            streamingId,
            (s) => ({
              ...s,
              status: 'error',
              warnings: [
                ...s.warnings,
                { code: event.code, message: event.message },
              ],
            }),
            { stopStreaming: true },
          );
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
            console.warn('[useSmartGenTrigger] unknown SSE event', event);
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
      fetchAndSaveDownload,
      finalizeStreamingMessage,
      reportRunFinished,
      updateSmartGen,
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
    async (payload: TriggerSmartGeneratorPayload) => {
      if (!payload.planApproved) {
        dispatch(openByokDialog(payload));
        return;
      }
      // Guard against BOTH a re-entrant call on this instance
      // (isRunningRef) and a run owned by the OTHER mounted hook
      // instance (global runStatus, read synchronously from the live
      // store — a useAppSelector value could be stale in this commit).
      if (isRunningRef.current || dispatch(isSmartGenRunActive())) {
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
      // untyped payload fields to match the StartSmartGenRunParams
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
      const provider: SmartGenProvider = rawProvider;

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

      const introText =
        typeof payload.message === 'string' && payload.message.trim().length > 0
          ? payload.message
          : 'Starting smart generation…';
      appendAssistantMessage(introText);
      const streamingId = appendAssistantMessage('', { isStreaming: true });

      isRunningRef.current = true;
      abortRequestedRef.current = false;
      runFinishedReportedRef.current = false;
      currentRunIdRef.current = undefined;
      lastCostRef.current = undefined;
      setIsGenerating(true);

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
      // Free tier is pinned to the server's model — never send a client model.
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

      // Incremental vibe-modify decision. Look up the previous successful
      // run for THIS project and, if it's still within the backend's
      // download-TTL window, edit that app in place (`mode:'modify'` +
      // baseRunId) instead of rebuilding. The decision is automatic; an
      // explicit `mode` on the trigger payload overrides it. `getSmartGenConfig`
      // is cached and never rejects (resolves to the fallback), so the TTL
      // is always defined.
      const ttlSeconds =
        (await getSmartGenConfig()).download_ttl_seconds ||
        DEFAULT_DOWNLOAD_TTL_SECONDS;
      const runDecision = decideRunMode({
        lastRun: readProjectLastRun(project.id),
        nowMs: Date.now(),
        ttlSeconds,
        explicitMode: payload.mode,
        explicitBaseRunId: payload.baseRunId,
      });

      const runParams: StartSmartGenRunParams = {
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
        handle = startSmartGenRun(runParams);
      } catch (err) {
        finalizeStreamingMessage(streamingId);
        appendErrorToChat(
          `Spec-Driven Agent failed to start: ${err instanceof Error ? err.message : String(err)}`,
        );
        toast.error('Spec-Driven Agent failed to start');
        isRunningRef.current = false;
        setIsGenerating(false);
        dispatch(releaseRunSlot());
        reportRunFinished({ ok: false, errorCode: 'INTERNAL' });
        return;
      }

      abortRef.current = handle.abort;

      let terminalEventSeen = false;
      try {
        for await (const event of handle.events) {
          if (!mountedRef.current) break;
          if (abortRequestedRef.current) break;
          if (event.event === 'done' || (event.event === 'error' && !isNonTerminalErrorEvent(event))) {
            terminalEventSeen = true;
          }
          await handleSseEvent(event, streamingId, runProject);
        }
        if (
          mountedRef.current &&
          !abortRequestedRef.current &&
          !terminalEventSeen
        ) {
          const message = 'The generation stream closed before reporting a final result.';
          updateSmartGen(
            streamingId,
            (state) => ({
              ...state,
              status: 'error',
              warnings: [...state.warnings, { code: 'INTERNAL', message }],
            }),
            { stopStreaming: true },
          );
          appendErrorToChat(`Spec-Driven Agent stream ended early: ${message}`);
          toast.error('Spec-Driven Agent stream ended early');
          dispatch(setRunError({ code: 'INTERNAL', message }));
          reportRunFinished({
            ok: false,
            runId: currentRunIdRef.current,
            errorCode: 'INTERNAL',
            costUsd: lastCostRef.current,
          });
        }
      } catch (err) {
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        // Expected: user-triggered abort surfaces as an AbortError.
        // Treat it as a soft stop (no toast) so the chat doesn't look
        // like an error occurred.
        const isAbort =
          err instanceof DOMException && err.name === 'AbortError';
        finalizeStreamingMessage(streamingId);
        if (isAbort) {
          appendAssistantMessage('⏹ Spec-Driven Agent run stopped by user.');
          reportRunFinished({
            ok: false,
            runId: currentRunIdRef.current,
            errorCode: 'CANCELLED',
            costUsd: lastCostRef.current,
          });
        } else {
          appendErrorToChat(`Spec-Driven Agent stream error: ${msg}`);
          toast.error('Spec-Driven Agent stream error');
          dispatch(setRunError({ code: 'INTERNAL', message: msg }));
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
      finalizeStreamingMessage,
      handleSseEvent,
      reportRunFinished,
      setIsGenerating,
      updateSmartGen,
    ],
  );

  /**
   * Main entry point called from `useAssistantLogic.handleAction`.
   * Decides whether to open the BYOK modal or start the run immediately.
   */
  const handleTrigger = useCallback(
    async (payload: TriggerSmartGeneratorPayload) => {
      // Check the per-instance ref AND the global run flag (fresh from
      // the store) — the run may be owned by the other mounted instance.
      if (isRunningRef.current || dispatch(isSmartGenRunActive())) {
        appendErrorToChat(
          'Spec-Driven Agent is already running — please wait for it to finish or click Stop.',
        );
        return;
      }
      // Open the BYOK dialog unless the run is already authorised: either a
      // BYOK key is stored, or the keyless free tier has been opted into.
      if (!payload.planApproved || (!readSessionKey() && !readFreeTierSelected())) {
        dispatch(openByokDialog(payload));
        return;
      }
      await startRun(payload);
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
  }, [clearFailsafeTimer, dispatch, reportRunFinished, setIsGenerating]);

  // Wire up the internal ref so the failsafe timer callback can
  // invoke the same abort logic without circular deps.
  abortActiveInternalRef.current = abortActive;

  return { handleTrigger, abortActive };
}
