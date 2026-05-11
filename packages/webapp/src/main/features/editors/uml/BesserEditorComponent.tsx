import { BesserEditor, UMLDiagramType, UMLModel, diagramBridge } from '@besser/wme';
import React, { useEffect, useRef, useContext, useCallback } from 'react';
import { useStore } from 'react-redux';

import { BesserEditorContext } from './besser-editor-context';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { isUMLModel, SupportedDiagramType } from '../../../shared/types/project';
import type { RootState } from '../../../app/store/store';
import {
  updateDiagramModelThunk,
  selectActiveDiagram,
  selectEditorOptions,
  selectEditorRevision,
  selectStateMachineDiagrams,
  selectQuantumCircuitDiagrams,
} from '../../../app/store/workspaceSlice';
import { notifyError } from '../../../shared/utils/notifyError';

/**
 * Identifies the (project, diagram type, diagram index) tuple that the
 * currently-mounted editor instance is bound to. Captured once at setup
 * time and frozen for the editor's lifetime. Both the debounced save and
 * the flush-on-cleanup path consult this against live Redux state before
 * dispatching `updateDiagramModelThunk` — if the user has navigated to a
 * different project (e.g. File > New Project) between scheduling and
 * firing, the save targets the wrong project's diagram slot, which is
 * how the StateMachine-then-new-project content-bleed regression
 * manifested. Mismatched flushes are dropped instead.
 */
type EditorBinding = {
  projectId: string | null;
  diagramType: SupportedDiagramType;
  diagramIndex: number;
};

