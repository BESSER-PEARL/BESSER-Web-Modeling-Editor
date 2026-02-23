/**
 * AssistantWidget — floating chat widget that reuses all the same services,
 * handlers, and injection logic as AssistantWorkspaceDrawer.
 *
 * Renders as a fixed FAB button in the bottom-right corner that toggles a
 * popup chat card.  Internally it shares AssistantClient, UMLModelingService,
 * handleInjection, handleAction, etc. so features like replaceExisting work
 * identically to the drawer.
 */

import React, { useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UMLDiagramType } from '@besser/wme';
import { CircleHelp, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { ChatForm } from '@/components/chatbot-kit/ui/chat';
import { MessageInput } from '@/components/chatbot-kit/ui/message-input';
import { MessageList } from '@/components/chatbot-kit/ui/message-list';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { AssistantClient, type AssistantActionPayload, type InjectionCommand } from '../../services/assistant';
import { UML_BOT_WS_URL } from '../../constant';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useProject } from '../../hooks/useProject';
import { switchDiagramTypeThunk, updateCurrentDiagramThunk } from '../../services/project/projectSlice';
import type { SupportedDiagramType } from '../../types/project';
import { ApollonEditorContext } from '../apollon-editor-component/apollon-editor-context';
import {
  UMLModelingService,
  ClassSpec,
  SystemSpec,
  ModelModification,
  ModelUpdate,
  BESSERModel,
} from './services/UMLModelingService';
import { isUMLModel, toUMLDiagramType } from '../../types/project';
import type { GeneratorType } from '../sidebar/workspace-types';
import type { GenerationResult } from '../../services/generate-code/types';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const AGENT_AVATAR_SRC = '/img/agent_back.png';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'closed' | 'closing' | 'unknown';

const UML_DIAGRAM_TYPES = new Set(['ClassDiagram', 'ObjectDiagram', 'StateMachineDiagram', 'AgentDiagram']);
const isUmlDiagramType = (t?: string): boolean => (t ? UML_DIAGRAM_TYPES.has(t) : false);

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface AssistantWidgetProps {
  onAssistantGenerate?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const createMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toKitMessage = (role: 'user' | 'assistant', content: string): ChatKitMessage => ({
  id: createMessageId(),
  role,
  content,
  createdAt: new Date(),
});

const toAssistantText = (message: unknown): string => {
  if (typeof message === 'string') return message;
  try {
    return JSON.stringify(message, null, 2);
  } catch {
    return String(message);
  }
};

const getConnectionDotClass = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500';
    case 'connecting':
    case 'closing':
      return 'bg-amber-500';
    default:
      return 'bg-red-500';
  }
};

