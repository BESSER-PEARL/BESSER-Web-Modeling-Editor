import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Where the Traceability page is and how to link into it. The page keeps its state in the URL:
 * `/traceability?tab=<tab>&root=<id>&element=<id>`, so a link opens a given view, and back and forward
 * walk through what was looked at.
 *
 * - `tab`: the view; `timeline` when left out or unknown.
 * - `root`: where the Lineage starts: a trace artifact id, or the editor id of a model element (a diagram,
 *   a class), which the page resolves to its artifact. Left out, the lineage is the whole project's.
 * - `element`: the element selected in the Diagrams view, either kind of id as for `root`.
 *
 * An id the project's trace does not hold is ignored, with a note on the page.
 */

export const TRACEABILITY_PATH = '/traceability';

export const TRACEABILITY_TABS = ['timeline', 'elements', 'coverage', 'lineage', 'requirements'] as const;
export type TraceabilityTab = (typeof TRACEABILITY_TABS)[number];
export const DEFAULT_TRACEABILITY_TAB: TraceabilityTab = 'timeline';

export interface TraceabilityTarget {
  /** The view to open. Left out: `lineage` when `root` is given, `elements` when only `element` is, else the timeline. */
  tab?: TraceabilityTab;
  /** Where the lineage starts (a trace artifact id or a model element's editor id). */
  root?: string | null;
  /** The element to select in the Diagrams view (a trace artifact id or a model element's editor id). */
  element?: string | null;
}

export const isTraceabilityTab = (value: unknown): value is TraceabilityTab =>
  typeof value === 'string' && (TRACEABILITY_TABS as readonly string[]).includes(value);

/** The tab a target opens. */
export function targetTab(target: TraceabilityTarget): TraceabilityTab {
  if (target.tab) return target.tab;
  if (target.root) return 'lineage';
  if (target.element) return 'elements';
  return DEFAULT_TRACEABILITY_TAB;
}

/** The query string of a target, without the leading `?`. */
export function traceabilitySearch(target: TraceabilityTarget): string {
  const params = new URLSearchParams();
  params.set('tab', targetTab(target));
  if (target.root) params.set('root', target.root);
  if (target.element) params.set('element', target.element);
  return params.toString();
}

/** The page's URL for a target: `traceabilityUrl({ tab: 'lineage', root: artifactId })`. */
export function traceabilityUrl(target: TraceabilityTarget = {}): string {
  return `${TRACEABILITY_PATH}?${traceabilitySearch(target)}`;
}

/** The page state a query string holds; an unknown tab reads as the default one. */
export function parseTraceabilitySearch(search: string | URLSearchParams): Required<{
  tab: TraceabilityTab;
  root: string | null;
  element: string | null;
}> {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const tab = params.get('tab');
  return {
    tab: isTraceabilityTab(tab) ? tab : DEFAULT_TRACEABILITY_TAB,
    root: params.get('root') || null,
    element: params.get('element') || null,
  };
}

/** Navigates to the Traceability page: `useOpenTraceability()({ tab: 'lineage', root: artifactId })`. */
export function useOpenTraceability(): (target?: TraceabilityTarget) => void {
  const navigate = useNavigate();
  return useCallback((target: TraceabilityTarget = {}) => navigate(traceabilityUrl(target)), [navigate]);
}
