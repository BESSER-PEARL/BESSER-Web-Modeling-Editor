import React from 'react';
import { useAppSelector } from '../../store/hooks';
import { selectActiveDiagramType, selectActiveDiagramIndex } from '../../services/workspace/workspaceSlice';
import { ApollonEditorComponent } from '../apollon-editor-component/ApollonEditorComponent';
import { GraphicalUIEditor } from '../grapesjs-editor';
import { QuantumEditorComponent } from '../quantum-editor-component/QuantumEditorComponent';

export const EditorView: React.FC = () => {
  const activeDiagramType = useAppSelector(selectActiveDiagramType);
  const activeDiagramIndex = useAppSelector(selectActiveDiagramIndex);

  if (activeDiagramType === 'GUINoCodeDiagram') {
    return <GraphicalUIEditor key={`gui-${activeDiagramIndex}`} />;
  }

  if (activeDiagramType === 'QuantumCircuitDiagram') {
    return <QuantumEditorComponent key={`quantum-${activeDiagramIndex}`} />;
  }

  // All UML diagram types use ApollonEditor
  return <ApollonEditorComponent />;
};
