import { BesserEditor, UMLDiagramType, UMLModel, diagramBridge } from '@besser/wme';
import React, { useEffect, useRef, useContext, useCallback } from 'react';

import { BesserEditorContext } from './besser-editor-context';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { isUMLModel } from '../../../shared/types/project';
import {
  updateDiagramModelThunk,
  selectActiveDiagram,
  selectEditorOptions,
  selectEditorRevision,
  selectStateMachineDiagrams,
  selectQuantumCircuitDiagrams,
} from '../../../app/store/workspaceSlice';
import { notifyError } from '../../../shared/utils/notifyError';

export const BesserEditorComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<BesserEditor | null>(null);
  const modelSubscriptionRef = useRef<number | null>(null);
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setupRunRef = useRef(0);
  const lastHandledRevisionRef = useRef(0);
  const dispatch = useAppDispatch();
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

  // SA-FINAL-3 Task 2: flush any pending debounced save synchronously.
  // Mirrors GraphicalUIEditor's flush-on-cleanup pattern so a rapid tab
  // switch within the 300 ms debounce window doesn't drop the user's
  // last keystroke.
  const flushPendingSave = useCallback(() => {
    if (!debouncedSaveRef.current) return;
    clearTimeout(debouncedSaveRef.current);
    debouncedSaveRef.current = null;
    const editor = editorRef.current;
    if (!editor) return;
    try {
      // editor.model is a synchronous getter on the current state — by
      // dispatching the thunk inline (no await), we hand the latest model
      // to Redux before destroy() rips the editor down.
      dispatch(updateDiagramModelThunk({ model: editor.model }));
    } catch (error) {
      console.warn('Failed to flush pending UML save on cleanup:', error);
    }
  }, [dispatch]);

  // Cleanup function
  const cleanupEditor = useCallback(async () => {
    // Flush any pending debounced save before tearing the editor down.
    // Without this, a keystroke within the last 300 ms of editing is lost.
    flushPendingSave();
    const editor = editorRef.current;
    editorRef.current = null;
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
      //   never lags the live ClassDiagram editor. SA-FINAL-3 Task 1 fix
      //   for PC-A5: previously the bridge was fed from a debounced
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
          dispatch(updateDiagramModelThunk({ model }));
        }, 300);
      });

      setEditor!(nextEditor);
    };

    setupEditor().catch(notifyError('Editor setup'));
  }, [editorRevision, cleanupEditor, destroyEditorDeferred, dispatch, setEditor]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col grow overflow-hidden w-full h-full min-h-0"
      style={{ backgroundColor: 'var(--besser-background, #ffffff)' }}
    />
  );
};