const getConnectionLabel = (status: ConnectionStatus): string => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting…';
    case 'closing':
      return 'Closing…';
    case 'closed':
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Unknown';
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({ onAssistantGenerate }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<ChatKitMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const messageListContainerRef = useRef<HTMLDivElement>(null);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const dispatch = useAppDispatch();
  const { editor } = useContext(ApollonEditorContext);
  const currentDiagram = useAppSelector((state) => state.diagram);
  const { switchDiagramType, currentProject, currentDiagramType } = useProject();
  const location = useLocation();
  const navigate = useNavigate();

  const isOnEditorPage = ['/', '/graphical-ui-editor', '/quantum-editor'].includes(location.pathname);

  const modelingServiceRef = useRef<UMLModelingService | null>(null);
  const onAssistantGenerateRef = useRef(onAssistantGenerate);
  const currentProjectRef = useRef(currentProject);
  const currentDiagramTypeRef = useRef(currentDiagramType);
  const currentModelRef = useRef<any>(null);

  onAssistantGenerateRef.current = onAssistantGenerate;
  currentProjectRef.current = currentProject;
  currentDiagramTypeRef.current = currentDiagramType;
  currentModelRef.current = currentDiagram?.diagram?.model;

  /* ---- Workspace context provider (same as drawer) ---- */

  const buildWorkspaceContext = () => {
    const project = currentProjectRef.current;
    const activeType = currentDiagramTypeRef.current || 'ClassDiagram';
    const activeDiagram = project?.diagrams?.[activeType as keyof typeof project.diagrams];
    const projectModel = activeDiagram?.model;
    const editorModel = isUMLModel(currentModelRef.current) ? currentModelRef.current : undefined;
    const activeModel = isUmlDiagramType(activeType)
      ? modelingServiceRef.current?.getCurrentModel() || editorModel || projectModel
      : projectModel;

    const diagramSummaries = project
      ? Object.entries(project.diagrams).map(([diagramType, diagram]) => ({
          diagramType,
          diagramId: diagram.id,
          title: diagram.title,
        }))
      : [];

    return {
      activeDiagramType: activeType,
      activeDiagramId: activeDiagram?.id,
      activeModel,
      projectSnapshot: project || undefined,
      diagramSummaries,
    };
  };

  /* ---- Singleton services ---- */

  const [assistantClient] = useState(
    () =>
      new AssistantClient(UML_BOT_WS_URL, {
        clientMode: 'workspace',
        contextProvider: buildWorkspaceContext,
      }),
  );

  const [modelingService, setModelingService] = useState<UMLModelingService | null>(null);

  /* ---- Editor / model sync ---- */

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
    if (modelingService && currentDiagram?.diagram?.model && isUMLModel(currentDiagram.diagram.model)) {
      modelingService.updateCurrentModel(currentDiagram.diagram.model);
    }
  }, [currentDiagram, modelingService]);

  /* ---- Hide when not on an editor page ---- */

  useEffect(() => {
    if (!isOnEditorPage) {
      setIsVisible(false);
    }
  }, [isOnEditorPage]);

  /* ---- External toggle event ---- */

  useEffect(() => {
    const toggle = () => {
      if (!isOnEditorPage) return;
      setIsVisible((p) => !p);
    };
    window.addEventListener('besser:toggle-agent-widget', toggle);
    return () => window.removeEventListener('besser:toggle-agent-widget', toggle);
  }, [isOnEditorPage]);

  /* ---- Scroll to bottom on new messages ---- */

  useEffect(() => {
    if (messageListContainerRef.current) {
      messageListContainerRef.current.scrollTop = messageListContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  /* ---- Diagram switching helper ---- */

  const waitForSwitchRender = (): Promise<void> =>
    new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        setTimeout(resolve, 0);
        return;
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });

  /**
   * After a diagram switch the Apollon editor + UMLModelingService may still
   * be mounting.  Poll until the ref is populated (or time out).
   */
  const waitForModelingService = async (timeoutMs = 3000): Promise<boolean> => {
    if (modelingServiceRef.current && typeof modelingServiceRef.current.injectToEditor === 'function') {
      return true;
    }
    const start = Date.now();
    return new Promise<boolean>((resolve) => {
      const check = () => {
        if (modelingServiceRef.current && typeof modelingServiceRef.current.injectToEditor === 'function') {
          resolve(true);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          console.warn('[AssistantWidget] Timed out waiting for modelingServiceRef');
          resolve(false);
          return;
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  };

  const ensureTargetDiagramReady = async (targetType?: string): Promise<boolean> => {
    if (!targetType || targetType === currentDiagramTypeRef.current) return true;

    // Handle non-UML diagram types (GUINoCodeDiagram, QuantumCircuitDiagram)
    const isGuiDiagram = targetType === 'GUINoCodeDiagram';
    const isQuantumDiagram = targetType === 'QuantumCircuitDiagram';
    if (isGuiDiagram || isQuantumDiagram) {
      try {
        await dispatch(switchDiagramTypeThunk({ diagramType: targetType as SupportedDiagramType })).unwrap();
      } catch {
        return false;
      }
      if (isGuiDiagram && location.pathname !== '/graphical-ui-editor') {
        navigate('/graphical-ui-editor');
      }
      if (isQuantumDiagram && location.pathname !== '/quantum-editor') {
        navigate('/quantum-editor');
      }
      await waitForSwitchRender();
      return true;
    }

    const umlType = toUMLDiagramType(targetType as any);
    if (!umlType) return false;
    try {
      if (location.pathname !== '/') {
        navigate('/');
      }
      switchDiagramType(umlType as UMLDiagramType);
      await waitForSwitchRender();
      return true;
    } catch {
      return false;
    }
  };

  /* ---- Task queue (serialises async operations) ---- */

  const enqueueAssistantTask = (task: () => Promise<void> | void) => {
    operationQueueRef.current = operationQueueRef.current
      .then(async () => { await task(); })
      .catch((error) => console.error('Widget assistant task queue error:', error));
  };

  /* ================================================================ */
  /*  handleInjection — IDENTICAL to the drawer                       */
  /* ================================================================ */

  const handleInjection = async (command: InjectionCommand) => {
    try {
      const diagramReady = await ensureTargetDiagramReady(command.diagramType);
      if (!diagramReady) {
        throw new Error(`Could not switch to ${command.diagramType || 'the target diagram'}`);
      }

      const targetDiagramType = command.diagramType || currentDiagramTypeRef.current || 'ClassDiagram';
      const targetIsUml = isUmlDiagramType(targetDiagramType);
      let applied = false;

      // After a diagram switch the editor may still be mounting.
      // Wait for the modeling service to become available before proceeding.
      if (targetIsUml && !modelingServiceRef.current) {
        await waitForModelingService();
      }

      if (targetIsUml && modelingServiceRef.current) {
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
            const onDone = (event: Event) => {
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
          const result = await dispatch(updateCurrentDiagramThunk({ model: command.model as any }));
          if (updateCurrentDiagramThunk.rejected.match(result)) {
            throw new Error(result.error.message || 'Failed to persist assistant model update');
          }
          applied = true;
        }
      }

      if (!applied) {
        throw new Error('Assistant did not provide a valid update payload');
      }

      const infoMessage =
        typeof command.message === 'string' && command.message.trim()
          ? command.message
          : 'Applied assistant model update.';
      setMessages((prev) => [...prev, toKitMessage('assistant', infoMessage)]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Could not apply assistant update: ${errorMessage}`);
      setMessages((prev) => [
        ...prev,
        toKitMessage('assistant', `I wasn't able to apply that change \u2014 ${errorMessage}. Try rephrasing your request.`),
      ]);
    }
  };

  /* ================================================================ */
  /*  handleAction — IDENTICAL to the drawer                          */
  /* ================================================================ */

  const handleAction = async (payload: AssistantActionPayload) => {
    if (
      payload.action === 'assistant_message' ||
      payload.action === 'inject_element' ||
      payload.action === 'inject_complete_system' ||
      payload.action === 'modify_model'
    ) {
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
      const handler = onAssistantGenerateRef.current;
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

    /* ---- Export project (JSON / BUML) ---- */
    if (payload.action === 'trigger_export') {
      const format = typeof payload.format === 'string' ? payload.format : 'json';
      const msg = typeof payload.message === 'string' && payload.message.trim() ? payload.message : `Exporting project as ${format.toUpperCase()}…`;
      setMessages((prev) => [...prev, toKitMessage('assistant', msg)]);
      window.dispatchEvent(new CustomEvent('wme:assistant-export-project', { detail: { format } }));
      return;
    }

    /* ---- Deploy to Render ---- */
    if (payload.action === 'trigger_deploy') {
      const msg = typeof payload.message === 'string' && payload.message.trim() ? payload.message : 'Starting deployment…';
      setMessages((prev) => [...prev, toKitMessage('assistant', msg)]);
      window.dispatchEvent(new CustomEvent('wme:assistant-deploy-app', {
        detail: {
          platform: payload.platform ?? 'render',
          config: payload.config ?? {},
        },
      }));
      return;
    }

    if (payload.action === 'agent_error') {
      const message = typeof payload.message === 'string' ? payload.message : 'Something went wrong on the assistant side.';
      setMessages((prev) => [...prev, toKitMessage('assistant', message)]);
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
        const onReady = () => {
          window.removeEventListener('wme:gui-editor-ready', onReady);
          resolve(true);
        };
        window.addEventListener('wme:gui-editor-ready', onReady);
        setTimeout(() => {
          window.removeEventListener('wme:gui-editor-ready', onReady);
          resolve((window as any).__WME_GUI_EDITOR_READY__ === true);
        }, 8000);
      });
      if (!editorReady) {
        setMessages((prev) => [...prev, toKitMessage('assistant', 'The GUI editor did not become ready in time. Please try again.')]);
        return;
      }
      setMessages((prev) => [...prev, toKitMessage('assistant', 'Generating GUI from your Class Diagram\u2026')]);
      const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const onDone = (event: Event) => {
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
          toKitMessage('assistant', `Could not generate the GUI: ${result.error || 'unknown error'}.`),
        ]);
      }
      return;
    }
  };

  /* ---- WebSocket lifecycle (connect/disconnect when widget opens/closes) ---- */

  useEffect(() => {
    if (!isVisible) {
      assistantClient.clearHandlers();
      assistantClient.disconnect({ allowReconnect: false, clearQueue: true });
      setIsGenerating(false);
      setConnectionStatus('disconnected');
      return;
    }

    assistantClient.onMessage((message) => {
      setMessages((prev) => [...prev, toKitMessage('assistant', toAssistantText(message.message))]);
    });
    assistantClient.onConnection((connected) => {
      const next = connected ? 'connected' : (assistantClient.connectionState as ConnectionStatus);
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

    setConnectionStatus((prev) => {
      const next = (assistantClient.connectionState as ConnectionStatus) || 'connecting';
      return prev === next ? prev : next;
    });
    assistantClient.connect().catch(() => {
      setConnectionStatus('disconnected');
      toast.error('Could not reach the AI assistant \u2014 make sure the backend is running.');
    });

    return () => {
      assistantClient.clearHandlers();
    };
  }, [assistantClient, isVisible]);

  /* ---- File reading helper ---- */

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

  /* ---- Send message ---- */

  const handleSubmit = async (
    event?: { preventDefault?: () => void },
    options?: { experimental_attachments?: FileList },
  ) => {
    event?.preventDefault?.();
    const normalizedInput = inputValue.trim();
    const attachedFiles = options?.experimental_attachments;
    const hasFiles = attachedFiles && attachedFiles.length > 0;

    if ((!normalizedInput && !hasFiles) || isGenerating) return;

    const displayText = hasFiles
      ? `${normalizedInput || 'Convert this file'} 📎 ${Array.from(attachedFiles!).map((f) => f.name).join(', ')}`
      : normalizedInput;

    setMessages((prev) => [...prev, toKitMessage('user', displayText)]);
    setInputValue('');

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

    const message = normalizedInput || (hasFiles ? 'Convert this file to a diagram' : '');
    const context = buildWorkspaceContext();
    const modelSnapshot = modelingServiceRef.current?.getCurrentModel() || context.activeModel;
    const sendResult = assistantClient.sendMessage(message, context.activeDiagramType, modelSnapshot, context, attachments);
    if (sendResult === 'queued') {
      toast.info('Reconnecting to the assistant \u2014 your message will be sent automatically.');
      setConnectionStatus('connecting');
      assistantClient.connect().catch(() => setConnectionStatus('disconnected'));
    } else if (sendResult === 'error') {
      toast.error('Could not send your message \u2014 please try again.');
    }
  };

  /* ---- Render ---- */

  if (!isOnEditorPage) return null;

  return (
    <>
      {/* ── Floating widget container ── */}
      <div className="fixed bottom-5 right-4 z-[1000] md:right-16">
        {/* ── Chat card ── */}
        <Card
          className={cn(
            'absolute bottom-[74px] right-0 flex h-[min(78vh,700px)] w-[min(96vw,520px)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl transition-all duration-300 sm:w-[480px] lg:w-[520px]',
            isVisible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-4 scale-95 opacity-0',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-slate-900 px-4 py-3 text-white dark:bg-slate-100 dark:text-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/10">
                <img src={AGENT_AVATAR_SRC} alt="Agent" className="h-6 w-6 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">BESSER Modeling Assistant</p>
                <p className="mt-1 text-xs opacity-80">AI modeling support</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white dark:text-slate-900 dark:hover:bg-slate-300"
                onClick={() => setShowDisclaimer(true)}
                title="Privacy and data processing"
              >
                <CircleHelp className="h-4 w-4" />
              </Button>
              <span className={cn('h-2.5 w-2.5 rounded-full', getConnectionDotClass(connectionStatus))} />
            </div>
          </div>

          {/* Message list */}
          <div ref={messageListContainerRef} className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-900/40">
            <MessageList messages={messages} isTyping={isGenerating} showTimeStamps={false} />
          </div>

          {/* Status bar */}
          <Separator />
          <div className="flex items-center justify-between bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', getConnectionDotClass(connectionStatus))} />
              <span>{getConnectionLabel(connectionStatus)}</span>
            </div>
            <span>{messages.length} message{messages.length === 1 ? '' : 's'}</span>
          </div>

          {/* Input */}
          <Separator />
          <div className="bg-background p-3">
            <ChatForm className="w-full" isPending={isGenerating} handleSubmit={handleSubmit}>
              {({ files, setFiles }) => (
                <MessageInput
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Describe what you want to create or modify…"
                  allowAttachments
                  files={files}
                  setFiles={setFiles}
                  isGenerating={isGenerating}
                  stop={() => setIsGenerating(false)}
                />
              )}
            </ChatForm>
          </div>
        </Card>

        {/* ── FAB toggle button ── */}
        <Button
          type="button"
          size="icon"
          className="h-14 w-14 rounded-full border border-slate-300 bg-white text-slate-900 shadow-lg transition-transform hover:scale-105 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          onClick={() => setIsVisible((p) => !p)}
          title={isVisible ? 'Close assistant' : 'Open assistant'}
        >
          {isVisible ? (
            <X className="h-5 w-5" />
          ) : (
            <img src={AGENT_AVATAR_SRC} alt="Agent" className="h-10 w-10 rounded-full" />
          )}
        </Button>
      </div>

      {/* ── Disclaimer dialog ── */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleHelp className="h-5 w-5" />
              Privacy and Data Processing
            </DialogTitle>
            <DialogDescription>
              Important information about how the assistant processes modeling data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p><strong className="text-foreground">Data processing notice:</strong></p>
            <p>When you use the Modeling Assistant, your messages and diagram data are processed to provide AI-powered modeling support.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your diagram models and messages are sent to the AI service for processing.</li>
              <li>Data is transmitted over encrypted connections.</li>
              <li>Requests are processed to generate UML updates and modeling suggestions.</li>
              <li>Conversation history is stored locally in your current browser session.</li>
            </ul>
            <p><strong className="text-foreground">Privacy:</strong> Avoid sharing sensitive or confidential information in assistant messages.</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setShowDisclaimer(false)}>I Understand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
