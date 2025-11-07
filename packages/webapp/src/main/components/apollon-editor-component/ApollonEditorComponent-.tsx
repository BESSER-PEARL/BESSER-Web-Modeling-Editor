import { ApollonEditor, UMLModel } from '@besser/wme';
import React, { useEffect, useRef, useContext } from 'react';
import styled from 'styled-components';
import { uuid } from '../../utils/uuid';

import { setCreateNewEditor, updateDiagramThunk, selectCreatenewEditor } from '../../services/diagram/diagramSlice';
import { ApollonEditorContext } from './apollon-editor-context';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectPreviewedDiagramIndex } from '../../services/version-management/versionManagementSlice';
import { isUMLModel } from '../../types/project';

const ApollonContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 2;
  overflow: hidden;
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

  useEffect(() => {
    const setupEditor = async () => {
      if (!containerRef.current) return;

      if (createNewEditor || previewedDiagramIndex === -1) {
        // Initialize or reset editor
        if (editorRef.current) {
          await editorRef.current.nextRender;
          editorRef.current.destroy();
        }
        editorRef.current = new ApollonEditor(containerRef.current, options);
        await editorRef.current.nextRender;

        // Only load the model if we're not changing diagram type
        if (reduxDiagram.model && isUMLModel(reduxDiagram.model) && reduxDiagram.model.type === options.type) {
          editorRef.current.model = reduxDiagram.model;
        }

        editorRef.current.subscribeToModelChange((model: UMLModel) => {
          const diagram = { ...reduxDiagram, model };
          dispatch(updateDiagramThunk(diagram));
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
  }, [createNewEditor, previewedDiagramIndex, options.type]);

  const key = reduxDiagram?.id || uuid();

  return <ApollonContainer key={key} ref={containerRef} />;
};
