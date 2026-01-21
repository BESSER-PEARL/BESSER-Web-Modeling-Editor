import { ApollonEditor, UMLModel } from '@besser/wme';
import React, { useEffect, useRef, useContext } from 'react';
import styled from 'styled-components';
import { uuid } from '../../utils/uuid';

import { setCreateNewEditor, updateDiagramThunk, selectCreatenewEditor } from '../../services/diagram/diagramSlice';
import { ApollonEditorContext } from './apollon-editor-context';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addDiagramToCurrentProject } from '../../utils/localStorage';
import { isUMLModel } from '../../types/project';

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
  const { setEditor } = useContext(ApollonEditorContext);
  const currentModel = isUMLModel(reduxDiagram?.model) ? reduxDiagram?.model : undefined;
  
  // Track if this diagram was added to the project to avoid duplicate additions
  const diagramAddedToProjectRef = useRef<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    const setupEditor = async () => {
      if (!containerRef.current) return;

      if (createNewEditor) {
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
      }
    };

    setupEditor();
    return () => {
      isSubscribed = false;
    };
  }, [createNewEditor, options.type]);

  const key = reduxDiagram?.id || uuid();

  return <ApollonContainer key={key} ref={containerRef} />;
};