export const BesserEditorComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<BesserEditor | null>(null);
  const modelSubscriptionRef = useRef<number | null>(null);
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setupRunRef = useRef(0);
  const lastHandledRevisionRef = useRef(0);
  const editorBindingRef = useRef<EditorBinding | null>(null);
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const reduxDiagram = useAppSelector(selectActiveDiagram);
  const options = useAppSelector(selectEditorOptions);
  const editorRevision = useAppSelector(selectEditorRevision);
  const stateMachineDiagrams = useAppSelector(selectStateMachineDiagrams);
  const quantumCircuitDiagrams = useAppSelector(selectQuantumCircuitDiagrams);
  const { setEditor } = useContext(BesserEditorContext);

  // Stable refs so the setup effect can read current values without
  // needing them in its dependency array (avoids destroy/recreate loops).
  const reduxDiagramRef = useRef(reduxDiagram);
  reduxDiagramRef.current = reduxDiagram;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const destroyEditorDeferred = useCallback((editor: BesserEditor) => {
    return new Promise<void>((resolve) => {
      // Defer destroy to avoid React unmount race warnings during render transitions.
      setTimeout(() => {
        try {
          editor.destroy();
        } catch (error) {
          console.warn('Error destroying editor:', error);
        } finally {
          resolve();
        }
      }, 0);
    });
  }, []);

  // Returns true if the editor's captured binding still matches live
  // Redux state. Used to gate save dispatches so a stale save from the
  // previous diagram/project can't bleed into the freshly-loaded one.
  const bindingMatchesCurrentState = useCallback((): boolean => {
    const binding = editorBindingRef.current;
    if (!binding) return false;
    const { workspace } = store.getState();
    return (
      binding.projectId === (workspace.project?.id ?? null) &&
      binding.diagramType === workspace.activeDiagramType &&
      binding.diagramIndex === workspace.activeDiagramIndex
    );
  }, [store]);

  // Flush any pending debounced save synchronously.
  // Mirrors GraphicalUIEditor's flush-on-cleanup pattern so a rapid tab
  // switch within the 300 ms debounce window doesn't drop the user's
  // last keystroke.
  //
  // Content-bleed-on-new-project: only flush when the captured
  // binding still matches live state. When `createProjectThunk` (or any
  // other thunk that swaps the active project/diagram) runs while a
  // debounced save is pending, the global Redux state has already moved
  // on by the time we get here — dispatching `updateDiagramModelThunk`
  // unguarded would write the old editor's model into the *new*
  // project's diagram slot, leaving the canvas displaying stale content.
  const flushPendingSave = useCallback(() => {
    if (!debouncedSaveRef.current) return;
    clearTimeout(debouncedSaveRef.current);
    debouncedSaveRef.current = null;
    const editor = editorRef.current;
    if (!editor) return;
    if (!bindingMatchesCurrentState()) return;
    try {
      // editor.model is a synchronous getter on the current state — by
      // dispatching the thunk inline (no await), we hand the latest model
      // to Redux before destroy() rips the editor down.
      dispatch(updateDiagramModelThunk({ model: editor.model }));
    } catch (error) {
      console.warn('Failed to flush pending UML save on cleanup:', error);
    }
  }, [dispatch, bindingMatchesCurrentState]);

  // Cleanup function
  const cleanupEditor = useCallback(async () => {
    // Flush any pending debounced save before tearing the editor down.
    // Without this, a keystroke within the last 300 ms of editing is lost.
    flushPendingSave();
    const editor = editorRef.current;
    editorRef.current = null;
    editorBindingRef.current = null;
    if (!editor) return;
    // Unsubscribe from model changes before destroying
    if (modelSubscriptionRef.current !== null) {
      editor.unsubscribeFromModelChange(modelSubscriptionRef.current);
      modelSubscriptionRef.current = null;
    }
    await destroyEditorDeferred(editor);
  }, [destroyEditorDeferred, flushPendingSave]);

  useEffect(() => {
    const smDiagrams = stateMachineDiagrams ?? [];
    const qcDiagrams = quantumCircuitDiagrams ?? [];

    const stateMachines = smDiagrams
      .filter(d => d.id && d.title)
      .map(d => ({ id: d.id, name: d.title }));

    const quantumCircuits = qcDiagrams
      .filter(d => d.id && d.title)
      .map(d => ({ id: d.id, name: d.title }));

    diagramBridge.setStateMachineDiagrams(stateMachines);
    diagramBridge.setQuantumCircuitDiagrams(quantumCircuits);
  }, [stateMachineDiagrams, quantumCircuitDiagrams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setupRunRef.current += 1;
      cleanupEditor().catch(notifyError('Editor cleanup'));
      setEditor!(undefined);
    };
  }, [cleanupEditor, setEditor]);

  // Handle editor creation/recreation (initial load + diagram switches/templates).
  // Only runs when editorRevision actually changes (not on every Redux update).
  useEffect(() => {
    if (editorRevision === 0 || editorRevision === lastHandledRevisionRef.current) return;

    const setupEditor = async () => {
      if (!containerRef.current) return;

      lastHandledRevisionRef.current = editorRevision;
      const runId = ++setupRunRef.current;

      // Always destroy old editor before creating a new one
      await cleanupEditor();
      if (!containerRef.current || runId !== setupRunRef.current) return;

      const currentOptions = optionsRef.current;
      const currentDiagram = reduxDiagramRef.current;

      // Capture the (project, diagram type, diagram index) identity that
      // this editor instance is bound to. Used by `flushPendingSave` and
      // the debounced subscriber to refuse writes when the user has
      // navigated to a different project/diagram between when the save
      // was scheduled and when it would have fired.
      const setupState = store.getState().workspace;
      editorBindingRef.current = {
        projectId: setupState.project?.id ?? null,
        diagramType: setupState.activeDiagramType,
        diagramIndex: setupState.activeDiagramIndex,
      };

      const nextEditor = new BesserEditor(containerRef.current, currentOptions);
      editorRef.current = nextEditor;
      await nextEditor.nextRender;
      if (runId !== setupRunRef.current || editorRef.current !== nextEditor) {
        await destroyEditorDeferred(nextEditor);
        return;
      }

      // Load diagram model if available (only UML models)
      if (currentDiagram?.model && isUMLModel(currentDiagram.model)) {
        nextEditor.model = currentDiagram.model;
      }

      // Seed the cross-diagram bridge from the freshly-loaded ClassDiagram
      // so the very first paint (before any user edits) has live data.
      if (currentOptions.type === UMLDiagramType.ClassDiagram && isUMLModel(nextEditor.model)) {
        try {
          diagramBridge.setClassDiagramData(nextEditor.model);
        } catch {
          /* bridge not available */
        }
      }

      // Subscribe to model changes.
      // - Redux persistence is debounced (300 ms) to avoid excessive
      //   localStorage writes on every keystroke.
      // - The cross-diagram bridge (consumed by ObjectDiagram/UserDiagram
      //   palettes) is updated SYNCHRONOUSLY on every model commit so it
      //   never lags the live ClassDiagram editor. fix
      //   for: previously the bridge was fed from a debounced
      //   Redux selector in DiagramTabs.tsx, which trailed the editor by
      //   one 300 ms window.
      const isClassDiagram = currentOptions.type === UMLDiagramType.ClassDiagram;
      modelSubscriptionRef.current = nextEditor.subscribeToModelChange((model: UMLModel) => {
        if (isClassDiagram) {
          try {
            diagramBridge.setClassDiagramData(model);
          } catch {
            /* bridge not available */
          }
        }
        if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
        debouncedSaveRef.current = setTimeout(() => {
          debouncedSaveRef.current = null;
          // Guard against the project being swapped (e.g. via
          // `createProjectThunk` / `loadProjectThunk`) between the
          // model change and the debounce firing. Without this check
          // the dispatched thunk reads live Redux state and writes the
          // stale model into the *new* project's matching slot.
          if (!bindingMatchesCurrentState()) return;
          dispatch(updateDiagramModelThunk({ model }));
        }, 300);
      });

      setEditor!(nextEditor);
    };

    setupEditor().catch(notifyError('Editor setup'));
  }, [
    editorRevision,
    cleanupEditor,
    destroyEditorDeferred,
    dispatch,
    setEditor,
    store,
    bindingMatchesCurrentState,
  ]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col grow overflow-hidden w-full h-full min-h-0"
      style={{ backgroundColor: 'var(--besser-background, #ffffff)' }}
    />
  );
};
