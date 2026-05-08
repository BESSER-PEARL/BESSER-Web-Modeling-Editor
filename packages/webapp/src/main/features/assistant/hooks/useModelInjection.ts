/**
 * useModelInjection -- Model injection handling, undo/redo, and diagram switching.
 *
 * Owns:
 *  - `handleInjection()` -- processes InjectionCommand payloads
 *  - `ensureTargetDiagramReady()` -- switches to the correct diagram before injection
 *  - `refreshUndoState()` -- keeps the undo-available flag in sync
 *  - `handleUndo()` -- restores the previous model snapshot
 *  - `undoAvailable` state
 */

import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { AppDispatch } from '../../../app/store/store';
import type { InjectionCommand, UMLModelingService, ClassSpec, ModelModification } from '../services';
import {
  updateDiagramModelThunk,
  switchDiagramIndexThunk,
  addDiagramThunk,
  bumpEditorRevision,
} from '../../../app/store/workspaceSlice';
import { popUndo, canUndo, pushUndoSnapshot } from '../services/undoStack';
import type { ProjectDiagram, SupportedDiagramType } from '../../../shared/types/project';
import type { MessageMeta, SuggestedAction } from './useAssistantLogic';
import { stopTimer, startTimer } from './useStreamingResponse';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const UML_DIAGRAM_TYPES = new Set([
  'ClassDiagram',
  'ObjectDiagram',
  'StateMachineDiagram',
  'AgentDiagram',
]);
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
  extras?: Partial<
    Pick<
      ChatKitMessage,
      'isProgress' | 'progressStep' | 'progressTotal' | 'isError' | 'isStreaming' | 'injectionType'
    >
  >,
): ChatKitMessage => ({
  id: createMessageId(),
  role,
  content,
  createdAt: new Date(),
  ...extras,
});

const sanitizeForDisplay = (text: string): string =>
  text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

const waitForSwitchRender = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface UseModelInjectionOptions {
  dispatch: AppDispatch;
  editor: any;
  modelingServiceRef: React.MutableRefObject<UMLModelingService | null>;
  currentModelRef: React.MutableRefObject<any>;
  currentProjectRef: React.MutableRefObject<any>;
  currentDiagramTypeRef: React.MutableRefObject<string | undefined>;
  switchDiagramRef: React.MutableRefObject<(targetType: string) => Promise<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatKitMessage[]>>;
  setMessageMeta: React.Dispatch<React.SetStateAction<Record<string, MessageMeta>>>;
  setProgressMessage: React.Dispatch<React.SetStateAction<string>>;
}

export interface UseModelInjectionReturn {
  handleInjection: (command: InjectionCommand) => Promise<void>;
  ensureTargetDiagramReady: (targetType?: string, targetDiagramId?: string) => Promise<boolean>;
  handleUndo: () => void;
  undoAvailable: boolean;
  refreshUndoState: () => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useModelInjection({
  dispatch,
  editor,
  modelingServiceRef,
  currentModelRef,
  currentProjectRef,
  currentDiagramTypeRef,
  switchDiagramRef,
  setMessages,
  setMessageMeta,
  setProgressMessage,
}: UseModelInjectionOptions): UseModelInjectionReturn {
  const [undoAvailable, setUndoAvailable] = useState(false);

  /* ---- undo state sync ---- */

  const refreshUndoState = () => {
    setUndoAvailable(canUndo());
  };

  /* ---- diagram switching helpers ---- */

  const findDiagramIndexById = (diagramType: string, diagramId: string): number => {
    const project = currentProjectRef.current;
    if (!project) return -1;
    const diagrams = (project.diagrams as Record<string, ProjectDiagram[]>)[diagramType];
    if (!Array.isArray(diagrams)) return -1;
    return diagrams.findIndex((d: ProjectDiagram) => d.id === diagramId);
  };

  const ensureTargetDiagramReady = async (
    targetType?: string,
    targetDiagramId?: string,
  ): Promise<boolean> => {
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
        const project = currentProjectRef.current;
        const currentIndex =
          project?.currentDiagramIndices?.[targetType as SupportedDiagramType] ?? 0;
        if (tabIndex !== currentIndex) {
          try {
            await dispatch(
              switchDiagramIndexThunk({
                diagramType: targetType as SupportedDiagramType,
                index: tabIndex,
              }),
            ).unwrap();
            await waitForSwitchRender();
          } catch (error) {
            console.warn('[useModelInjection] Could not switch to diagram tab:', error);
          }
        }
      }
    }

