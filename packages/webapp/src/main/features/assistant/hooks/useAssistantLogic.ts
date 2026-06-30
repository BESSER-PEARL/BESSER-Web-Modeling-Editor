/**
 * useAssistantLogic -- thin orchestrator that composes focused sub-hooks.
 *
 * Sub-hooks:
 *  - useWebSocketConnection -- connection lifecycle & status
 *  - useStreamingResponse   -- streaming state, chunk assembly, progress
 *  - useModelInjection      -- injection handling, undo/redo, diagram switching
 *
 * This orchestrator owns:
 *  - handleSubmit (sends user messages)
 *  - handleAction (routes backend action payloads)
 *  - The main useEffect that wires up assistantClient handlers
 *  - Message list state and metadata
 *
 * The public API (return value) is identical to the pre-refactor version so
 * that AssistantWidget and AssistantWorkspaceDrawer require zero changes.
 */

import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { getPostHog } from '../../../shared/services/analytics/lazy-analytics';
import { AssistantClient, getSharedAssistantClient, type AssistantActionPayload } from '../services';
import {
  conversationStore,
  setConversationHandlers,
  wireConversationDispatchers,
} from './assistantConversationStore';
import { UML_BOT_WS_URL } from '../../../shared/constants/constant';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { useProject } from '../../../app/hooks/useProject';
import { updateDiagramModelThunk, selectActiveDiagram, addDiagramThunk, switchDiagramIndexThunk, bumpEditorRevision } from '../../../app/store/workspaceSlice';
import { ApollonEditorContext } from '../../editors/uml/apollon-editor-context';
import {
  UMLModelingService,
  RateLimiterService,
  type RateLimitStatus,
  type ChatMessage,
  type InjectionCommand,
  formatErrorForUser,
} from '../services';
import { isUMLModel, type ProjectDiagram, type SupportedDiagramType } from '../../../shared/types/project';
import type { GeneratorType } from '../../../app/shell/workspace-types';
import type { GenerationResult } from '../../generation/types';

import { useWebSocketConnection, type ConnectionStatus } from './useWebSocketConnection';
import { useStreamingResponse, startTimer, stopTimer } from './useStreamingResponse';
import { useModelInjection } from './useModelInjection';
import { useSmartGenTrigger } from '../../smart-generation/hooks/useSmartGenTrigger';
import type { TriggerSmartGeneratorPayload } from '../../smart-generation/types';
import { downloadFile, copyToClipboard } from '../../../shared/utils/download';
import { appVersion } from '../../../shared/constants/application-constants';
import {
  buildIssueReport,
  buildIssueReportMarkdown,
  issueReportFilename,
  type IssueReportContext,
} from './buildIssueReport';

/* ------------------------------------------------------------------ */
/*  Types  (re-exported so consumers keep importing from here)         */
/* ------------------------------------------------------------------ */

export type { ConnectionStatus } from './useWebSocketConnection';

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
  /**
   * True when the agent reported a rate-limit / auth error and the user can
   * recover by supplying their own API key. Surfaces render an inline
   * "Add your API key" button that opens the AssistantByokDialog.
   */
  needsApiKey?: boolean;
}

export interface UseAssistantLogicOptions {
  /** Whether the assistant panel is currently open/visible. */
  isActive: boolean;
  /**
   * Switch to a different diagram type.  Returns true on success.
   * The widget and drawer implement this differently (navigate vs callback).
   */
  switchDiagram: (targetType: string) => Promise<boolean>;
  /** Trigger code generation (optional -- not available in all contexts). */
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
  /**
   * Recent sequence of progress steps (most-recent last, capped to the last
   * few). Surfaces render this as an evolving step list so long operations
   * feel responsive. Clears automatically when the operation finishes.
   */
  progressSteps: string[];
  /** The last user-sent message text (for input recall via Up arrow). */
  lastSentMessage: string;
  /** The id of the message currently being streamed, or null when idle. */
  streamingMessageId: string | null;

