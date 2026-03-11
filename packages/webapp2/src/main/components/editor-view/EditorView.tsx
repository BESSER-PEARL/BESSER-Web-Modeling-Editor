import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { selectActiveDiagramType, selectActiveDiagramIndex, selectWorkspaceLoading } from '../../services/workspace/workspaceSlice';
import { ApollonEditorComponent } from '../apollon-editor-component/ApollonEditorComponent';
import { GraphicalUIEditor } from '../grapesjs-editor';
import { QuantumEditorComponent } from '../quantum-editor-component/QuantumEditorComponent';
import { EditorErrorBoundary } from '../error-handling/ErrorBoundary';

export const EditorView: React.FC = () => {
  const activeDiagramType = useAppSelector(selectActiveDiagramType);
  const activeDiagramIndex = useAppSelector(selectActiveDiagramIndex);
  const isLoading = useAppSelector(selectWorkspaceLoading);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">Switching diagram...</span>
      </div>
    );
  }

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