    return true;
  };

  /* ---- meta helpers ---- */

  const attachMetaFromPayload = (
    messageId: string,
    payload: Record<string, unknown>,
    badge?: MessageMeta['badge'],
    badgeLabel?: string,
  ) => {
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
  /*  handleInjection                                                  */
  /* ================================================================ */

  const handleInjection = async (command: InjectionCommand) => {
    try {
      startTimer('injection', 'Model injection');
      const targetDiagramType =
        command.diagramType || currentDiagramTypeRef.current || 'ClassDiagram';

      const targetIsUml = isUmlDiagramType(targetDiagramType);
      let applied = false;

      // New tab: create it, convert systemSpec -> model, write to Redux directly.
      if ((command as any).createNewTab) {
        try {
          const tabResult = await dispatch(
            addDiagramThunk({
              diagramType: targetDiagramType as SupportedDiagramType,
            }),
          ).unwrap();
          if (tabResult?.index !== undefined) {
            await dispatch(
              switchDiagramIndexThunk({
                diagramType: targetDiagramType as SupportedDiagramType,
                index: tabResult.index,
              }),
            ).unwrap();
          }
          if (command.systemSpec && typeof command.systemSpec === 'object') {
            const { ConverterFactory } = await import('../services/converters');
            const converter = ConverterFactory.getConverter(targetDiagramType as any);
            const convertedModel = converter.convertCompleteSystem(command.systemSpec);
            await dispatch(updateDiagramModelThunk({ model: convertedModel }));
          } else if (command.model) {
            await dispatch(updateDiagramModelThunk({ model: command.model as any }));
          }
          dispatch(bumpEditorRevision());
          applied = true;
        } catch (tabError) {
          console.error('[useModelInjection] New tab creation/injection failed:', tabError);
          throw tabError;
        }
      }

      if (!applied) {
        const diagramReady = await ensureTargetDiagramReady(
          command.diagramType,
          command.diagramId,
        );
        if (!diagramReady) {
          throw new Error(
            `Could not switch to ${command.diagramType || 'the target diagram'}`,
          );
        }
      }

      // Direct converter/modifier + Redux path (no editor dependency!)
      if (!applied && targetIsUml) {
        const currentModel = currentModelRef.current;
        if (currentModel) {
          pushUndoSnapshot(currentModel, `Before ${command.action}`);
        }

        let newModel: any = null;

        switch (command.action) {
          case 'inject_complete_system':
            if (
              command.systemSpec &&
              typeof command.systemSpec === 'object' &&
              Array.isArray(
                command.systemSpec.classes ??
                  command.systemSpec.states ??
                  command.systemSpec.objects ??
                  command.systemSpec.intents,
              )
            ) {
              const { ConverterFactory } = await import('../services/converters');
              const converter = ConverterFactory.getConverter(targetDiagramType as any);
              newModel = converter.convertCompleteSystem(command.systemSpec);
            } else if (
              command.systemSpec &&
              typeof command.systemSpec === 'object' &&
              Object.keys(command.systemSpec).length > 0
            ) {
              const { ConverterFactory } = await import('../services/converters');
              const converter = ConverterFactory.getConverter(targetDiagramType as any);
              newModel = converter.convertCompleteSystem(command.systemSpec);
            } else if (command.systemSpec) {
              throw new Error(
                'inject_complete_system payload is missing a valid classes/states/objects/intents array',
              );
            }
            break;

          case 'inject_element':
            if (
              command.element &&
              typeof command.element === 'object' &&
              (command.element.className ||
                command.element.stateName ||
                command.element.objectName ||
                command.element.type)
            ) {
              if (modelingServiceRef.current) {
                const update = modelingServiceRef.current.processSimpleClassSpec(
                  command.element as ClassSpec,
                  targetDiagramType,
                );
                if (update) {
                  await modelingServiceRef.current.injectToEditor(update);
                  applied = true;
                }
              } else {
                const { ConverterFactory } = await import('../services/converters');
                const converter = ConverterFactory.getConverter(targetDiagramType as any);
                newModel = converter.convertSingleElement(command.element);
              }
            } else if (command.element) {
              throw new Error(
                'inject_element payload is missing a recognizable element specification',
              );
            }
            break;

          case 'modify_model':
            if (Array.isArray(command.modifications) && command.modifications.length > 0) {
              const { ModifierFactory } = await import('../services/modifiers/factory');
              const modifier = ModifierFactory.getModifier(targetDiagramType as any);
              let modifiedModel = currentModel
                ? JSON.parse(JSON.stringify(currentModel))
                : {};
              const appliedActions: string[] = [];
              for (const mod of command.modifications) {
                if (!mod || !mod.action) {
                  throw new Error('modify_model contains a modification with no action');
                }
                if (!modifier.canHandle(mod.action)) {
                  throw new Error(
                    `Unsupported modification action '${mod.action}' for ${targetDiagramType}`,
                  );
                }
                modifiedModel = modifier.applyModification(
                  modifiedModel,
                  mod as ModelModification,
                );
                appliedActions.push(mod.action);
              }
              if (appliedActions.length === 0) {
                throw new Error('modify_model did not apply any modifications');
              }
              newModel = modifiedModel;
            } else if (
              command.modification &&
              typeof command.modification === 'object' &&
              command.modification.action &&
              command.modification.target
            ) {
              const { ModifierFactory } = await import('../services/modifiers/factory');
              const modifier = ModifierFactory.getModifier(targetDiagramType as any);
              if (!modifier.canHandle(command.modification.action)) {
                throw new Error(
                  `Unsupported modification action '${command.modification.action}' for ${targetDiagramType}`,
                );
              }
              const modifiedModel = currentModel
                ? JSON.parse(JSON.stringify(currentModel))
                : {};
              newModel = modifier.applyModification(
                modifiedModel,
                command.modification as ModelModification,
              );
            } else if (command.modification) {
              throw new Error(
                'modify_model payload is missing required action or target fields',
              );
            } else {
              throw new Error(
                'modify_model payload is missing modifications or modification field',
              );
            }
            break;

          default:
            break;
        }

        if (newModel && !applied) {
          // Prefer the modeling service so the live editor stays in sync without
          // being destroyed and re-created. The editor-reinit path
          // (bumpEditorRevision) is only used as a fallback when the service
          // isn't available yet.
          if (command.action === 'modify_model' && modelingServiceRef.current) {
            await modelingServiceRef.current.injectToEditor({
              type: 'modification',
              data: newModel,
              message:
                typeof command.message === 'string' && command.message.trim()
                  ? command.message
                  : 'Applied model modification',
            });
          } else {
            await dispatch(updateDiagramModelThunk({ model: newModel }));
            dispatch(bumpEditorRevision());
          }
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
            window.dispatchEvent(
              new CustomEvent('wme:assistant-load-gui-model', {
                detail: { model: command.model },
              }),
            );
          });
          if (!loadResult.ok) {
            throw new Error(loadResult.error || 'Failed to load GUI model into editor');
          }
          applied = true;
        } else {
          const result = await dispatch(
            updateDiagramModelThunk({ model: command.model as any }),
          );
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
      const injMsg = toKitMessage('assistant', infoMessage, {
        injectionType: command.action,
      });
      setMessages((prev) => [...prev, injMsg]);
      const diagramLabel =
        command.diagramType || currentDiagramTypeRef.current || 'Diagram';
      attachMetaFromPayload(
        injMsg.id,
        command as unknown as Record<string, unknown>,
        'injection',
        `Applied to ${diagramLabel}`,
      );

      // Show timing summary after injection
      if (injectionTiming || totalTiming) {
        const timingText = [injectionTiming, totalTiming].filter(Boolean).join(' \u00b7 ');
        setMessages((prev) => [
          ...prev,
          toKitMessage('assistant', timingText, { isProgress: true }),
        ]);
      }
    } catch (error) {
      setProgressMessage('');
      const errorMessage = sanitizeForDisplay(
        error instanceof Error ? error.message : 'Unknown error',
      );
      toast.error(`Could not apply assistant update: ${errorMessage}`);
      const errMsg = toKitMessage(
        'assistant',
        `I wasn't able to apply that change \u2014 ${errorMessage}. Try rephrasing your request.`,
        { isError: true },
      );
      setMessages((prev) => [...prev, errMsg]);
      attachMetaFromPayload(errMsg.id, {}, 'error', 'Update failed');
    }
  };

  /* ---- undo ---- */

  const handleUndo = useCallback(() => {
    const snapshot = popUndo();
    if (!snapshot) return;

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
      console.error('[useModelInjection] Undo failed:', error);
    }

    refreshUndoState();
  }, [editor, dispatch, setMessages]);

  return {
    handleInjection,
    ensureTargetDiagramReady,
    handleUndo,
    undoAvailable,
    refreshUndoState,
  };
}
