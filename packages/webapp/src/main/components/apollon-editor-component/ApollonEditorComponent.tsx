import { ApollonEditor, UMLModel, diagramBridge } from '@besser/wme';
import React, { useEffect, useRef, useContext } from 'react';
import styled from 'styled-components';
import { uuid } from '../../utils/uuid';

import { setCreateNewEditor, updateDiagramThunk, selectCreatenewEditor } from '../../services/diagram/diagramSlice';
import { ApollonEditorContext } from './apollon-editor-context';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectPreviewedDiagramIndex } from '../../services/version-management/versionManagementSlice';
import { addDiagramToCurrentProject } from '../../utils/localStorage';
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
  const previewedDiagramIndex = useAppSelector(selectPreviewedDiagramIndex);
  const { setEditor } = useContext(ApollonEditorContext);
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
        editorRef.current = new ApollonEditor(containerRef.current, editorOptions);
        await editorRef.current.nextRender;

        const modelToPreview = reduxDiagram?.versions && reduxDiagram.versions[previewedDiagramIndex]?.model;
        if (isUMLModel(modelToPreview)) {
          editorRef.current.model = modelToPreview;
        }
      }
    };

    setupEditor();
    return () => {
      isSubscribed = false;
    };
  }, [createNewEditor, previewedDiagramIndex, options.type]);

  const key = reduxDiagram?.id || uuid();

  return <ApollonContainer key={key} ref={containerRef} />;
};
