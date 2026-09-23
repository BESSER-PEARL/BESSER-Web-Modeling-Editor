import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Supplied by the host at editor-init time.
 *
 * The editor stays storage-agnostic: lineage data and navigation
 * logic live in the host; the editor only renders the link and
 * dispatches the click via the host-supplied callback.
 */
export interface ResolvedSource {
  sourceElementId: string;
  sourceDiagramTitle: string;
  sourceDiagramType: string;
  /** Optional — set by the host when the source element can be resolved
   *  in the source diagram's model. Used by LineageSourceLink to render
   *  the link as `← Source: <name> (<type>)` instead of duplicating the
   *  topbar badge's diagram-level label. */
  sourceElementName?: string;
  sourceElementType?: string;
}

export interface LineageProvider {
  resolveSource: (derivedElementId: string) => ResolvedSource | null;
  onShowSource: (resolved: ResolvedSource) => void;
}

const LineageContext = createContext<LineageProvider | null>(null);

export const LineageContextProvider: React.FC<{
  value: LineageProvider | null;
  children: React.ReactNode;
}> = ({ value, children }) => <LineageContext.Provider value={value}>{children}</LineageContext.Provider>;

export const useLineage = (): LineageProvider | null => useContext(LineageContext);

/**
 * Wraps `LineageContextProvider` so that ApollonEditor can swap the
 * provider value imperatively (via `setLineageProvider(...)`) without
 * tearing down its React tree. The editor calls `register(setValue)`
 * once on mount; subsequent setLineageProvider calls flow through the
 * captured setter.
 */
export const LineageProviderRoot: React.FC<{
  initialValue: LineageProvider | null;
  register: (listener: (v: LineageProvider | null) => void) => void;
  children: React.ReactNode;
}> = ({ initialValue, register, children }) => {
  const [value, setValue] = useState<LineageProvider | null>(initialValue);
  useEffect(() => {
    register(setValue);
  }, [register]);
  return <LineageContextProvider value={value}>{children}</LineageContextProvider>;
};