  /* refs */
  messageListContainerRef: React.RefObject<HTMLDivElement>;

  /* scroll-follow state */
  /** True when the user has scrolled up — surfaces render a
   * "scroll to bottom" affordance instead of being force-scrolled. */
  showScrollToBottom: boolean;
  /** Smooth-scroll the message list to the bottom and re-enable
   * auto-follow. */
  scrollMessagesToBottom: () => void;

  /* actions */
  handleSubmit: (
    event?: { preventDefault?: () => void },
    options?: { experimental_attachments?: FileList; overrideText?: string },
  ) => Promise<void>;
  sendVoiceMessage: (audioBlob: Blob) => Promise<void>;
  stopGenerating: () => void;
  clearConversation: () => void;
  /**
   * Build a privacy-safe issue report (conversation + non-secret workspace
   * context) and deliver it: downloads a Markdown transcript and copies it to
   * the clipboard, with a toast confirmation. NEVER includes the BYOK API key.
   */
  reportIssue: () => Promise<void>;
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

const UML_DIAGRAM_TYPES = new Set(['ClassDiagram', 'ObjectDiagram', 'StateMachineDiagram', 'AgentDiagram', 'UserDiagram']);
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
  /* ---- core state (owned by orchestrator) ---- */
  // Conversation lives in a SHARED external store so the floating widget and the
  // workspace drawer render IDENTICAL content (one client, one session, one
  // conversation). The store mutators are setState-compatible, so every existing
  // setMessages/setMessageMeta call site below works unchanged.
  const messages = useSyncExternalStore(conversationStore.subscribe, conversationStore.getMessages);
  const setMessages = conversationStore.setMessages;
  const messageMeta = useSyncExternalStore(conversationStore.subscribe, conversationStore.getMessageMeta);
  const setMessageMeta = conversationStore.setMessageMeta;
  const [inputValue, setInputValue] = useState('');
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({
    requestsLastMinute: 0,
    requestsLastHour: 0,
    cooldownRemaining: 0,
  });
  const [lastSentMessage, setLastSentMessage] = useState('');

  const messageListContainerRef = useRef<HTMLDivElement>(null);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isSendingRef = useRef(false);

  /**
   * Id of the optimistic "🎤 Transcribing…" user bubble appended the moment a
   * voice message is sent. It exists so the drawer's welcome→chat split (gated
   * on `messages.length > 0`) flips to the chat view immediately, exactly like
   * the text path does. When the agent's transcription echo (an incoming
   * `isUser` message carrying the spoken text) arrives, we replace this bubble
   * in place rather than appending a second one — see the onMessage handler.
   * Null when no voice message is awaiting its transcription echo.
   */
  const voicePlaceholderIdRef = useRef<string | null>(null);

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

  // Shared singleton: the floating widget and the workspace drawer use ONE
  // client (one socket, one session id) so they share the same conversation
  // instead of opening two sockets with the same id (BAF reply collision).
  const [assistantClient] = useState(() =>
    getSharedAssistantClient(UML_BOT_WS_URL, {
      clientMode: 'workspace',
      contextProvider: buildWorkspaceContext,
    }),
  );

  // Keep the shared client's context provider pointed at THIS mounted surface's
  // live workspace state (the singleton only captured the first surface's).
  useEffect(() => {
    assistantClient.setContextProvider(buildWorkspaceContext);
  }, [assistantClient, buildWorkspaceContext]);

