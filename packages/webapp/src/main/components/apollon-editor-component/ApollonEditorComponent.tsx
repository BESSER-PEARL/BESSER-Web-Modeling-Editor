import { ApollonEditor, UMLModel, diagramBridge } from '@besser/wme';
import React, { useEffect, useRef, useContext, useCallback } from 'react';
import styled from 'styled-components';

import { setCreateNewEditor, updateDiagramThunk, selectCreatenewEditor } from '../../services/diagram/diagramSlice';
import { ApollonEditorContext } from './apollon-editor-context';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { isUMLModel } from '../../types/project';
import { selectCurrentProject } from '../../services/project/projectSlice';

const ApollonContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
  width: 100%;
  height: calc(100vh - 60px);
  background-color: var(--apollon-background, #ffffff);
`;

export const ApollonEditorComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ApollonEditor | null>(null);
  const dispatch = useAppDispatch();
  const { diagram: reduxDiagram } = useAppSelector((state) => state.diagram);
  const options = useAppSelector((state) => state.diagram.editorOptions);
  const createNewEditor = useAppSelector(selectCreatenewEditor);
  const currentProject = useAppSelector(selectCurrentProject);
  const { setEditor } = useContext(ApollonEditorContext);

  // Cleanup function
  const cleanupEditor = useCallback(() => {
    if (editorRef.current) {
      try {
        editorRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying editor:', e);
      }
      editorRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!currentProject) {
      diagramBridge.setStateMachineDiagrams([]);
      diagramBridge.setQuantumCircuitDiagrams([]);
      return;
    }

    const stateMachineDiagram = currentProject.diagrams.StateMachineDiagram;
    const quantumCircuitDiagram = currentProject.diagrams.QuantumCircuitDiagram;

    const stateMachines =
      stateMachineDiagram?.id && stateMachineDiagram?.title
        ? [{ id: stateMachineDiagram.id, name: stateMachineDiagram.title }]
        : [];

    const quantumCircuits =
      quantumCircuitDiagram?.id && quantumCircuitDiagram?.title
        ? [{ id: quantumCircuitDiagram.id, name: quantumCircuitDiagram.title }]
        : [];

    diagramBridge.setStateMachineDiagrams(stateMachines);
    diagramBridge.setQuantumCircuitDiagrams(quantumCircuits);
  }, [currentProject]);

  // Initialize editor on mount, cleanup on unmount
  useEffect(() => {
    const initEditor = async () => {
      if (!containerRef.current || editorRef.current) return;

      // Create new editor
      const editor = new ApollonEditor(containerRef.current, options);
      editorRef.current = editor;
      await editor.nextRender;

      // Ignore stale initialization runs when editor was replaced in the meantime
      if (editorRef.current !== editor) return;

      // Load diagram model if available (only UML models)
      if (reduxDiagram?.model && isUMLModel(reduxDiagram.model)) {
        editor.model = reduxDiagram.model;
      }

      // Subscribe to model changes
      editor.subscribeToModelChange((model: UMLModel) => {
        dispatch(updateDiagramThunk({ model }));
      });

      setEditor(editor);
      dispatch(setCreateNewEditor(false));
    };

    initEditor();

    // Cleanup on unmount
    return () => {
      // console.log('ApollonEditorComponent: Unmounting, cleaning up editor');
      cleanupEditor();
      setEditor(undefined);
    };
  }, []); // Only run on mount/unmount

  // Handle createNewEditor flag (for diagram type changes within the same view)
  useEffect(() => {
    const setupEditor = async () => {
      if (!containerRef.current || !createNewEditor) return;

      // console.log('ApollonEditorComponent: createNewEditor triggered, reinitializing');
      
      // Clean up existing editor
      cleanupEditor();

      // Create new editor
      const editor = new ApollonEditor(containerRef.current, options);
      editorRef.current = editor;
      await editor.nextRender;

      // Ignore stale reinitialization runs when editor was replaced in the meantime
      if (editorRef.current !== editor) return;

      // Load diagram model if available (only UML models)
      if (reduxDiagram?.model && isUMLModel(reduxDiagram.model)) {
        editor.model = reduxDiagram.model;
      }

      // Subscribe to model changes
      editor.subscribeToModelChange((model: UMLModel) => {
        dispatch(updateDiagramThunk({ model }));
      });

      setEditor(editor);
      dispatch(setCreateNewEditor(false));
    };

    setupEditor();
  }, [createNewEditor, cleanupEditor, dispatch, options, reduxDiagram?.model, setEditor]);

  return <ApollonContainer ref={containerRef} />;
};
