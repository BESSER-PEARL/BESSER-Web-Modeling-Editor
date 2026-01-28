import { ApollonEditor, UMLModel } from '@besser/wme';
import React, { useEffect, useRef, useContext, useCallback } from 'react';
import { ApollonEditor, UMLModel, diagramBridge } from '@besser/wme';
import React, { useEffect, useRef, useContext } from 'react';
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
  const { setEditor } = useContext(ApollonEditorContext);

  // Cleanup function
  const cleanupEditor = useCallback(() => {
    if (editorRef.current) {
      try {
  const currentModel = isUMLModel(reduxDiagram?.model) ? reduxDiagram?.model : undefined;
  const currentProject = useAppSelector(selectCurrentProject);
  
  // Track if this diagram was added to the project to avoid duplicate additions
  const diagramAddedToProjectRef = useRef<string | null>(null);

  // Update diagram bridge with available diagrams from project
  useEffect(() => {
    if (currentProject) {
      // Set available state machines
      const stateMachines = currentProject.diagrams.StateMachineDiagram?.id && currentProject.diagrams.StateMachineDiagram?.title
        ? [{ id: currentProject.diagrams.StateMachineDiagram.id, name: currentProject.diagrams.StateMachineDiagram.title }]
        : [];
      
      // Set available quantum circuits
      const quantumCircuits = currentProject.diagrams.QuantumCircuitDiagram?.id && currentProject.diagrams.QuantumCircuitDiagram?.title
        ? [{ id: currentProject.diagrams.QuantumCircuitDiagram.id, name: currentProject.diagrams.QuantumCircuitDiagram.title }]
        : [];
      
      diagramBridge.setStateMachineDiagrams(stateMachines);
      diagramBridge.setQuantumCircuitDiagrams(quantumCircuits);
    }
  }, [currentProject]);

  useEffect(() => {
    let isSubscribed = true;
    const setupEditor = async () => {
      if (!containerRef.current) return;

      if (createNewEditor || previewedDiagramIndex === -1) {
        // Reset tracking when creating a new editor
        diagramAddedToProjectRef.current = null;
        
        // Initialize or reset editor
        if (editorRef.current) {
          await editorRef.current.nextRender;
          editorRef.current.destroy();
        }
        editorRef.current = new ApollonEditor(containerRef.current, options);
        await editorRef.current.nextRender;

        // Only load the model if we're not changing diagram type
        if (currentModel && currentModel.type === options.type) {
          editorRef.current.model = currentModel;
        }

        // Debounced model change handler
        let timeoutId: NodeJS.Timeout;
        editorRef.current.subscribeToModelChange((model: UMLModel) => {
          if (!isSubscribed) return;
          
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (JSON.stringify(model) !== JSON.stringify(currentModel)) {
              // Check if this is a drag and drop operation (empty diagram becomes non-empty)
              const wasEmpty = !currentModel || !currentModel.elements || Object.keys(currentModel.elements).length === 0;
              const isNowNonEmpty = model && model.elements && Object.keys(model.elements).length > 0;
              
              // If diagram went from empty to non-empty, and hasn't been added to project yet, add it
              if (wasEmpty && isNowNonEmpty && reduxDiagram?.id && diagramAddedToProjectRef.current !== reduxDiagram.id) {
                addDiagramToCurrentProject(reduxDiagram.id);
                diagramAddedToProjectRef.current = reduxDiagram.id;
                console.log('Diagram added to project via drag and drop:', reduxDiagram.id);
              }
              
              dispatch(updateDiagramThunk({
                model,
                lastUpdate: new Date().toISOString()
              }));
            }
          }, 500); // 500ms debounce
        });

        setEditor!(editorRef.current);
        dispatch(setCreateNewEditor(false));
      } else if (previewedDiagramIndex !== -1 && editorRef.current) {
        // Handle preview mode
        const editorOptions = { ...options, readonly: true };
        await editorRef.current.nextRender;
        editorRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying editor:', e);
      }
      editorRef.current = null;
    }
    initializedRef.current = false;
  }, []);

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
