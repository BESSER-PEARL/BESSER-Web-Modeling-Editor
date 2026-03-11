import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { selectActiveDiagramType, selectActiveDiagramIndex, selectWorkspaceLoading } from '../../services/workspace/workspaceSlice';
import { ApollonEditorComponent } from '../apollon-editor-component/ApollonEditorComponent';
import { EditorErrorBoundary } from '../error-handling/ErrorBoundary';
import { SuspenseFallback } from '../loading/SuspenseFallback';

// Lazy-loaded heavy editor integrations (GrapesJS ~1800 lines, Quantum ~350 lines)
const GraphicalUIEditor = React.lazy(() =>
  import('../grapesjs-editor').then((m) => ({ default: m.GraphicalUIEditor })),
);
const QuantumEditorComponent = React.lazy(() =>
  import('../quantum-editor-component/QuantumEditorComponent').then((m) => ({ default: m.QuantumEditorComponent })),
);

export const EditorView: React.FC = () => {
  const activeDiagramType = useAppSelector(selectActiveDiagramType);
  const activeDiagramIndex = useAppSelector(selectActiveDiagramIndex);
  const isLoading = useAppSelector(selectWorkspaceLoading);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">Switching diagram...</span>
      </div>
    );
  }

  if (activeDiagramType === 'GUINoCodeDiagram') {
    return (
      <EditorErrorBoundary>
        <Suspense fallback={<SuspenseFallback message="Loading GUI editor..." />}>
          <GraphicalUIEditor key={`gui-${activeDiagramIndex}`} />
        </Suspense>
      </EditorErrorBoundary>
    );
  }

  if (activeDiagramType === 'QuantumCircuitDiagram') {
    return (
      <EditorErrorBoundary>
        <Suspense fallback={<SuspenseFallback message="Loading quantum editor..." />}>
          <QuantumEditorComponent key={`quantum-${activeDiagramIndex}`} />
        </Suspense>
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
