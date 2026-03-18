/**
 * useAssistantLogic — shared business logic for AssistantWidget and AssistantWorkspaceDrawer.
 *
 * Both components share ~90% of their logic (WebSocket lifecycle, injection handling,
 * action dispatch, message sending, model sync, rate limiting).  Only the UI differs.
 * This hook owns all of that shared state and behaviour.
 */

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { getPostHog } from '../../services/analytics/lazy-analytics';
import { AssistantClient, type AssistantActionPayload, type InjectionCommand } from '../../services/assistant';
import { UML_BOT_WS_URL } from '../../constant';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useProject } from '../../hooks/useProject';
import { updateDiagramModelThunk, selectActiveDiagram, switchDiagramIndexThunk, addDiagramThunk } from '../../services/workspace/workspaceSlice';
import { ApollonEditorContext } from '../apollon-editor-component/apollon-editor-context';
import {
  UMLModelingService,
  type ClassSpec,
  type SystemSpec,
  type ModelModification,
  type ModelUpdate,
  type BESSERModel,
  RateLimiterService,
  type RateLimitStatus,
} from './services';
import { popUndo, canUndo, clearUndoStack } from './services/UMLModelingService';
import { isUMLModel, ProjectDiagram, SupportedDiagramType } from '../../types/project';
import type { GeneratorType } from '../sidebar/workspace-types';
import type { GenerationResult } from '../../services/generate-code/types';

/* ------------------------------------------------------------------ */
/*  Debug timing                                                       */
/* ------------------------------------------------------------------ */

/**
 * Set to `true` to show timing information in the chat and console.
 * Tracks: round-trip response time, model injection time, streaming duration.
 */
const DEBUG_TIMING = true;

interface PendingTimer {
  label: string;
  start: number;
}

const pendingTimers = new Map<string, PendingTimer>();

const startTimer = (key: string, label: string) => {
  if (!DEBUG_TIMING) return;
  pendingTimers.set(key, { label, start: performance.now() });
};

