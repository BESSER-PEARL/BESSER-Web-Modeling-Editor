import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TraceabilityTab, TraceabilityTarget } from './navigation';
import { parseTraceabilitySearch, traceabilitySearch } from './navigation';

export interface TraceabilityUrlState {
  tab: TraceabilityTab;
  /** The `root` and `element` ids as the URL has them (unresolved). */
  root: string | null;
  element: string | null;
  /** Show a tab, keeping the rest (a new history entry). */
  setTab: (tab: TraceabilityTab) => void;
  /** Change the state; a new history entry unless `replace`. */
  navigate: (target: TraceabilityTarget, options?: { replace?: boolean }) => void;
}

/**
 * The Traceability page's state, kept in the URL (`?tab=&root=&element=`): every change is a history entry, so
 * back and forward walk through the views, and a link opens a given one. A change of project clears it: the ids
 * of one project's trace mean nothing in another's.
 */
export function useTraceabilityUrlState(projectId: string | undefined): TraceabilityUrlState {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseTraceabilitySearch(params), [params]);
  const current = useRef(state);
  current.current = state;

  const navigate = useCallback(
    (target: TraceabilityTarget, options?: { replace?: boolean }) => {
      const next = { ...current.current, ...target };
      setParams(traceabilitySearch(next), { replace: options?.replace });
    },
    [setParams],
  );
  const setTab = useCallback((tab: TraceabilityTab) => navigate({ tab }), [navigate]);

  // Another project opened while the page shows: start over at its timeline.
  const shownProject = useRef(projectId);
  useEffect(() => {
    const previous = shownProject.current;
    shownProject.current = projectId;
    if (previous !== undefined && projectId !== undefined && previous !== projectId) {
      setParams(traceabilitySearch({ tab: 'timeline' }), { replace: true });
    }
  }, [projectId, setParams]);

  return { ...state, setTab, navigate };
}
