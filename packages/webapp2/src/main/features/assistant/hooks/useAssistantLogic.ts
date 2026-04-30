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

import { useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { getPostHog } from '../../../shared/services/analytics/lazy-analytics';
import { AssistantClient, type AssistantActionPayload } from '../services';
import { UML_BOT_WS_URL } from '../../../shared/constants/constant';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { useProject } from '../../../app/hooks/useProject';
import { updateDiagramModelThunk, selectActiveDiagram, addDiagramThunk, switchDiagramIndexThunk, bumpEditorRevision } from '../../../app/store/workspaceSlice';
import { ApollonEditorContext } from '../../editors/uml/apollon-editor-context';
import {
  UMLModelingService,
  RateLimiterService,
  type RateLimitStatus,
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
  const [messages, setMessages] = useState<ChatKitMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({
    requestsLastMinute: 0,
    requestsLastHour: 0,
    cooldownRemaining: 0,
  });
  const [messageMeta, setMessageMeta] = useState<Record<string, MessageMeta>>({});
  const [lastSentMessage, setLastSentMessage] = useState('');

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

  /* ---- auto-scroll on new messages ---- */

  useEffect(() => {
    if (messageListContainerRef.current) {
      messageListContainerRef.current.scrollTop = messageListContainerRef.current.scrollHeight;
    }
  }, [messages]);

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
  const smartGen = useSmartGenTrigger({
    currentProjectRef,
    setMessages,
    setIsGenerating: streaming.setIsGenerating,
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
          payload.provider === 'anthropic' || payload.provider === 'openai'
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

      const errMsg = toKitMessage('assistant', errorMsg, { isError: true });
      setMessages((prev) => [...prev, errMsg]);

      const meta: MessageMeta = { badge: 'error', badgeLabel: errorCode ? `Error: ${errorCode}` : 'Error' };
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
    assistantClient.onMessage((message) => {
      // Clear generating state on any real message -- the backend always sends
      // a final message (success or error), so receiving ANY message means
      // generation is done.  This also handles the 45s response-timeout
      // synthetic message from AssistantClient.
      streaming.setIsGenerating(false);
      streaming.setProgressMessage('');

      const responseTiming = stopTimer('response');
      const totalTiming = stopTimer('total');

      const role = message.isUser ? 'user' : 'assistant';
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
    });

    streaming.registerTypingHandler(assistantClient);

    assistantClient.onInjection((command) => {
      enqueueAssistantTask(() => injection.handleInjection(command));
    });
    assistantClient.onAction((payload) => {
      enqueueAssistantTask(() => handleAction(payload));
    });

    // NOTE: connection lifecycle (connect/disconnect/onConnection) is handled
    // by useWebSocketConnection. We only register message/typing/injection/action
    // handlers here since they depend on orchestrator state.
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

      const context = buildWorkspaceContext();
      const modelSnapshot = modelingServiceRef.current?.getCurrentModel() || context.activeModel;
      const mimeType = audioBlob.type || 'audio/wav';
      const sendResult = assistantClient.sendVoiceMessage(
        audioBase64,
        mimeType,
        context.activeDiagramType,
        context,
      );

      setRateLimitStatus(rateLimiter.getRateLimitStatus());

      if (sendResult === 'queued') {
        toast.info('Reconnecting to the assistant \u2014 your voice message will be sent automatically.');
        connection.setConnectionStatus('connecting');
        assistantClient.connect().catch(() => connection.setConnectionStatus('disconnected'));
      } else if (sendResult === 'error') {
        toast.error('Could not send your voice message \u2014 please try again.');
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
      toast.error('Could not process your voice message. Please try again.');
    } finally {
      isSendingRef.current = false;
    }
  };

  const stopGenerating = () => {
    // Also abort any in-flight Smart Generator run so the SSE stream
    // disconnects and the user stops paying for LLM tokens.
    smartGen.abortActive();
    streaming.setIsGenerating(false);
  };

  const clearConversation = () => {
    // Abort any in-flight Smart Generator run first — otherwise the
    // stream keeps firing events into a cleared message list, where
    // the message-lookup-by-id silently no-ops and the user's BYOK
    // budget keeps draining.
    smartGen.abortActive();
    setMessages([]);
    streaming.setIsGenerating(false);
    setInputValue('');
    setMessageMeta({});
    streaming.setProgressMessage('');
    streaming.setStreamingMessageId(null);
  };

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
    lastSentMessage,
    streamingMessageId: streaming.streamingMessageId,
    messageListContainerRef: messageListContainerRef as React.RefObject<HTMLDivElement>,
    handleSubmit,
    sendVoiceMessage,
    stopGenerating,
    clearConversation,
    handleUndo: injection.handleUndo,
    canUndo: injection.undoAvailable,
    assistantClient,
  };
}
