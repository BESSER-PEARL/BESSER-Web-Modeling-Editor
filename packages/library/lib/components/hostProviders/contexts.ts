import { createHostProviderContext } from "./hostProvider"

// Host-supplied providers read by the inspectors. The editor stays
// storage-agnostic: lineage data, project mutation and cross-diagram lookups
// live in the host; the editor only renders the affordances and dispatches
// clicks through these callbacks.

/** A derived element's source, as resolved by the host. */
export interface ResolvedSource {
  sourceElementId: string
  sourceDiagramTitle: string
  sourceDiagramType: string
  /** Set when the host can resolve the source element in the source model;
   *  lets the link read `← Source: <name> (<type>)` instead of repeating the
   *  diagram-level lineage badge. */
  sourceElementName?: string
  sourceElementType?: string
}

export interface LineageProvider {
  resolveSource: (derivedElementId: string) => ResolvedSource | null
  onShowSource: (resolved: ResolvedSource) => void
}

export const lineageContext = createHostProviderContext<LineageProvider>()
export const useLineage = lineageContext.useValue

/** An element of another diagram offered by a cross-diagram picker. */
export interface PickableElement {
  /** Stable model id of the target element. Stored on the ref. */
  id: string
  /** Display name (may be empty). */
  name: string
  /** Title of the diagram the element lives in, for disambiguation. */
  diagramTitle: string
}

/** Cross-diagram element picker for element-grained refs (`realizes` → Class,
 *  `manifests` → Component). */
export interface ElementPickerProvider {
  /** All elements whose type is one of `typeTokens`, drawn from every diagram
   *  in the project except the one being edited. */
  listElements: (typeTokens: string[]) => PickableElement[]
}

export const elementPickerContext =
  createHostProviderContext<ElementPickerProvider>()
export const useElementPicker = elementPickerContext.useValue

/** Links an agentic BPMN lane or task to an Agent diagram. */
export interface AgentDiagramLinker {
  /** True iff `ref` resolves to an Agent diagram that exists in the project;
   *  the inspector then offers "Open" instead of "Define". */
  isRefAlive: (ref: string) => boolean
  /** Define click: the host creates an Agent diagram for the lane or task
   *  `laneId`, stores `agentDiagramRef` on it and switches to the new diagram.
   *  Resolves to the new diagram id, or null on failure (the host has already
   *  told the user why). */
  createForLane: (
    suggestedTitle: string,
    laneId: string
  ) => Promise<string | null>
  /** Switch to the Agent diagram identified by `ref` (fire-and-forget). */
  openByRef: (ref: string) => void
}

export const agentDiagramLinkerContext =
  createHostProviderContext<AgentDiagramLinker>()
export const useAgentDiagramLinker = agentDiagramLinkerContext.useValue
