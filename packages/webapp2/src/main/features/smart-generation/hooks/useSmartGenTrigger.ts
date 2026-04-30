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
 * Concurrency: only ONE smart-gen run is allowed at a time. A second
 * `handleTrigger` call while a run is active appends a warning message
 * and returns without starting anything.
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
import { smartGenDownloadUrl } from '../../../shared/constants/constant';
import { downloadFile } from '../../../shared/utils/download';
import { buildProjectPayloadForBackend } from '../../../shared/utils/projectExportUtils';

import {
  beginRun,
  clearPendingTrigger,
  closeByokDialog,
  completeRun,
  openByokDialog,
  resetRun,
  setApiKeyPresent,
  setRunError,
  updateCost,
  updatePhase,
} from '../state/smartGeneratorSlice';
import { clearSessionKey, readSessionKey } from '../storage';
import {
  startSmartGenRun,
  type StartSmartGenRunParams,
} from '../services/smartGenerationSseClient';
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

export interface UseSmartGenTriggerOptions {
  currentProjectRef: React.MutableRefObject<BesserProject | null | undefined>;
  setMessages: React.Dispatch<React.SetStateAction<ChatKitMessage[]>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
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
   * Download the generated output as a blob and trigger a browser
   * save via the existing `downloadFile` util. Prefers the response's
   * `Content-Type`, falls back to `application/zip` when the backend
   * explicitly marked the result as a zip, and finally to
   * `application/octet-stream`.
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
    ): Promise<{ ok: true; sizeBytes: number } | { ok: false }> => {
      const runId = extractRunId(downloadUrl);
      if (!runId) {
        return { ok: false };
      }
      const fullUrl = smartGenDownloadUrl(runId);
      let response: Response;
      try {
        response = await fetch(fullUrl);
      } catch (err) {
        console.error('[useSmartGenTrigger] download fetch failed', err);
        return { ok: false };
      }
      if (!response.ok) {
        console.error('[useSmartGenTrigger] download status', response.status);
        return { ok: false };
      }
      let blob: Blob;
      try {
        blob = await response.blob();
      } catch (err) {
        console.error('[useSmartGenTrigger] download blob decode failed', err);
        return { ok: false };
      }
      // For explicit zip results, trust the backend's flag over the
      // response header — some proxies drop or rewrite Content-Type.
      const mime = isZip
        ? 'application/zip'
        : response.headers.get('Content-Type') ||
          blob.type ||
          'application/octet-stream';
      try {
        downloadFile(blob, fileName, mime);
      } catch (err) {
        console.error('[useSmartGenTrigger] downloadFile failed', err);
        return { ok: false };
      }
      return { ok: true, sizeBytes: blob.size };
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
    async (event: SmartGenEvent, streamingId: string): Promise<void> => {
      if (abortRequestedRef.current) return;
      switch (event.event) {
        case 'start': {
          if (!isValidProvider(event.provider)) {
            console.warn('[useSmartGenTrigger] start event with invalid provider', event);
          }
          dispatch(beginRun({ runId: event.runId }));
          updateSmartGen(streamingId, (s) => ({
            ...s,
            runId: event.runId,
            provider: event.provider,
            model: event.llmModel,
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
          return;
        }
        case 'done': {
          clearFailsafeTimer();
          if (abortRequestedRef.current) return;
          dispatch(
            completeRun({
              downloadUrl: event.downloadUrl,
              fileName: event.fileName,
              isZip: event.isZip,
            }),
          );
          finalizeStreamingMessage(streamingId);
          // Attempt the download. Render success or error exactly
          // once based on the outcome — never both.
          const result = await fetchAndSaveDownload(
            event.downloadUrl,
            event.fileName,
            event.isZip,
          );
          if (result.ok) {
            // Prefer the open project's name over the backend-generated
            // UUID-suffixed zip filename. Falls back to the raw filename
            // when we don't have a project (defensive — shouldn't happen
            // since the run is guarded on an open project).
            const projectName = currentProjectRef.current?.name?.trim();
            const niceLabel = projectName ? `**${projectName}**` : `\`${event.fileName}\``;
            const sizeText = _formatBytes(result.sizeBytes);
            const sizeSuffix = sizeText ? ` (${sizeText})` : '';
            appendAssistantMessage(
              `✅ Smart generator finished — downloaded ${niceLabel}${sizeSuffix}.\n\n` +
                `\u00A0\u00A0Saved as \`${event.fileName}\``,
            );
            toast.success(`Downloaded ${event.fileName}`);
          } else {
            appendErrorToChat(
              `Vibe-Driven Generator finished but the download failed. You may need to regenerate.`,
            );
            toast.error('Vibe-Driven Generator download failed');
          }
          return;
        }
        case 'error': {
          dispatch(setRunError({ code: event.code, message: event.message }));
          if (event.code === 'COST_CAP' || event.code === 'TIMEOUT') {
            // Warning — stream continues; the `done` event will follow.
            // But if the backend hangs and never sends `done`, the
            // failsafe timer finalises the run ourselves after 45s.
            updateSmartGen(streamingId, (s) => ({
              ...s,
              warnings: [
                ...s.warnings,
                { code: event.code, message: event.message },
              ],
            }));
            if (failsafeTimerRef.current === null) {
              failsafeTimerRef.current = setTimeout(() => {
                if (!isRunningRef.current || abortRequestedRef.current) return;
                finalizeStreamingMessage(streamingId);
                appendErrorToChat(
                  `Vibe-Driven Generator exceeded the cost/runtime cap and the ` +
                    `backend did not finalise the run. You may need to retry ` +
                    `with a larger budget.`,
                );
                toast.error('Vibe-Driven Generator cap reached — no response');
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
            `❌ Vibe-Driven Generator error (${event.code}): ${event.message}`,
          );
          toast.error(`Vibe-Driven Generator: ${event.code}`);
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
      if (isRunningRef.current) {
        appendErrorToChat(
          'Vibe-Driven Generator is already running — please wait for it to finish or click Stop.',
        );
        return;
      }

      const key = readSessionKey();
      if (!key) {
        dispatch(openByokDialog(payload));
        return;
      }

      const project = currentProjectRef.current;
      if (!project) {
        appendErrorToChat('Vibe-Driven Generator needs an open project.');
        toast.error('Vibe-Driven Generator needs an open project');
        return;
      }

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
      const rawProvider: unknown = key.provider ?? payload.provider;
      if (!isValidProvider(rawProvider)) {
        appendErrorToChat(
          `Vibe-Driven Generator: unknown provider ${String(rawProvider)}. Please save a valid key.`,
        );
        toast.error('Vibe-Driven Generator: invalid provider');
        return;
      }
      const provider: SmartGenProvider = rawProvider;

      const introText =
        typeof payload.message === 'string' && payload.message.trim().length > 0
          ? payload.message
          : 'Starting smart generation…';
      appendAssistantMessage(introText);
      const streamingId = appendAssistantMessage('', { isStreaming: true });

      isRunningRef.current = true;
      abortRequestedRef.current = false;
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
      let llmModel: string | undefined = key.llmModel;
      if (!llmModel) {
        llmModel =
          payload.provider !== undefined && payload.provider !== provider
            ? undefined
            : payload.llmModel;
      }

      const runParams: StartSmartGenRunParams = {
        project: normalisedProject,
        instructions: payload.instructions,
        provider,
        apiKey: key.apiKey,
        llmModel,
      };

      let handle;
      try {
        handle = startSmartGenRun(runParams);
      } catch (err) {
        finalizeStreamingMessage(streamingId);
        appendErrorToChat(
          `Vibe-Driven Generator failed to start: ${err instanceof Error ? err.message : String(err)}`,
        );
        toast.error('Vibe-Driven Generator failed to start');
        isRunningRef.current = false;
        setIsGenerating(false);
        return;
      }

      abortRef.current = handle.abort;

      try {
        for await (const event of handle.events) {
          if (!mountedRef.current) break;
          if (abortRequestedRef.current) break;
          await handleSseEvent(event, streamingId);
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
          appendAssistantMessage('⏹ Vibe-Driven Generator run stopped by user.');
        } else {
          appendErrorToChat(`Vibe-Driven Generator stream error: ${msg}`);
          toast.error('Vibe-Driven Generator stream error');
          dispatch(setRunError({ code: 'INTERNAL', message: msg }));
        }
      } finally {
        abortRef.current = null;
        isRunningRef.current = false;
        clearFailsafeTimer();
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
      setIsGenerating,
    ],
  );

  /**
   * Main entry point called from `useAssistantLogic.handleAction`.
   * Decides whether to open the BYOK modal or start the run immediately.
   */
  const handleTrigger = useCallback(
    async (payload: TriggerSmartGeneratorPayload) => {
      if (isRunningRef.current) {
        appendErrorToChat(
          'Vibe-Driven Generator is already running — please wait for it to finish or click Stop.',
        );
        return;
      }
      const key = readSessionKey();
      if (!key) {
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
   */
  useEffect(() => {
    if (!pendingTrigger) return;
    if (byokDialogOpen) return;
    if (!apiKeyInStore) return;
    if (isRunningRef.current) return;
    const trigger = pendingTrigger;
    dispatch(clearPendingTrigger());
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
    }
  }, [clearFailsafeTimer, dispatch, setIsGenerating]);

  // Wire up the internal ref so the failsafe timer callback can
  // invoke the same abort logic without circular deps.
  abortActiveInternalRef.current = abortActive;

  return { handleTrigger, abortActive };
}
