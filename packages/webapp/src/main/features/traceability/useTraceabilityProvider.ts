import { useMemo } from 'react';
import type { TraceabilityProvider } from '@besser/wme';
import type { BesserProject } from '../../shared/types/project';
import { isModelArtifact } from '../../shared/types/traceability';
import { isTraceabilityEnabled, useProjectTrace } from '../../shared/traceability/traceStore';
import { useOpenTraceability } from './navigation';

/**
 * The diagram editor's link to the Traceability page: element popups show "Show traceability" for an element
 * the project's trace knows, which opens the element in the page's Diagrams view (its history, its generated
 * code and a way to its lineage). Null while the project records no trace and has none.
 */
export function useTraceabilityProvider(project: BesserProject | null | undefined): TraceabilityProvider | null {
  const trace = useProjectTrace(project?.id);
  const open = useOpenTraceability();
  const enabled = isTraceabilityEnabled(project);
  return useMemo(() => {
    if (!trace || (!enabled && trace.artifacts.length === 0)) return null;
    const traced = new Set(trace.artifacts.flatMap((a) => (isModelArtifact(a) ? [a.elementId] : [])));
    return {
      hasTrace: (elementId: string) => traced.has(elementId),
      onShowTrace: (elementId: string) => open({ tab: 'elements', element: elementId }),
    };
  }, [trace, enabled, open]);
}
