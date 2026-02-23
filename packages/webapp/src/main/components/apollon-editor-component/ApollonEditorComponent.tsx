import { ApollonEditor, UMLModel, diagramBridge } from '@besser/wme';
import React, { useEffect, useRef, useContext, useCallback } from 'react';
import styled from 'styled-components';
import { uuid } from '../../utils/uuid';

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
  const initializedRef = useRef<boolean>(false);
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
    initializedRef.current = false;
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
      if (!containerRef.current || initializedRef.current) return;
      
      console.log('ApollonEditorComponent: Initializing editor');
      initializedRef.current = true;

      // Clean up any existing editor first
      cleanupEditor();

      // Create new editor
      editorRef.current = new ApollonEditor(containerRef.current, options);
      await editorRef.current.nextRender;

      // Load diagram model if available (only UML models)
      if (reduxDiagram?.model && isUMLModel(reduxDiagram.model)) {
        console.log('ApollonEditorComponent: Loading existing model');
        editorRef.current.model = reduxDiagram.model;
      }

      // Subscribe to model changes
      editorRef.current.subscribeToModelChange((model: UMLModel) => {
        dispatch(updateDiagramThunk({ model }));
      });

      setEditor!(editorRef.current);
      dispatch(setCreateNewEditor(false));
    };

    initEditor();

    // Cleanup on unmount
    return () => {
      // console.log('ApollonEditorComponent: Unmounting, cleaning up editor');
      cleanupEditor();
      setEditor!(undefined);
    };
  }, []); // Only run on mount/unmount

  // Handle createNewEditor flag (for diagram type changes within the same view)
  useEffect(() => {
    const setupEditor = async () => {
      if (!containerRef.current || !createNewEditor) return;

      // console.log('ApollonEditorComponent: createNewEditor triggered, reinitializing');
      
      // Clean up existing editor
      cleanupEditor();
      initializedRef.current = true;

      // Create new editor
      editorRef.current = new ApollonEditor(containerRef.current, options);
      await editorRef.current.nextRender;

      // Load diagram model if available (only UML models)
      if (reduxDiagram?.model && isUMLModel(reduxDiagram.model)) {
        editorRef.current.model = reduxDiagram.model;
      }

      // Subscribe to model changes
      editorRef.current.subscribeToModelChange((model: UMLModel) => {
        dispatch(updateDiagramThunk({ model }));
      });

      setEditor!(editorRef.current);
      dispatch(setCreateNewEditor(false));
    };

    setupEditor();
  }, [createNewEditor]);

  const key = reduxDiagram?.id || uuid();

  return <ApollonContainer key={key} ref={containerRef} />;
};
