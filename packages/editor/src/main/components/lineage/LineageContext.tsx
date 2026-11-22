import { createHostProviderContext } from '../host-provider/host-provider';

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

export const lineageContext = createHostProviderContext<LineageProvider>();

export const useLineage = lineageContext.useValue;