  const [rateLimiter] = useState(
    () =>
      new RateLimiterService({
        maxRequestsPerMinute: 15,
        maxRequestsPerHour: 250,
        maxMessageLength: 1000,
        cooldownPeriodMs: 1000,
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

  /* ---- auto-scroll on new messages (only while following the bottom) ---- */

  // Streaming runs mutate `messages` on every SSE/WS delta; forcing
  // scrollTop on each one made it impossible to scroll up and read
  // while a generation was running. Follow the bottom only while the
  // user is already there (within a small tolerance); otherwise leave
  // their position alone and surface a "scroll to bottom" button.
  const isAtBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  // The surfaces (widget / drawer) attach the container ref in their
  // own JSX, possibly after mount — so the scroll listener is attached
  // lazily from the messages effect, re-attaching if the element changes.
  const scrollListenerTargetRef = useRef<HTMLDivElement | null>(null);

  const ensureScrollListener = useCallback(() => {
    const el = messageListContainerRef.current;
    if (!el || scrollListenerTargetRef.current === el) return;
    scrollListenerTargetRef.current = el;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
      isAtBottomRef.current = atBottom;
      setShowScrollToBottom(!atBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
  }, []);

  const scrollMessagesToBottom = useCallback(() => {
    const el = messageListContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    isAtBottomRef.current = true;
    setShowScrollToBottom(false);
  }, []);

  useEffect(() => {
    ensureScrollListener();
    const el = messageListContainerRef.current;
    if (el && isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, ensureScrollListener]);

  /* ================================================================ */
  /*  Sub-hooks                                                        */
  /* ================================================================ */

  const connection = useWebSocketConnection({ assistantClient, isActive });

  const streaming = useStreamingResponse();

  const injection = useModelInjection({
    dispatch,
    editor,
    modelingServiceRef,
    currentModelRef,
    currentProjectRef,
    currentDiagramTypeRef,
    switchDiagramRef,
    setMessages,
    setMessageMeta,
    setProgressMessage: streaming.setProgressMessage,
  });

  /* ---- Smart Generator trigger handler ---- */

  // Pass stable React state setters directly — wrapping them in an
  // arrow function creates a new identity on every render, thrashing
  // the downstream useCallback deps in `useSmartGenTrigger`.
  // (`onRunFinished` is exempt: the hook stores it in a ref, so the
  // inline arrow's changing identity is harmless.)
  const smartGen = useSmartGenTrigger({
    currentProjectRef,
    setMessages,
    setIsGenerating: streaming.setIsGenerating,
    onRunFinished: (result) => {
      // Close the agent loop: report the smart-gen outcome back to the
      // modeling agent exactly like the deterministic trigger_generator
      // path does, so the agent can react ("the build failed because…")
      // instead of staying blind to the run's outcome.
      try {
        if (!assistantClient) return;
        const messageText = result.ok
          ? result.incomplete
            ? `Vibe-Driven Generator produced output, but the run stopped early so it may be incomplete${result.incompleteReason ? `: ${result.incompleteReason}` : ''}.`
            : `Vibe-Driven Generator finished successfully${result.fileName ? ` — ${result.fileName} is ready for the user to download` : ''}.`
          : result.errorCode === 'CANCELLED'
            ? 'Vibe-Driven Generator run was cancelled by the user.'
            : `Vibe-Driven Generator failed (${result.errorCode ?? 'UNKNOWN'}).`;
        assistantClient.sendFrontendEvent('generator_result', {
          ok: result.ok,
          message: messageText,
          metadata: {
            smart: true,
            runId: result.runId,
            costUsd: result.costUsd,
            generator_used: result.generatorUsed,
            errorCode: result.errorCode,
            incomplete: result.incomplete,
            incompleteReason: result.incompleteReason,
          },
        });
      } catch (error) {
        console.error('[useAssistantLogic] failed to report smart-gen result', error);
      }
    },
  });

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

  /* ---- task queue (serialises async operations) ---- */

  const enqueueAssistantTask = (task: () => Promise<void> | void) => {
    operationQueueRef.current = operationQueueRef.current
      .then(async () => { await task(); })
      .catch((error) => {
        console.error('[useAssistantLogic] task queue error:', error);
        streaming.setIsGenerating(false);
        streaming.setProgressMessage('');
        toast.error(formatErrorForUser(error));
      });
  };

  /* ---- meta helpers ---- */

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

  /* ================================================================ */
  /*  handleAction                                                     */
  /* ================================================================ */

  const handleAction = async (payload: AssistantActionPayload) => {
    // Let the streaming sub-hook handle streaming/progress actions first
    if (streaming.handleStreamingAction(payload, setMessages)) {
      return;
    }

    // Extract suggestedActions from assistant_message payloads before returning.
    if (payload.action === 'assistant_message') {
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

    if (payload.action === 'create_diagram_tab') {
      const diagramType = typeof payload.diagramType === 'string' ? payload.diagramType : '';
      if (!diagramType) return;

      try {
        await injection.ensureTargetDiagramReady(diagramType);

        const title = typeof payload.title === 'string' ? payload.title : undefined;
        const result = await dispatch(addDiagramThunk({
          diagramType: diagramType as SupportedDiagramType,
          title,
        })).unwrap();

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
      const switched = await injection.ensureTargetDiagramReady(diagramType);
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

    if (payload.action === 'trigger_smart_generator') {
      // Emitted by the modeling agent when the user's request is a
      // complex custom build ("full-stack FastAPI + JWT + Postgres").
      // The smart generator runs server-side with the user's BYOK key
      // and streams its progress back into this chat.
      const smartPayload: TriggerSmartGeneratorPayload = {
        action: 'trigger_smart_generator',
        instructions:
          typeof payload.instructions === 'string' ? payload.instructions : '',
        provider:
          payload.provider === 'anthropic' ||
          payload.provider === 'openai' ||
          payload.provider === 'mistral'
            ? payload.provider
            : undefined,
        llmModel: typeof payload.llmModel === 'string' ? payload.llmModel : undefined,
        message: typeof payload.message === 'string' ? payload.message : undefined,
      };
      if (!smartPayload.instructions) {
        setMessages((prev) => [
          ...prev,
          toKitMessage(
            'assistant',
            'Vibe-Driven Generator: missing instructions from the modeling agent.',
            { isError: true },
          ),
        ]);
        return;
      }
      // Fire-and-forget: a smart-gen run can take 5-15 minutes, and the
      // action queue serialises handleAction calls. Awaiting here would
      // block every other incoming WebSocket action (modeling agent
      // stream chunks, injections, progress markers) for the duration.
      // The hook manages its own streaming lifecycle independently.
      // Explicit .catch so an unhandled rejection can't poison the
      // React root — the hook already handles user-facing errors
      // internally, but a thrown Redux / dispatch error would otherwise
      // surface as an unhandled promise rejection.
      smartGen.handleTrigger(smartPayload).catch((err) => {
        console.error('[useAssistantLogic] smartGen.handleTrigger rejected', err);
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

      // If a voice transcription was still pending, the run failed before the
      // echo arrived — drop the stuck "🎤 Transcribing…" placeholder bubble.
      const stuckVoicePlaceholderId = voicePlaceholderIdRef.current;
      voicePlaceholderIdRef.current = null;

      const errMsg = toKitMessage('assistant', errorMsg, { isError: true });
      setMessages((prev) => {
        const cleaned = stuckVoicePlaceholderId
          ? prev.filter((m) => m.id !== stuckVoicePlaceholderId)
          : prev;
        return [...cleaned, errMsg];
      });

      const meta: MessageMeta = { badge: 'error', badgeLabel: errorCode ? `Error: ${errorCode}` : 'Error' };
      // A rate-limit or auth error is recoverable by the user supplying their
      // own API key — flag it so the surface shows an inline "Add your API
      // key" button that opens the AssistantByokDialog.
      if (errorCode === 'rate_limit' || errorCode === 'auth_error') {
        meta.needsApiKey = true;
      }
      if (retryable && suggestedRecovery) {
        meta.suggestedActions = [{ label: 'Try again', prompt: suggestedRecovery }];
      }
      setMessageMeta((prev) => ({ ...prev, [errMsg.id]: { ...prev[errMsg.id], ...meta } }));

      streaming.setIsGenerating(false);
      return;
    }

    if (payload.action === 'auto_generate_gui') {
      const diagramReady = await injection.ensureTargetDiagramReady('GUINoCodeDiagram');
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

  /* ================================================================ */
  /*  Wire up assistantClient handlers                                 */
  /* ================================================================ */

  useEffect(() => {
    /* ---- SHARED single-dispatch handlers (run ONCE per event) ----
     * These append to the SHARED conversation store and apply real diagram
     * side-effects, so they must run exactly once -- NOT once per mounted
     * surface (else messages double-append and injections double-apply).
     * setConversationHandlers points the single wired dispatchers at this
     * surface's handlers (last writer wins; the handlers are equivalent across
     * surfaces); wireConversationDispatchers attaches them to the shared client
     * exactly once. The generating/progress clear lives in the PER-SURFACE
     * handler below since that is local UI state owned per surface. */
    const onMessage = (message: ChatMessage) => {
      const responseTiming = stopTimer('response');
      const totalTiming = stopTimer('total');

      const role = message.isUser ? 'user' : 'assistant';

      // Voice transcription echo: the backend transcribes the audio (whisper)
      // and sends it back as an incoming USER message. If we optimistically
      // added a "🎤 Transcribing…" placeholder in sendVoiceMessage, replace it
      // in place with the real transcribed text instead of appending a second
      // user bubble (which would leave a duplicate). This keeps exactly ONE
      // user bubble for the voice message.
      if (message.isUser && voicePlaceholderIdRef.current) {
        const placeholderId = voicePlaceholderIdRef.current;
        voicePlaceholderIdRef.current = null;
        const transcribedText = toAssistantText(message.message);
        setMessages((prev) => {
          let replaced = false;
          const next = prev.map((m) => {
            if (m.id === placeholderId) {
              replaced = true;
              return { ...m, content: transcribedText };
            }
            return m;
          });
          // Defensive: if the placeholder was cleared (e.g. New Chat) before
          // the echo arrived, fall back to appending so the user still sees
          // their transcription rather than losing it silently.
          return replaced ? next : [...next, toKitMessage(role, transcribedText)];
        });
        return;
      }

      // Voice placeholder is still pending but an ASSISTANT error/timeout
      // arrived (no transcription echo is coming). Drop the stuck
      // "🎤 Transcribing…" bubble so the user isn't left with a frozen
      // placeholder — the error message itself explains what happened.
      if (
        !message.isUser &&
        voicePlaceholderIdRef.current &&
        (message as unknown as { action?: string }).action === 'agent_error'
      ) {
        const placeholderId = voicePlaceholderIdRef.current;
        voicePlaceholderIdRef.current = null;
        setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
      }

      const kitMsg = toKitMessage(role, toAssistantText(message.message));
      setMessages((prev) => [...prev, kitMsg]);

      if (responseTiming || totalTiming) {
        const timingText = [responseTiming, totalTiming].filter(Boolean).join(' \u00b7 ');
        setMessages((prev) => [...prev, toKitMessage('assistant', timingText, { isProgress: true })]);
      }

      const raw = message as unknown as Record<string, unknown>;
      const suggested = raw.suggestedActions ?? (typeof raw.message === 'object' && raw.message !== null ? (raw.message as Record<string, unknown>).suggestedActions : undefined);
      if (Array.isArray(suggested) && suggested.length > 0) {
        setMessageMeta((prev) => ({
          ...prev,
          [kitMsg.id]: { ...prev[kitMsg.id], suggestedActions: suggested as SuggestedAction[] },
        }));
      }
    };

    const onInjection = (command: InjectionCommand) => {
      enqueueAssistantTask(() => injection.handleInjection(command));
    };
    const onAction = (payload: AssistantActionPayload) => {
      enqueueAssistantTask(() => handleAction(payload));
    };

    setConversationHandlers({ onMessage, onInjection, onAction });
    wireConversationDispatchers(assistantClient);

    /* ---- PER-SURFACE handlers (run for EACH mounted surface) ----
     * Clearing the generating/progress indicator is local UI state owned by
     * this surface's useStreamingResponse, so it must fire for BOTH surfaces
     * (widget and drawer), not just the single-dispatch winner. The backend
     * always sends a final message (success or error) — and a 45s synthetic
     * timeout message — so receiving ANY message means generation is done. The
     * typing handler likewise mirrors the shared client's typing broadcast into
     * this surface's isGenerating. Both are idempotent UI side-effects. */
    const unsubGenClear = assistantClient.onMessage(() => {
      streaming.setIsGenerating(false);
      streaming.setProgressMessage('');
    });
    const unsubTyping = streaming.registerTypingHandler(assistantClient);

    return () => {
      unsubGenClear();
      unsubTyping?.();
    };
    // NOTE: connection lifecycle (connect/disconnect/onConnection) is handled by
    // useWebSocketConnection. The SHARED message/injection/action dispatchers are
    // wired once on the shared client and intentionally persist across a single
    // surface unmounting (the other surface still needs them); only this
    // surface's per-surface handlers are torn down here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantClient]);

  /* ================================================================ */
  /*  handleSubmit                                                     */
  /* ================================================================ */

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleSubmit = async (
    event?: { preventDefault?: () => void },
    options?: { experimental_attachments?: FileList; overrideText?: string },
  ) => {
    event?.preventDefault?.();
    const normalizedInput = (options?.overrideText ?? inputValue).trim();
    const attachedFiles = options?.experimental_attachments;
    const hasFiles = attachedFiles && attachedFiles.length > 0;

    if ((!normalizedInput && !hasFiles) || streaming.isGenerating) return;
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

      // Build attachment previews for the message bubble
      let messageAttachments: Array<{ name: string; contentType: string; url: string }> | undefined;
      if (hasFiles) {
        messageAttachments = await Promise.all(
          Array.from(attachedFiles!).map(async (file) => {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
            return { name: file.name, contentType: file.type || 'application/octet-stream', url: dataUrl };
          }),
        );
      }

      setMessages((prev) => [
        ...prev,
        { ...toKitMessage('user', displayText), experimental_attachments: messageAttachments },
      ]);
      setInputValue('');
      if (normalizedInput) setLastSentMessage(normalizedInput);

      // Clear any displayed quick-action buttons
      setMessageMeta((prev) => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          if (updated[key]?.suggestedActions) {
            updated[key] = { ...updated[key], suggestedActions: undefined };
          }
        }
        return updated;
      });

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
      const sendResult = assistantClient.sendMessage(messageText, context.activeDiagramType, context, attachments);

      // Analytics
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

      setRateLimitStatus(rateLimiter.getRateLimitStatus());

      if (sendResult === 'queued') {
        toast.info('Reconnecting to the assistant \u2014 your message will be sent automatically.');
        connection.setConnectionStatus('connecting');
        assistantClient.connect().catch(() => connection.setConnectionStatus('disconnected'));
      } else if (sendResult === 'error') {
        toast.error('Could not send your message \u2014 please try again.');
      }
    } finally {
      isSendingRef.current = false;
    }
  };

  /** Remove the optimistic voice placeholder bubble (failure/cleanup paths). */
  const removeVoicePlaceholder = () => {
    const placeholderId = voicePlaceholderIdRef.current;
    if (!placeholderId) return;
    voicePlaceholderIdRef.current = null;
    setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
  };

  const sendVoiceMessage = async (audioBlob: Blob): Promise<void> => {
    if (isSendingRef.current || streaming.isGenerating) return;

    isSendingRef.current = true;
    try {
      const rateLimitCheck = await rateLimiter.checkRateLimit('voice message');
      setRateLimitStatus(rateLimiter.getRateLimitStatus());
      if (!rateLimitCheck.allowed) {
        toast.error(rateLimitCheck.reason || 'Rate limit exceeded. Please wait before sending another message.');
        return;
      }

      const audioBase64 = await readBlobAsBase64(audioBlob);

      // Optimistically append a placeholder user bubble so the drawer's
      // welcome->chat split (gated on messages.length > 0) flips to the chat
      // view immediately, matching the text path. The transcription echo
      // replaces this bubble in place (see onMessage). Cleaned up on the
      // error path below so a failed send doesn't leave it lingering.
      const voicePlaceholder = toKitMessage('user', '\ud83c\udfa4 Transcribing\u2026');
      voicePlaceholderIdRef.current = voicePlaceholder.id;
      setMessages((prev) => [...prev, voicePlaceholder]);

      const context = buildWorkspaceContext();
      const mimeType = audioBlob.type || 'audio/wav';
      const sendResult = assistantClient.sendVoiceMessage(
        audioBase64,
        mimeType,
        context.activeDiagramType,
        context,
      );

      setRateLimitStatus(rateLimiter.getRateLimitStatus());

      if (sendResult === 'queued') {
        // Keep the placeholder: the message will be sent on reconnect and its
        // transcription echo will replace the bubble in place.
        toast.info('Reconnecting to the assistant \u2014 your voice message will be sent automatically.');
        connection.setConnectionStatus('connecting');
        assistantClient.connect().catch(() => connection.setConnectionStatus('disconnected'));
      } else if (sendResult === 'error') {
        // Send failed outright - no echo is coming, so drop the placeholder.
        removeVoicePlaceholder();
        toast.error('Could not send your voice message \u2014 please try again.');
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
      removeVoicePlaceholder();
      toast.error('Could not process your voice message. Please try again.');
    } finally {
      isSendingRef.current = false;
    }
  };

  const stopGenerating = () => {
    // Also abort any in-flight Smart Generator run so the SSE stream
    // disconnects and the user stops paying for LLM tokens.
    smartGen.abortActive();
    // Reliably tear down the whole "generating/processing" UI state so a
    // stuck modeling-agent op (e.g. lingering "Updating model…") can be
    // dismissed by the user. We can't truly cancel an in-flight WebSocket
    // op on the backend, but we stop the UI from waiting on it: clear the
    // generating flag, the progress label, and any in-progress streaming
    // message id. Any late server response still lands in the chat
    // normally (onMessage re-clears these), so this is safe to call.
    streaming.setIsGenerating(false);
    streaming.setProgressMessage('');
    streaming.setStreamingMessageId(null);
  };

  const clearConversation = () => {
    // Abort any in-flight Smart Generator run first — otherwise the
    // stream keeps firing events into a cleared message list, where
    // the message-lookup-by-id silently no-ops and the user's BYOK
    // budget keeps draining.
    smartGen.abortActive();
    // Drop any pending voice placeholder tracking — the bubble is wiped with
    // the rest of the list, so a late transcription echo should append fresh
    // rather than try to replace a now-gone id.
    voicePlaceholderIdRef.current = null;
    setMessages([]);
    streaming.setIsGenerating(false);
    setInputValue('');
    setMessageMeta({});
    streaming.setProgressMessage('');
    streaming.setStreamingMessageId(null);
    // Start a fresh backend conversation session too. The agent keys its
    // conversation memory on the sessionId, so without this a "new chat" or a
    // project switch would reuse the old memory — the agent then "remembers"
    // a previous project and hallucinates from it.
    assistantClient.resetSession();
  };

  /* ================================================================ */
  /*  reportIssue — export conversation + context for the team         */
  /* ================================================================ */

  // Builds the non-secret context block. Reuses buildWorkspaceContext but
  // DELIBERATELY drops the heavy/sensitive parts (activeModel,
  // projectSnapshot) — we only keep diagram-type counts, the project name,
  // and the active diagram type. The BYOK API key lives in the
  // smart-generation Redux state / localStorage and is never touched here.
  const buildIssueReportContext = (): IssueReportContext => {
    const project = currentProjectRef.current;
    const activeType = currentDiagramTypeRef.current || undefined;

    const diagramCounts: Record<string, number> = {};
    if (project) {
      for (const [type, arr] of Object.entries(project.diagrams)) {
        if (Array.isArray(arr) && arr.length > 0) diagramCounts[type] = arr.length;
      }
    }
    const diagramTypes = Object.keys(diagramCounts);
    const totalDiagrams = Object.values(diagramCounts).reduce((sum, n) => sum + n, 0);

    return {
      activeDiagramType: activeType,
      projectName: project?.name,
      diagramTypes: diagramTypes.length > 0 ? diagramTypes : undefined,
      totalDiagrams: project ? totalDiagrams : undefined,
      diagramCounts: diagramTypes.length > 0 ? diagramCounts : undefined,
    };
  };

  const reportIssue = async (): Promise<void> => {
    try {
      const report = buildIssueReport({
        messages,
        messageMeta,
        connectionStatus: connection.connectionStatus,
        context: buildIssueReportContext(),
        appVersion: typeof appVersion === 'string' ? appVersion : undefined,
      });

      const markdown = buildIssueReportMarkdown(report);

      // Must-have #1: download a readable Markdown transcript.
      downloadFile(markdown, issueReportFilename('md'), 'text/markdown');

      // Must-have #2: copy the transcript to the clipboard so the user can
      // paste it straight into a chat/ticket without opening the file.
      const copied = await copyToClipboard(markdown);

      toast.success(
        copied
          ? 'Issue report downloaded and copied to clipboard. Send it to the BESSER team.'
          : 'Issue report downloaded. Attach the file when you contact the BESSER team.',
      );
    } catch (error) {
      console.error('[useAssistantLogic] failed to build issue report', error);
      toast.error('Could not build the issue report. Please try again.');
    }
  };

  /* ================================================================ */
  /*  Reset conversation when the active project changes               */
  /* ================================================================ */

  // Each project gets its own fresh conversation. When the user creates
  // or switches to a different project, wipe the previous project's chat
  // so it doesn't bleed across projects. Gate on an actual id change via
  // a ref so this never fires on unrelated re-renders. We seed the ref on
  // first run (prevId === undefined) so the very first project does NOT
  // clear an already-empty conversation.
  const prevProjectIdRef = useRef<string | undefined>(currentProject?.id);
  useEffect(() => {
    const projectId = currentProject?.id;
    if (prevProjectIdRef.current === undefined) {
      prevProjectIdRef.current = projectId;
      return;
    }
    if (projectId !== prevProjectIdRef.current) {
      prevProjectIdRef.current = projectId;
      clearConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  /* ================================================================ */
  /*  Public API (unchanged)                                           */
  /* ================================================================ */

  return {
    messages,
    inputValue,
    setInputValue,
    isGenerating: streaming.isGenerating,
    connectionStatus: connection.connectionStatus,
    rateLimitStatus,
    messageMeta,
    progressMessage: streaming.progressMessage,
    progressSteps: streaming.progressSteps,
    lastSentMessage,
    streamingMessageId: streaming.streamingMessageId,
    messageListContainerRef: messageListContainerRef as React.RefObject<HTMLDivElement>,
    showScrollToBottom,
    scrollMessagesToBottom,
    handleSubmit,
    sendVoiceMessage,
    stopGenerating,
    clearConversation,
    reportIssue,
    handleUndo: injection.handleUndo,
    canUndo: injection.undoAvailable,
    assistantClient,
  };
}
