import { createHostProviderContext } from '../host-provider/host-provider';

/**
 * Supplied by the host: whether an element has a recorded trace, and how to show it. The editor stays
 * storage-agnostic: the trace lives in the host, the editor only renders the link and calls back.
 */
export interface TraceabilityProvider {
  /** Whether the project's trace knows the element (so the link leads somewhere). */
  hasTrace: (elementId: string) => boolean;
  /** Show the element's traceability (the host opens its Traceability page). */
  onShowTrace: (elementId: string) => void;
}

export const traceabilityContext = createHostProviderContext<TraceabilityProvider>();

export const useTraceability = traceabilityContext.useValue;
