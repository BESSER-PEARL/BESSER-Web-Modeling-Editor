import React from 'react';
import { useAppSelector } from '../../store/hooks';
import { selectActiveDiagramType, selectActiveDiagramIndex } from '../../services/workspace/workspaceSlice';
import { ApollonEditorComponent } from '../apollon-editor-component/ApollonEditorComponent';
import { GraphicalUIEditor } from '../grapesjs-editor';
import { QuantumEditorComponent } from '../quantum-editor-component/QuantumEditorComponent';
import { EditorErrorBoundary } from '../error-handling/ErrorBoundary';

export const EditorView: React.FC = () => {
  const activeDiagramType = useAppSelector(selectActiveDiagramType);
  const activeDiagramIndex = useAppSelector(selectActiveDiagramIndex);

  if (activeDiagramType === 'GUINoCodeDiagram') {
    return (
      <EditorErrorBoundary>
        <GraphicalUIEditor key={`gui-${activeDiagramIndex}`} />
      </EditorErrorBoundary>
    );
  }

  if (activeDiagramType === 'QuantumCircuitDiagram') {
    return (
      <EditorErrorBoundary>
        <QuantumEditorComponent key={`quantum-${activeDiagramIndex}`} />
      </EditorErrorBoundary>
    );
  }

  // All UML diagram types use ApollonEditor
  return (
    <EditorErrorBoundary>
      <ApollonEditorComponent />
    </EditorErrorBoundary>
  );
};