const stopTimer = (key: string): string | null => {
  if (!DEBUG_TIMING) return null;
  const timer = pendingTimers.get(key);
  if (!timer) return null;
  pendingTimers.delete(key);
  const elapsed = performance.now() - timer.start;
  const formatted = elapsed < 1000
    ? `${Math.round(elapsed)}ms`
    : `${(elapsed / 1000).toFixed(2)}s`;
  const msg = `⏱ ${timer.label}: ${formatted}`;
  console.log(`[AssistantTiming] ${msg}`);
  return msg;
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'closed' | 'closing' | 'unknown';

export interface SuggestedAction {
  label: string;
  prompt: string;
}

export interface MessageMeta {
  /** Suggested follow-up actions shown as quick-action chips after this message. */
  suggestedActions?: SuggestedAction[];
  /** Badge type indicating the nature of the message (injection, error, generation). */
  badge?: 'injection' | 'error' | 'generation';
  /** Human-readable badge label, e.g. "Applied to ClassDiagram". */
  badgeLabel?: string;
}

export interface UseAssistantLogicOptions {
  /** Whether the assistant panel is currently open/visible. */
  isActive: boolean;
  /**
   * Switch to a different diagram type.  Returns true on success.
   * The widget and drawer implement this differently (navigate vs callback).
   */
  switchDiagram: (targetType: string) => Promise<boolean>;
  /** Trigger code generation (optional — not available in all contexts). */
  onGenerate?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
}

export interface UseAssistantLogicReturn {
  /* state */
  messages: ChatKitMessage[];
  inputValue: string;
  setInputValue: (v: string) => void;
  isGenerating: boolean;
  connectionStatus: ConnectionStatus;
  rateLimitStatus: RateLimitStatus;
  /** Per-message metadata (suggestedActions, badges) keyed by message id. */
  messageMeta: Record<string, MessageMeta>;
  /** Transient progress status from the assistant (e.g. "Generating code..."). */
  progressMessage: string;
  /** The last user-sent message text (for input recall via Up arrow). */
  lastSentMessage: string;
  /** The id of the message currently being streamed, or null when idle. */
  streamingMessageId: string | null;

  /* refs */
  messageListContainerRef: React.RefObject<HTMLDivElement>;

  /* actions */
  handleSubmit: (
    event?: { preventDefault?: () => void },
    options?: { experimental_attachments?: FileList; overrideText?: string },
  ) => Promise<void>;
  sendVoiceMessage: (audioBlob: Blob) => Promise<void>;
  stopGenerating: () => void;
  clearConversation: () => void;
  /** Undo the last assistant-driven model change using the undo stack. */
  handleUndo: () => void;
  /** Whether an undo action is available. */
  canUndo: boolean;

  /* services (exposed for edge cases) */
  assistantClient: AssistantClient;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const UML_DIAGRAM_TYPES = new Set(['ClassDiagram', 'ObjectDiagram', 'StateMachineDiagram', 'AgentDiagram']);
const isUmlDiagramType = (t?: string): boolean => (t ? UML_DIAGRAM_TYPES.has(t) : false);

const createMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toKitMessage = (
  role: 'user' | 'assistant',
  content: string,
  extras?: Partial<Pick<ChatKitMessage, 'isProgress' | 'progressStep' | 'progressTotal' | 'isError' | 'isStreaming' | 'injectionType'>>,
): ChatKitMessage => ({
  id: createMessageId(),
  role,
  content,
  createdAt: new Date(),
  ...extras,
});

const sanitizeForDisplay = (text: string): string =>
  text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

const safeName = (name: string): string => name.replace(/[<>"'&]/g, '_');

const toAssistantText = (message: unknown): string => {
  if (typeof message === 'string') return message;
  try {
    return JSON.stringify(message, null, 2);
  } catch {
    return String(message);
  }
};

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const readBlobAsBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const waitForSwitchRender = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useAssistantLogic({
  isActive,
  switchDiagram,
  onGenerate,
}: UseAssistantLogicOptions): UseAssistantLogicReturn {
  /* ---- core state ---- */
  const [messages, setMessages] = useState<ChatKitMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({
    requestsLastMinute: 0,
    requestsLastHour: 0,
    cooldownRemaining: 0,
  });
  const [messageMeta, setMessageMeta] = useState<Record<string, MessageMeta>>({});
  const [progressMessage, setProgressMessage] = useState('');
  const [lastSentMessage, setLastSentMessage] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);

  const messageListContainerRef = useRef<HTMLDivElement>(null);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isSendingRef = useRef(false);

  /* ---- external deps ---- */
  const dispatch = useAppDispatch();
  const { editor } = useContext(ApollonEditorContext);
  const activeDiagram = useAppSelector(selectActiveDiagram);
  const { currentProject, currentDiagramType } = useProject();

  /* ---- stable refs for callbacks ---- */
  const modelingServiceRef = useRef<UMLModelingService | null>(null);
  const onGenerateRef = useRef(onGenerate);
  const switchDiagramRef = useRef(switchDiagram);
  const currentProjectRef = useRef(currentProject);
  const currentDiagramTypeRef = useRef(currentDiagramType);
  const currentModelRef = useRef<any>(null);

  onGenerateRef.current = onGenerate;
  switchDiagramRef.current = switchDiagram;
  currentProjectRef.current = currentProject;
  currentDiagramTypeRef.current = currentDiagramType;
  currentModelRef.current = activeDiagram?.model;

  /* ---- singleton services ---- */

  const [assistantClient] = useState(
    () =>
      new AssistantClient(UML_BOT_WS_URL, {
        clientMode: 'workspace',
        contextProvider: buildWorkspaceContext,
      }),
  );

  const [rateLimiter] = useState(
    () =>
      new RateLimiterService({
        maxRequestsPerMinute: 8,
        maxRequestsPerHour: 40,
        maxMessageLength: 1000,
        cooldownPeriodMs: 3000,
      }),
  );

  const [modelingService, setModelingService] = useState<UMLModelingService | null>(null);

  /* ---- editor / model sync ---- */

  useEffect(() => {
    if (editor && dispatch && !modelingService) {
      const service = new UMLModelingService(editor, dispatch);
      modelingServiceRef.current = service;
      setModelingService(service);
    } else if (editor && modelingService) {
      modelingService.updateEditorReference(editor);
      modelingServiceRef.current = modelingService;
    }
  }, [dispatch, editor, modelingService]);

  useEffect(() => {
    if (modelingService && activeDiagram?.model && isUMLModel(activeDiagram.model)) {
      modelingService.updateCurrentModel(activeDiagram.model);
    }
  }, [activeDiagram, modelingService]);

  /* ---- keep undoAvailable in sync with the undo stack ---- */

  const refreshUndoState = () => {
    setUndoAvailable(canUndo());
  };

  /* ---- auto-scroll on new messages ---- */

  useEffect(() => {
    if (messageListContainerRef.current) {
      messageListContainerRef.current.scrollTop = messageListContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  /* ---- workspace context builder ---- */

  function buildWorkspaceContext() {
    const project = currentProjectRef.current;
    const activeType = currentDiagramTypeRef.current || 'ClassDiagram';
    const diagrams = project?.diagrams?.[activeType as keyof typeof project.diagrams];
    const activeIndex = project?.currentDiagramIndices?.[activeType as keyof typeof project.currentDiagramIndices] ?? 0;
    const currentDiag = Array.isArray(diagrams) ? diagrams[activeIndex] : undefined;
    const projectModel = currentDiag?.model;
    const editorModel = isUMLModel(currentModelRef.current) ? currentModelRef.current : undefined;
    const activeModel = isUmlDiagramType(activeType)
      ? modelingServiceRef.current?.getCurrentModel() || editorModel || projectModel
      : projectModel;

    // Build compact but informative per-diagram summaries.
    // compactContextPayload will auto-generate richer summaries from the
    // projectSnapshot when these are empty, but passing lightweight ones here
    // ensures the caller's titles and ids are preserved.
    const diagramSummaries = project
      ? Object.entries(project.diagrams).flatMap(([diagramType, diagramArr]) => {
          if (!Array.isArray(diagramArr)) return [];
          return (diagramArr as ProjectDiagram[]).map((d) => ({
            type: diagramType,
            diagramId: d.id,
            title: d.title,
          }));
        })
      : [];

    // Project-level metadata for quick agent orientation.
    const projectMetadata = project
      ? {
          totalDiagrams: Object.values(project.diagrams).flat().length,
          diagramTypes: Object.keys(project.diagrams).filter(
            (type) => (project.diagrams as Record<string, any[]>)[type]?.length > 0,
          ),
        }
      : undefined;

    return {
      activeDiagramType: activeType,
      activeDiagramId: currentDiag?.id,
      activeModel,
      projectSnapshot: project || undefined,
      projectName: project?.name,
      diagramSummaries,
      projectMetadata,
      currentDiagramIndices: project?.currentDiagramIndices,
    };
  }

  /* ---- diagram switching helpers ---- */

  const waitForModelingService = async (timeoutMs = 3000): Promise<boolean> => {
    if (modelingServiceRef.current && typeof modelingServiceRef.current.injectToEditor === 'function') {
      return true;
    }
    const start = Date.now();
    return new Promise<boolean>((resolve) => {
      const id = setInterval(() => {
        if (modelingServiceRef.current && typeof modelingServiceRef.current.injectToEditor === 'function') {
          clearInterval(id);
          resolve(true);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(id);
          console.warn('[useAssistantLogic] Timed out waiting for modelingService');
          resolve(false);
        }
      }, 50);
    });
  };

  /**
   * Find the tab index for a given diagramId within a diagram type array.
   * Returns -1 if not found.
   */
  const findDiagramIndexById = (diagramType: string, diagramId: string): number => {
    const project = currentProjectRef.current;
    if (!project) return -1;
    const diagrams = (project.diagrams as Record<string, ProjectDiagram[]>)[diagramType];
    if (!Array.isArray(diagrams)) return -1;
    return diagrams.findIndex((d) => d.id === diagramId);
  };

  /**
   * Ensure the specified diagram type (and optionally a specific tab identified
   * by diagramId) is the active editor before an injection is applied.
   *
   * Steps:
   *  1. If diagramType differs from the current type, switch diagram type first.
   *  2. If diagramId is provided, locate its tab index and switch to that index.
   */
  const ensureTargetDiagramReady = async (targetType?: string, targetDiagramId?: string): Promise<boolean> => {
    // Step 1: switch diagram type if needed
    if (targetType && targetType !== currentDiagramTypeRef.current) {
      const switched = await switchDiagramRef.current(targetType);
      if (!switched) return false;
      await waitForSwitchRender();
    }

    // Step 2: switch to the specific tab if diagramId is provided
    if (targetDiagramId && targetType) {
      const tabIndex = findDiagramIndexById(targetType, targetDiagramId);
      if (tabIndex >= 0) {
        // Check current active index — only dispatch if we need to switch
        const project = currentProjectRef.current;
        const currentIndex = project?.currentDiagramIndices?.[targetType as SupportedDiagramType] ?? 0;
        if (tabIndex !== currentIndex) {
          try {
            await dispatch(switchDiagramIndexThunk({ diagramType: targetType as SupportedDiagramType, index: tabIndex })).unwrap();
            await waitForSwitchRender();
          } catch (error) {
            console.warn('[useAssistantLogic] Could not switch to diagram tab:', error);
            // Non-fatal: we already switched diagram type, proceed with injection
          }
        }
      }
    }

    return true;
  };

  /* ---- task queue (serialises async operations) ---- */

  const enqueueAssistantTask = (task: () => Promise<void> | void) => {
    operationQueueRef.current = operationQueueRef.current
      .then(async () => { await task(); })
      .catch((error) => console.error('[useAssistantLogic] task queue error:', error));
  };

  /* ================================================================ */
  /*  handleInjection                                                  */
  /* ================================================================ */

  const handleInjection = async (command: InjectionCommand) => {
    try {
      startTimer('injection', 'Model injection');
      const targetDiagramType = command.diagramType || currentDiagramTypeRef.current || 'ClassDiagram';

      // If the agent requests a new tab, create it before switching/injecting
      if ((command as any).createNewTab) {
        try {
          const result = await dispatch(addDiagramThunk({
            diagramType: targetDiagramType as SupportedDiagramType,
          })).unwrap();
          if (result?.index !== undefined) {
            await dispatch(switchDiagramIndexThunk({
              diagramType: targetDiagramType as SupportedDiagramType,
              index: result.index,
            })).unwrap();
            await waitForSwitchRender();
          }
        } catch (tabError) {
          console.warn('[useAssistantLogic] Could not create new tab, injecting into current:', tabError);
        }
      }

      const diagramReady = await ensureTargetDiagramReady(command.diagramType, command.diagramId);
      if (!diagramReady) {
        throw new Error(`Could not switch to ${command.diagramType || 'the target diagram'}`);
      }

      const targetIsUml = isUmlDiagramType(targetDiagramType);
      let applied = false;

      // When creating a new tab, the Apollon editor hasn't mounted yet so the
      // modeling service still references the previous tab's editor.  Skip the
      // modeling service path and write the model directly to Redux — the new
      // editor will load the model when it initialises.
      const createdNewTab = !!(command as any).createNewTab;

      if (targetIsUml && !createdNewTab && !modelingServiceRef.current) {
        await waitForModelingService();
      }

      if (targetIsUml && !createdNewTab && modelingServiceRef.current) {
        let update: ModelUpdate | null = null;
        switch (command.action) {
          case 'inject_element':
            if (command.element && typeof command.element === 'object' &&
                (command.element.className || command.element.stateName || command.element.objectName || command.element.type)) {
              update = modelingServiceRef.current.processSimpleClassSpec(command.element as ClassSpec, command.diagramType);
            } else if (command.element) {
              throw new Error('inject_element payload is missing a recognizable element specification');
            }
            break;
          case 'inject_complete_system':
            if (command.systemSpec && typeof command.systemSpec === 'object' &&
                Array.isArray(command.systemSpec.classes ?? command.systemSpec.states ?? command.systemSpec.objects ?? command.systemSpec.intents)) {
              update = modelingServiceRef.current.processSystemSpec(command.systemSpec as SystemSpec, command.diagramType, command.replaceExisting);
            } else if (command.systemSpec && typeof command.systemSpec === 'object' && Object.keys(command.systemSpec).length > 0) {
              update = modelingServiceRef.current.processSystemSpec(command.systemSpec as SystemSpec, command.diagramType, command.replaceExisting);
            } else if (command.systemSpec) {
              throw new Error('inject_complete_system payload is missing a valid classes/states/objects/intents array');
            }
            break;
          case 'modify_model':
            if (Array.isArray(command.modifications) && command.modifications.length > 0) {
              update = modelingServiceRef.current.processModelModifications(command.modifications as ModelModification[]);
            } else if (command.modification && typeof command.modification === 'object' && command.modification.action && command.modification.target) {
              update = modelingServiceRef.current.processModelModification(command.modification as ModelModification);
            } else if (command.modification) {
              throw new Error('modify_model payload is missing required action or target fields');
            }
            break;
          default:
            break;
        }

        if (update) {
          await modelingServiceRef.current.injectToEditor(update);
          applied = true;
        } else if (command.model) {
          await modelingServiceRef.current.replaceModel(command.model as Partial<BESSERModel>);
          applied = true;
        }
      }

      if (!applied && command.model) {
        const targetDiagramIsGui = targetDiagramType === 'GUINoCodeDiagram';

        if (targetDiagramIsGui && (window as any).__WME_GUI_EDITOR_READY__) {
          const loadResult = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
            const timeout = setTimeout(() => {
              window.removeEventListener('wme:assistant-load-gui-model-done', onDone);
              resolve({ ok: false, error: 'Timed out waiting for GUI editor' });
            }, 10_000);
            const onDone = (event: Event) => {
              clearTimeout(timeout);
              window.removeEventListener('wme:assistant-load-gui-model-done', onDone);
              resolve((event as CustomEvent).detail ?? { ok: false, error: 'No response' });
            };
            window.addEventListener('wme:assistant-load-gui-model-done', onDone);
            window.dispatchEvent(new CustomEvent('wme:assistant-load-gui-model', { detail: { model: command.model } }));
          });
          if (!loadResult.ok) {
            throw new Error(loadResult.error || 'Failed to load GUI model into editor');
          }
          applied = true;
        } else {
          const result = await dispatch(updateDiagramModelThunk({ model: command.model as any }));
          if (updateDiagramModelThunk.rejected.match(result)) {
            throw new Error(result.error.message || 'Failed to persist assistant model update');
          }
          applied = true;
        }
      }

      if (!applied) {
        throw new Error('Assistant did not provide a valid update payload');
      }

      // Refresh undo state after successful injection
      refreshUndoState();
      setProgressMessage('');

      const injectionTiming = stopTimer('injection');
      const totalTiming = stopTimer('total');

      const infoMessage =
        typeof command.message === 'string' && command.message.trim()
          ? command.message
          : 'Applied assistant model update.';
      const injMsg = toKitMessage('assistant', infoMessage, { injectionType: command.action });
      setMessages((prev) => [...prev, injMsg]);
      const diagramLabel = command.diagramType || currentDiagramTypeRef.current || 'Diagram';
      attachMetaFromPayload(
        injMsg.id,
        command as unknown as Record<string, unknown>,
        'injection',
        `Applied to ${diagramLabel}`,
      );

      // Show timing summary after injection
      if (injectionTiming || totalTiming) {
        const timingText = [injectionTiming, totalTiming].filter(Boolean).join(' · ');
        setMessages((prev) => [...prev, toKitMessage('assistant', timingText, { isProgress: true })]);
      }
    } catch (error) {
      setProgressMessage('');
      const errorMessage = sanitizeForDisplay(error instanceof Error ? error.message : 'Unknown error');
      toast.error(`Could not apply assistant update: ${errorMessage}`);
      const errMsg = toKitMessage('assistant', `I wasn't able to apply that change \u2014 ${errorMessage}. Try rephrasing your request.`, { isError: true });
      setMessages((prev) => [...prev, errMsg]);
      attachMetaFromPayload(errMsg.id, {}, 'error', 'Update failed');
    }
  };

  /* ================================================================ */
  /*  handleAction                                                     */
  /* ================================================================ */

  /** Attach meta (suggestedActions/badge) to a message if the payload contains them. */
  const attachMetaFromPayload = (messageId: string, payload: Record<string, unknown>, badge?: MessageMeta['badge'], badgeLabel?: string) => {
    const suggested = payload.suggestedActions;
    const hasSuggested = Array.isArray(suggested) && suggested.length > 0;
    if (hasSuggested || badge) {
      setMessageMeta((prev) => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          ...(hasSuggested ? { suggestedActions: suggested as SuggestedAction[] } : {}),
          ...(badge ? { badge, badgeLabel } : {}),
        },
      }));
    }
  };

  const handleAction = async (payload: AssistantActionPayload) => {
    // Extract suggestedActions from assistant_message payloads before returning.
    if (payload.action === 'assistant_message') {
      // The message was already added by the onMessage handler; attach meta to the last assistant message.
      if (Array.isArray(payload.suggestedActions) && (payload.suggestedActions as unknown[]).length > 0) {
        setMessages((prev) => {
          const lastAssistant = [...prev].reverse().find((m) => m.role === 'assistant');
          if (lastAssistant) {
            attachMetaFromPayload(lastAssistant.id, payload as Record<string, unknown>);
          }
          return prev;
        });
      }
      return;
    }
    if (
      payload.action === 'inject_element' ||
      payload.action === 'inject_complete_system' ||
      payload.action === 'modify_model'
    ) {
      return;
    }

    /* ---- streaming actions ---- */

    if (payload.action === 'stream_start') {
      // First stream event — record response time (time until agent started replying)
      const responseTiming = stopTimer('response');
      if (responseTiming) {
        console.log(`[AssistantTiming] Stream started — ${responseTiming}`);
      }
      startTimer('streaming', 'Streaming duration');
      return;
    }

    if (payload.action === 'stream_chunk') {
      const { streamId, chunk } = payload as Record<string, any>;
      if (typeof streamId !== 'string' || typeof chunk !== 'string') return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id === streamId && last.role === 'assistant') {
          // Append chunk to existing streaming message
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk, isStreaming: true },
          ];
        }
        // New streaming message
        return [
          ...prev,
          { id: streamId, role: 'assistant' as const, content: chunk, isStreaming: true, createdAt: new Date() },
        ];
      });
      setStreamingMessageId(streamId);
      return;
    }

    if (payload.action === 'stream_done') {
      const { streamId, fullText } = payload as Record<string, any>;
      if (typeof streamId !== 'string') return;
      setMessages((prev) => prev.map((msg) =>
        msg.id === streamId
          ? { ...msg, content: (typeof fullText === 'string' ? fullText : undefined) || msg.content, isStreaming: false }
          : msg,
      ));
      setStreamingMessageId(null);
      // Clear any transient progress message when streaming completes.
      setProgressMessage('');

      // Show timing summary after stream completes
      const streamTiming = stopTimer('streaming');
      const totalTiming = stopTimer('total');
      if (streamTiming || totalTiming) {
        const timingText = [streamTiming, totalTiming].filter(Boolean).join(' · ');
        setMessages((prev) => [...prev, toKitMessage('assistant', timingText, { isProgress: true })]);
      }
      return;
    }

    /* ---- progress action ---- */

    if (payload.action === 'progress') {
      const progressMsg = typeof payload.message === 'string' ? payload.message : '';
      const step = typeof (payload as any).step === 'number' ? (payload as any).step as number : undefined;
      const total = typeof (payload as any).total === 'number' ? (payload as any).total as number : undefined;
      const label = step && total ? `[${step}/${total}] ${progressMsg}` : progressMsg;
      setProgressMessage(label);
      return;
    }

    if (payload.action === 'create_diagram_tab') {
      const diagramType = typeof payload.diagramType === 'string' ? payload.diagramType : '';
      if (!diagramType) return;

      try {
        // Ensure the correct diagram type is active before creating the new tab
        await ensureTargetDiagramReady(diagramType);

        // Create new tab
        const title = typeof payload.title === 'string' ? payload.title : undefined;
        const result = await dispatch(addDiagramThunk({
          diagramType: diagramType as SupportedDiagramType,
          title,
        })).unwrap();

        // Switch to the new tab
        if (result?.index !== undefined) {
          await dispatch(switchDiagramIndexThunk({
            diagramType: diagramType as SupportedDiagramType,
            index: result.index,
          })).unwrap();
          await waitForSwitchRender();
        }
      } catch (error) {
        console.error('[useAssistantLogic] Failed to create diagram tab:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Could not create new tab: ${errorMsg}`);
      }
      return;
    }

    if (payload.action === 'switch_diagram') {
      const diagramType = typeof payload.diagramType === 'string' ? payload.diagramType : '';
      if (!diagramType) return;
      const switched = await ensureTargetDiagramReady(diagramType);
      if (!switched) {
        setMessages((prev) => [...prev, toKitMessage('assistant', `Could not switch to ${diagramType}.`)]);
      } else {
        const reason = payload.reason;
        if (typeof reason === 'string' && reason.trim()) {
          setMessages((prev) => [...prev, toKitMessage('assistant', reason)]);
        }
      }
      return;
    }

    if (payload.action === 'trigger_generator') {
      const generatorType = payload.generatorType;
      const handler = onGenerateRef.current;
      if (!handler || typeof generatorType !== 'string') {
        setMessages((prev) => [...prev, toKitMessage('assistant', 'Generation is not available in this context.')]);
        return;
      }
      const result = await handler(generatorType as GeneratorType, payload.config);
      assistantClient.sendFrontendEvent('generator_result', {
        ok: result.ok,
        message:
          typeof payload.message === 'string' && payload.message.trim()
            ? payload.message
            : result.ok
              ? 'Generation completed successfully.'
              : result.error,
        metadata: result.ok && result.filename ? { filename: result.filename } : undefined,
      });
      return;
    }

    if (payload.action === 'trigger_export') {
      const format = typeof payload.format === 'string' ? payload.format : 'json';
      const msg = typeof payload.message === 'string' && payload.message.trim() ? payload.message : `Exporting project as ${format.toUpperCase()}\u2026`;
      setMessages((prev) => [...prev, toKitMessage('assistant', msg)]);
      window.dispatchEvent(new CustomEvent('wme:assistant-export-project', { detail: { format } }));
      return;
    }

    if (payload.action === 'trigger_deploy') {
      const msg = typeof payload.message === 'string' && payload.message.trim() ? payload.message : 'Starting deployment\u2026';
      setMessages((prev) => [...prev, toKitMessage('assistant', msg)]);
      window.dispatchEvent(new CustomEvent('wme:assistant-deploy-app', {
        detail: {
          platform: payload.platform ?? 'render',
          config: payload.config ?? {},
        },
      }));
      return;
    }

    /* ---- structured agent_error ---- */

    if (payload.action === 'agent_error') {
      const errorMsg = typeof payload.message === 'string' ? payload.message : 'Something went wrong on the assistant side.';
      const errorCode = typeof (payload as any).errorCode === 'string' ? (payload as any).errorCode as string : undefined;
      const suggestedRecovery = typeof (payload as any).suggestedRecovery === 'string' ? (payload as any).suggestedRecovery as string : undefined;
      const retryable = (payload as any).retryable === true;

      const errMsg = toKitMessage('assistant', errorMsg, { isError: true });
      setMessages((prev) => [...prev, errMsg]);

      // Attach error badge and recovery-based suggestedActions
      const meta: MessageMeta = { badge: 'error', badgeLabel: errorCode ? `Error: ${errorCode}` : 'Error' };
      if (retryable && suggestedRecovery) {
        meta.suggestedActions = [{ label: 'Try again', prompt: suggestedRecovery }];
      }
      setMessageMeta((prev) => ({ ...prev, [errMsg.id]: { ...prev[errMsg.id], ...meta } }));

      setIsGenerating(false);
      return;
    }

    if (payload.action === 'auto_generate_gui') {
      const diagramReady = await ensureTargetDiagramReady('GUINoCodeDiagram');
      if (!diagramReady) {
        setMessages((prev) => [...prev, toKitMessage('assistant', 'Could not switch to the GUI editor. Please switch manually and try again.')]);
        return;
      }
      const editorReady = await new Promise<boolean>((resolve) => {
        if ((window as any).__WME_GUI_EDITOR_READY__) { resolve(true); return; }
        const timeout = setTimeout(() => {
          window.removeEventListener('wme:gui-editor-ready', onReady);
          resolve((window as any).__WME_GUI_EDITOR_READY__ === true);
        }, 8000);
        const onReady = () => {
          clearTimeout(timeout);
          window.removeEventListener('wme:gui-editor-ready', onReady);
          resolve(true);
        };
        window.addEventListener('wme:gui-editor-ready', onReady);
      });
      if (!editorReady) {
        setMessages((prev) => [...prev, toKitMessage('assistant', 'The GUI editor did not become ready in time. Please try again.')]);
        return;
      }
      setMessages((prev) => [...prev, toKitMessage('assistant', 'Generating GUI from your Class Diagram\u2026')]);
      const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('wme:assistant-auto-generate-gui-done', onDone);
          resolve({ ok: false, error: 'Timed out' });
        }, 30_000);
        const onDone = (event: Event) => {
          clearTimeout(timeout);
          window.removeEventListener('wme:assistant-auto-generate-gui-done', onDone);
          resolve((event as CustomEvent).detail ?? { ok: false, error: 'No response' });
        };
        window.addEventListener('wme:assistant-auto-generate-gui-done', onDone);
        window.dispatchEvent(new CustomEvent('wme:assistant-auto-generate-gui'));
      });
      if (result.ok) {
        setMessages((prev) => [
          ...prev,
          toKitMessage('assistant',
            typeof payload.message === 'string' && payload.message.trim()
              ? payload.message
              : '\u2713 GUI generated successfully from your Class Diagram!'),
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          toKitMessage('assistant', `Could not generate the GUI: ${sanitizeForDisplay(result.error || 'unknown error')}.`),
        ]);
      }
      return;
    }
  };

  /* ---- WebSocket lifecycle ---- */

  // Track active state in a ref so handlers (which are registered once) can
  // check it synchronously without needing to re-register on every toggle.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // Sync connection status when drawer reopens
  useEffect(() => {
    if (isActive) {
      setConnectionStatus(
        (assistantClient.connectionState as ConnectionStatus) || (assistantClient.connected ? 'connected' : 'disconnected'),
      );
    }
  }, [isActive, assistantClient]);

  // Register handlers and connect once, keep alive for the lifetime of the hook.
  useEffect(() => {
    assistantClient.onMessage((message) => {
      // Stop response timer on first non-streaming message
      const responseTiming = stopTimer('response');
      const totalTiming = stopTimer('total');

      const role = message.isUser ? 'user' : 'assistant';
      const kitMsg = toKitMessage(role, toAssistantText(message.message));
      setMessages((prev) => [...prev, kitMsg]);

      // Show timing as a small system message in chat
      if (responseTiming || totalTiming) {
        const timingText = [responseTiming, totalTiming].filter(Boolean).join(' · ');
        setMessages((prev) => [...prev, toKitMessage('assistant', timingText, { isProgress: true })]);
      }

      // Extract suggestedActions from the raw message payload if present.
      const raw = message as unknown as Record<string, unknown>;
      const suggested = raw.suggestedActions ?? (typeof raw.message === 'object' && raw.message !== null ? (raw.message as Record<string, unknown>).suggestedActions : undefined);
      if (Array.isArray(suggested) && suggested.length > 0) {
        setMessageMeta((prev) => ({
          ...prev,
          [kitMsg.id]: { ...prev[kitMsg.id], suggestedActions: suggested as SuggestedAction[] },
        }));
      }

      // Clear any transient progress message when a real message arrives.
      setProgressMessage('');
    });
    assistantClient.onConnection((connected) => {
      let next: ConnectionStatus;
      if (connected) {
        next = 'connected';
      } else if (assistantClient.connectionState === 'closed' || assistantClient.connectionState === 'disconnected') {
        next = assistantClient.connected ? (assistantClient.connectionState as ConnectionStatus) : 'reconnecting';
      } else {
        next = assistantClient.connectionState as ConnectionStatus;
      }
      setConnectionStatus((prev) => (prev === next ? prev : next));
    });
    assistantClient.onTyping((typing) => {
      setIsGenerating((prev) => (prev === typing ? prev : typing));
    });
    assistantClient.onInjection((command) => {
      enqueueAssistantTask(() => handleInjection(command));
    });
    assistantClient.onAction((payload) => {
      enqueueAssistantTask(() => handleAction(payload));
    });

    setConnectionStatus('connecting');
    assistantClient.connect().catch(() => {
      setConnectionStatus('disconnected');
      toast.error('Could not reach the AI assistant \u2014 make sure the backend is running.');
    });

    // Only disconnect when the component fully unmounts (page navigation),
    // not when the drawer is toggled open/closed.
    return () => {
      assistantClient.clearHandlers();
      assistantClient.disconnect({ allowReconnect: false, clearQueue: true });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantClient]);

  /* ---- isGenerating timeout safety net ---- */

  useEffect(() => {
    if (!isGenerating) return;
    const timeout = setTimeout(() => {
      setIsGenerating(false);
      setMessages((prev) => [...prev, toKitMessage('assistant', 'The assistant is taking too long to respond. Please try again.')]);
    }, 120000);
    return () => clearTimeout(timeout);
  }, [isGenerating]);

  /* ---- send message ---- */

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleSubmit = async (
    event?: { preventDefault?: () => void },
    options?: { experimental_attachments?: FileList; overrideText?: string },
  ) => {
    event?.preventDefault?.();
    const normalizedInput = (options?.overrideText ?? inputValue).trim();
    const attachedFiles = options?.experimental_attachments;
    const hasFiles = attachedFiles && attachedFiles.length > 0;

    if ((!normalizedInput && !hasFiles) || isGenerating) return;
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    try {
      // --- File size validation ---
      if (hasFiles) {
        for (const file of Array.from(attachedFiles!)) {
          if (file.size > MAX_FILE_SIZE) {
            toast.error(`File "${safeName(file.name)}" is too large (max 10MB).`);
            return;
          }
        }
      }

      // --- Rate limit check ---
      const messageText = normalizedInput || (hasFiles ? 'Convert this file to a diagram' : '');
      const rateLimitCheck = await rateLimiter.checkRateLimit(messageText);
      setRateLimitStatus(rateLimiter.getRateLimitStatus());
      if (!rateLimitCheck.allowed) {
        toast.error(rateLimitCheck.reason || 'Rate limit exceeded. Please wait before sending another message.');
        return;
      }

      const displayText = hasFiles
        ? `${normalizedInput || 'Convert this file'} \ud83d\udcce ${Array.from(attachedFiles!).map((f) => safeName(f.name)).join(', ')}`
        : normalizedInput;

      setMessages((prev) => [...prev, toKitMessage('user', displayText)]);
      setInputValue('');
      if (normalizedInput) setLastSentMessage(normalizedInput);

      let attachments: Array<{ filename: string; content: string; mimeType: string }> | undefined;
      if (hasFiles) {
        try {
          attachments = await Promise.all(
            Array.from(attachedFiles!).map(async (file) => ({
              filename: file.name,
              content: await readFileAsBase64(file),
              mimeType: file.type || 'application/octet-stream',
            })),
          );
        } catch (error) {
          console.error('Failed to read attached files:', error);
          toast.error('Could not read the attached file(s). Please try again.');
          return;
        }
      }

      const context = buildWorkspaceContext();
      const modelSnapshot = modelingServiceRef.current?.getCurrentModel() || context.activeModel;
      startTimer('response', 'Agent response time');
      startTimer('total', 'Total round-trip (response + render)');
      const sendResult = assistantClient.sendMessage(messageText, context.activeDiagramType, modelSnapshot, context, attachments);

      // Analytics: track assistant message
      const activeModel = modelSnapshot as any;
      const elementsCount = activeModel?.elements ? Object.keys(activeModel.elements).length : 0;
      const relationshipsCount = activeModel?.relationships ? Object.keys(activeModel.relationships).length : 0;
      getPostHog()?.capture('assistant_message', {
        diagram_type: context.activeDiagramType,
        message_length: messageText.length,
        elements_count: elementsCount,
        relationships_count: relationshipsCount,
        total_size: elementsCount + relationshipsCount,
      });

      // Update rate limit status after send
      setRateLimitStatus(rateLimiter.getRateLimitStatus());

      if (sendResult === 'queued') {
        toast.info('Reconnecting to the assistant \u2014 your message will be sent automatically.');
        setConnectionStatus('connecting');
        assistantClient.connect().catch(() => setConnectionStatus('disconnected'));
      } else if (sendResult === 'error') {
        toast.error('Could not send your message \u2014 please try again.');
      }
    } finally {
      isSendingRef.current = false;
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob): Promise<void> => {
    if (isSendingRef.current || isGenerating) return;

    isSendingRef.current = true;
    try {
      const rateLimitCheck = await rateLimiter.checkRateLimit('voice message');
      setRateLimitStatus(rateLimiter.getRateLimitStatus());
      if (!rateLimitCheck.allowed) {
        toast.error(rateLimitCheck.reason || 'Rate limit exceeded. Please wait before sending another message.');
        return;
      }

      const audioBase64 = await readBlobAsBase64(audioBlob);

      const context = buildWorkspaceContext();
      const modelSnapshot = modelingServiceRef.current?.getCurrentModel() || context.activeModel;
      const mimeType = audioBlob.type || 'audio/wav';
      const sendResult = assistantClient.sendVoiceMessage(
        audioBase64,
        mimeType,
        context.activeDiagramType,
        modelSnapshot,
        context,
      );

      setRateLimitStatus(rateLimiter.getRateLimitStatus());

      if (sendResult === 'queued') {
        toast.info('Reconnecting to the assistant — your voice message will be sent automatically.');
        setConnectionStatus('connecting');
        assistantClient.connect().catch(() => setConnectionStatus('disconnected'));
      } else if (sendResult === 'error') {
        toast.error('Could not send your voice message — please try again.');
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
      toast.error('Could not process your voice message. Please try again.');
    } finally {
      isSendingRef.current = false;
    }
  };

  const stopGenerating = () => setIsGenerating(false);

  const clearConversation = () => {
    setMessages([]);
    setIsGenerating(false);
    setInputValue('');
    setMessageMeta({});
    setProgressMessage('');
    setStreamingMessageId(null);
  };

  /* ---- undo ---- */

  const handleUndo = useCallback(() => {
    const snapshot = popUndo();
    if (!snapshot) return;

    // Restore the model via the editor and Redux
    try {
      if (editor) {
        editor.model = snapshot.model;
      }
      dispatch(updateDiagramModelThunk({ model: snapshot.model }));

      setMessages((prev) => [
        ...prev,
        toKitMessage('assistant', `Undone: ${snapshot.description}`),
      ]);
    } catch (error) {
      console.error('[useAssistantLogic] Undo failed:', error);
    }

    refreshUndoState();
  }, [editor, dispatch]);

  return {
    messages,
    inputValue,
    setInputValue,
    isGenerating,
    connectionStatus,
    rateLimitStatus,
    messageMeta,
    progressMessage,
    lastSentMessage,
    streamingMessageId,
    messageListContainerRef: messageListContainerRef as React.RefObject<HTMLDivElement>,
    handleSubmit,
    sendVoiceMessage,
    stopGenerating,
    clearConversation,
    handleUndo,
    canUndo: undoAvailable,
    assistantClient,
  };
}
