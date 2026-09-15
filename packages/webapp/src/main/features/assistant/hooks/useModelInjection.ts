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
import { requestAutoLayoutOnNextSetup } from '../../../shared/utils/autoLayoutSignal';
import { markTextEditable } from '../../../shared/utils/markTextEditable';
import type { ProjectDiagram, SupportedDiagramType } from '../../../shared/types/project';
import type { MessageMeta, SuggestedAction } from './useAssistantLogic';
import { stopTimer, startTimer } from './useStreamingResponse';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type ModelBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

function getModelBounds(model: any): ModelBounds | null {
  const elements = Object.values((model?.elements || {}) as Record<string, any>);
  if (!elements.length) return null;

  const xs = elements.flatMap((e: any) => [e.bounds?.x ?? 0, (e.bounds?.x ?? 0) + (e.bounds?.width ?? 0)]);
  const ys = elements.flatMap((e: any) => [e.bounds?.y ?? 0, (e.bounds?.y ?? 0) + (e.bounds?.height ?? 0)]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Scroll the editor canvas so the content bounding-box centre is visible.
 * The editor's inner SVG places model coordinate (0,0) at exactly
 * (scrollWidth/2, scrollHeight/2) of the StyledEditor scroll container
 * (tagged data-editor-scroll="1").  For content centred near the origin
 * (all AI-generated models after the §1.1 centering fix) this keeps the
 * diagram in view without a manual pan.
 */
function centerEditorViewport(model: any, delayMs = 200): void {
  setTimeout(() => {
    const sc = document.querySelector('[data-editor-scroll="1"]') as HTMLElement | null;
    if (!sc) return;
    const bounds = getModelBounds(model);
    const cx = bounds?.centerX ?? 0;
    const cy = bounds?.centerY ?? 0;
    sc.scrollLeft = Math.max(0, (sc.scrollWidth - sc.clientWidth) / 2 + cx);
    sc.scrollTop = Math.max(0, (sc.scrollHeight - sc.clientHeight) / 2 + cy);
  }, delayMs);
}

const UML_DIAGRAM_TYPES = new Set([
  'ClassDiagram',
  'ObjectDiagram',
  'StateMachineDiagram',
  'AgentDiagram',
  'UserDiagram',
  'BPMN',
]);
const isUmlDiagramType = (t?: string): boolean => (t ? UML_DIAGRAM_TYPES.has(t) : false);

function shouldCenterViewportAfterInjection(command: InjectionCommand, previousModel: any, nextModel: any): boolean {
  if (command.action === 'inject_complete_system') {
    return true;
  }

  const previousBounds = getModelBounds(previousModel);
  const nextBounds = getModelBounds(nextModel);

  if (!previousBounds && nextBounds) {
    return true;
  }

  if (!previousBounds || !nextBounds) {
    return false;
  }

  const centerShiftX = Math.abs(nextBounds.centerX - previousBounds.centerX);
  const centerShiftY = Math.abs(nextBounds.centerY - previousBounds.centerY);
  const widthGrowth = nextBounds.width - previousBounds.width;
  const heightGrowth = nextBounds.height - previousBounds.height;

  // Re-center when the assistant change effectively reframes the whole diagram,
  // not when it is just a small local tweak.
  return centerShiftX > 240 || centerShiftY > 180 || widthGrowth > 320 || heightGrowth > 240;
}

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
    Pick<ChatKitMessage, 'isProgress' | 'progressStep' | 'progressTotal' | 'isError' | 'isStreaming' | 'injectionType'>
  >,
): ChatKitMessage => ({
  id: createMessageId(),
  role,
  content,
  createdAt: new Date(),
  ...extras,
});

const sanitizeForDisplay = (text: string): string => text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
  /** Called after an assistant model update was successfully applied, with
   *  the model as it now stands. Used by the orchestrator's post-injection
   *  validate-and-repair loop. Must never throw into the injection path. */
  onModelApplied?: (info: { action: string; diagramType: string; model: any }) => void;
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
  onModelApplied,
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
        const project = currentProjectRef.current;
        const currentIndex = project?.currentDiagramIndices?.[targetType as SupportedDiagramType] ?? 0;
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
      const targetDiagramType = command.diagramType || currentDiagramTypeRef.current || 'ClassDiagram';

      const targetIsUml = isUmlDiagramType(targetDiagramType);
      let applied = false;
      let appliedModel: any = null;

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
            // This tab bypasses the GUI editor's load path, so mark agent text
            // editable here too (no-op for UML models). See markTextEditable.
            if (targetDiagramType === 'GUINoCodeDiagram') markTextEditable(convertedModel);
            await dispatch(updateDiagramModelThunk({ model: convertedModel }));
            appliedModel = convertedModel;
          } else if (command.model) {
            if (targetDiagramType === 'GUINoCodeDiagram') markTextEditable(command.model as any);
            await dispatch(updateDiagramModelThunk({ model: command.model as any }));
            appliedModel = command.model;
          }
          // Freshly generated class diagram in a new tab -> let ELK arrange it
          // once the new editor instance has the model.
          if (targetDiagramType === 'ClassDiagram' && (command.systemSpec || command.model)) {
            requestAutoLayoutOnNextSetup();
          }
          dispatch(bumpEditorRevision());
          applied = true;
        } catch (tabError) {
          console.error('[useModelInjection] New tab creation/injection failed:', tabError);
          throw tabError;
        }
      }

      if (!applied) {
        const diagramReady = await ensureTargetDiagramReady(command.diagramType, command.diagramId);
        if (!diagramReady) {
          throw new Error(`Could not switch to ${command.diagramType || 'the target diagram'}`);
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
                  command.systemSpec.profiles ??
                  command.systemSpec.intents ??
                  command.systemSpec.nodes,
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
                'inject_complete_system payload is missing a valid classes/states/objects/intents/nodes array',
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
              throw new Error('inject_element payload is missing a recognizable element specification');
            }
            break;

          case 'modify_model':
            // elementFound: false = agent refusal (no matching element).
            // Surface the message as a text reply without touching the model.
            if (
              Array.isArray(command.modifications) &&
              command.modifications.length === 0 &&
              (command as any).elementFound === false
            ) {
              applied = true;
              break;
            }
            if (Array.isArray(command.modifications) && command.modifications.length > 0) {
              const { ModifierFactory } = await import('../services/modifiers/factory');
              const modifier = ModifierFactory.getModifier(targetDiagramType as any);
              let modifiedModel = currentModel ? JSON.parse(JSON.stringify(currentModel)) : {};
              const appliedActions: string[] = [];
              const failedActions: string[] = [];
              // Apply each modification independently: a single bad sub-op
              // (e.g. an unsupported action or a failed transition) must NOT
              // discard the valid ones in the same batch. Commit what applies,
              // skip + log what doesn't, and only fail if nothing applied.
              for (const mod of command.modifications) {
                if (!mod || !mod.action) {
                  failedActions.push('(missing action)');
                  continue;
                }
                if (!modifier.canHandle(mod.action)) {
                  failedActions.push(mod.action);
                  console.warn(`[modify_model] unsupported action '${mod.action}' for ${targetDiagramType} — skipping`);
                  continue;
                }
                try {
                  modifiedModel = modifier.applyModification(modifiedModel, mod as ModelModification);
                  appliedActions.push(mod.action);
                } catch (modErr) {
                  failedActions.push(mod.action);
                  console.warn(`[modify_model] action '${mod.action}' failed — skipping:`, modErr);
                }
              }
              if (appliedActions.length === 0) {
                throw new Error(
                  failedActions.length
                    ? `Could not apply any of the requested changes (${failedActions.join(', ')}).`
                    : 'modify_model did not apply any modifications',
                );
              }
              if (failedActions.length > 0) {
                console.warn(
                  `[modify_model] applied ${appliedActions.length}, skipped ${failedActions.length}: ${failedActions.join(', ')}`,
                );
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
              const modifiedModel = currentModel ? JSON.parse(JSON.stringify(currentModel)) : {};
              newModel = modifier.applyModification(modifiedModel, command.modification as ModelModification);
            } else if (command.modification) {
              throw new Error('modify_model payload is missing required action or target fields');
            } else {
              throw new Error('modify_model payload is missing modifications or modification field');
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
            // A freshly generated complete class diagram should be ELK-arranged
            // on the recreated editor. Incremental edits keep their positions.
            if (command.action === 'inject_complete_system' && targetDiagramType === 'ClassDiagram') {
              requestAutoLayoutOnNextSetup();
            }
            dispatch(bumpEditorRevision());
          }
          applied = true;
          appliedModel = newModel;
          if (shouldCenterViewportAfterInjection(command, currentModel, newModel)) {
            centerEditorViewport(newModel);
          }
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
          // Editor-not-ready fallback: persist straight to storage. This also
          // bypasses the GUI editor's load path, so mark agent text editable
          // before persisting so the reloaded GUI is double-click editable.
          if (targetDiagramIsGui) markTextEditable(command.model as any);
          const result = await dispatch(updateDiagramModelThunk({ model: command.model as any }));
          if (updateDiagramModelThunk.rejected.match(result)) {
            throw new Error(result.error.message || 'Failed to persist assistant model update');
          }
          applied = true;
          appliedModel = command.model;
        }
      }

      if (!applied) {
        throw new Error('Assistant did not provide a valid update payload');
      }

      // Refresh undo state after successful injection
      refreshUndoState();
      setProgressMessage('');

      // Post-injection quality check: hand the applied model to the
      // orchestrator so it can run the backend validator and, when needed,
      // ask the agent to repair its own output (validate-and-repair loop).
      if (onModelApplied && appliedModel) {
        try {
          onModelApplied({ action: command.action, diagramType: targetDiagramType, model: appliedModel });
        } catch (hookError) {
          console.warn('[useModelInjection] onModelApplied hook failed:', hookError);
        }
      }

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
      const diagramLabel = command.diagramType || currentDiagramTypeRef.current || 'Diagram';
      attachMetaFromPayload(
        injMsg.id,
        command as unknown as Record<string, unknown>,
        'injection',
        `Applied to ${diagramLabel}`,
      );

      // Show timing summary after injection
      if (injectionTiming || totalTiming) {
        const timingText = [injectionTiming, totalTiming].filter(Boolean).join(' \u00b7 ');
        setMessages((prev) => [...prev, toKitMessage('assistant', timingText, { isProgress: true })]);
      }
    } catch (error) {
      setProgressMessage('');
      const errorMessage = sanitizeForDisplay(error instanceof Error ? error.message : 'Unknown error');
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

      setMessages((prev) => [...prev, toKitMessage('assistant', `Undone: ${snapshot.description}`)]);
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
