import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../app/store/hooks';
import {
  selectActiveDiagramType,
  selectActiveDiagramIndex,
  selectWorkspaceLoading,
} from '../../app/store/workspaceSlice';
import { ApollonEditorComponent } from './uml/ApollonEditorComponent';
import { EditorErrorBoundary } from '../../shared/components/error-handling/ErrorBoundary';
import { EditorSkeleton } from '../../shared/components/loading/EditorSkeleton';
import { SuspenseFallback } from '../../shared/components/loading/SuspenseFallback';

// Lazy-loaded heavy editor integrations (GrapesJS ~1800 lines, Quantum ~350 lines)
const GraphicalUIEditor = React.lazy(() =>
  import('./gui').then((m) => ({ default: m.GraphicalUIEditor })),
);
const QuantumEditorComponent = React.lazy(() =>
  import('./quantum/QuantumEditorComponent').then((m) => ({ default: m.QuantumEditorComponent })),
);
const KnowledgeGraphEditor = React.lazy(() =>
  import('./kg').then((m) => ({ default: m.KnowledgeGraphEditor })),
);

export const EditorView: React.FC = () => {
  const { t } = useTranslation();
  const activeDiagramType = useAppSelector(selectActiveDiagramType);
  const activeDiagramIndex = useAppSelector(selectActiveDiagramIndex);
  const isLoading = useAppSelector(selectWorkspaceLoading);

  if (isLoading) {
    return <EditorSkeleton />;
  }

  if (activeDiagramType === 'GUINoCodeDiagram') {
    return (
      <EditorErrorBoundary>
        <Suspense fallback={<SuspenseFallback message={t('editors.loadingGuiEditor')} />}>
          <GraphicalUIEditor key={`gui-${activeDiagramIndex}`} />
        </Suspense>
      </EditorErrorBoundary>
    );
  }

  if (activeDiagramType === 'QuantumCircuitDiagram') {
    return (
      <EditorErrorBoundary>
        <Suspense fallback={<SuspenseFallback message={t('editors.loadingQuantumEditor')} />}>
          <QuantumEditorComponent key={`quantum-${activeDiagramIndex}`} />
        </Suspense>
      </EditorErrorBoundary>
    );
  }

  if (activeDiagramType === 'KnowledgeGraphDiagram') {
    return (
      <EditorErrorBoundary>
        <Suspense fallback={<SuspenseFallback message={t('editors.loadingKgEditor')} />}>
          <KnowledgeGraphEditor key={`kg-${activeDiagramIndex}`} />
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
