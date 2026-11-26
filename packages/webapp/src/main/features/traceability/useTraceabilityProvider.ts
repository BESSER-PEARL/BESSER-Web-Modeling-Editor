import { useMemo, useRef } from 'react';
import type { TraceabilityProvider } from '@besser/wme';
import type { BesserProject } from '../../shared/types/project';
import type { TraceFile } from '../../shared/types/traceability';
import { isModelArtifact } from '../../shared/types/traceability';
import { isTraceabilityEnabled, useProjectTrace } from '../../shared/traceability/traceStore';
import { useOpenTraceability } from './navigation';

/** The editor element ids the trace knows, with the number of model artifacts they were read from. */
interface TracedElements {
  ids: Set<string>;
  artifacts: number;
}

/**
 * The element ids of the trace's model artifacts: `previous` itself when they are the same ones, so the provider
 * (and the editor it is pushed into) changes only when an element enters or leaves the trace, not on every recorded
 * edit. Same when the trace has as many model artifacts as before and each one's element is in `previous`.
 */
function tracedElements(trace: TraceFile, previous: TracedElements | null): TracedElements {
  let artifacts = 0;
  let same = previous !== null;
  for (const artifact of trace.artifacts) {
    if (!isModelArtifact(artifact)) continue;
    artifacts += 1;
    if (same && !previous!.ids.has(artifact.elementId)) same = false;
  }
  if (same && artifacts === previous!.artifacts) return previous!;
  return { ids: new Set(trace.artifacts.flatMap((a) => (isModelArtifact(a) ? [a.elementId] : []))), artifacts };
}

/**
 * The diagram editor's link to the Traceability page: element popups show "Show traceability" for an element
 * the project's trace knows, which opens the element in the page's Diagrams view (its history, its generated
 * code and a way to its lineage). Null while the project records no trace and has none.
 */
export function useTraceabilityProvider(project: BesserProject | null | undefined): TraceabilityProvider | null {
  const trace = useProjectTrace(project?.id);
  const open = useOpenTraceability();
  const enabled = isTraceabilityEnabled(project);
  const last = useRef<TracedElements | null>(null);
  const traced = useMemo(() => {
    last.current = trace ? tracedElements(trace, last.current) : null;
    return last.current;
  }, [trace]);
  const empty = !trace || trace.artifacts.length === 0;
  return useMemo(() => {
    if (!traced || (!enabled && empty)) return null;
    return {
      hasTrace: (elementId: string) => traced.ids.has(elementId),
      onShowTrace: (elementId: string) => open({ tab: 'elements', element: elementId }),
    };
  }, [traced, enabled, empty, open]);
}
