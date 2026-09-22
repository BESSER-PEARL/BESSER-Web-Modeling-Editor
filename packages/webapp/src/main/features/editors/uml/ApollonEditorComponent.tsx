import { ApollonEditor, UMLModel, diagramBridge } from '@besser/wme';
import React, { useEffect, useRef, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { toEditorLocale } from '../../../shared/i18n/languages';
import { ApollonEditorContext } from './apollon-editor-context';
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

export const ApollonEditorComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ApollonEditor | null>(null);
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
  const { setEditor } = useContext(ApollonEditorContext);
  const { i18n } = useTranslation();
  const localeRef = useRef(toEditorLocale(i18n.resolvedLanguage ?? i18n.language));
  localeRef.current = toEditorLocale(i18n.resolvedLanguage ?? i18n.language);

  // Stable refs so the setup effect can read current values without
  // needing them in its dependency array (avoids destroy/recreate loops).
  const reduxDiagramRef = useRef(reduxDiagram);
  reduxDiagramRef.current = reduxDiagram;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const destroyEditorDeferred = useCallback((editor: ApollonEditor) => {
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

  // Cleanup function
  const cleanupEditor = useCallback(async () => {
    // Clear any pending debounced save
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
      debouncedSaveRef.current = null;
    }
    const editor = editorRef.current;
    editorRef.current = null;
    if (!editor) return;
    // Unsubscribe from model changes before destroying
    if (modelSubscriptionRef.current !== null) {
      editor.unsubscribeFromModelChange(modelSubscriptionRef.current);
      modelSubscriptionRef.current = null;
    }
    await destroyEditorDeferred(editor);
  }, [destroyEditorDeferred]);

  // Keep the diagramBridge's agentPlatform in sync with the active diagram's config.
  // This ensures editor popups read the correct platform even when the user hasn't
  // visited the agent config panel in this session.
  useEffect(() => {
    const platform = (reduxDiagram?.config?.agentPlatform as string | undefined) ?? 'websocket';
    diagramBridge.setAgentPlatform(platform);
  }, [reduxDiagram]);

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

  // Keep the editor engine's UI language in sync with the app language.
  // `set locale` recreates the editor internally while preserving the model.
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      try {
        editor.locale = toEditorLocale(lng);
      } catch (error) {
        console.warn('Failed to update editor locale:', error);
      }
    };
    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

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

      const nextEditor = new ApollonEditor(containerRef.current, { ...currentOptions, locale: localeRef.current });
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

      // Subscribe to model changes (debounced to avoid excessive localStorage writes on every keystroke)
      modelSubscriptionRef.current = nextEditor.subscribeToModelChange((model: UMLModel) => {
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
      style={{ backgroundColor: 'var(--apollon-background, #ffffff)' }}
    />
  );
};
