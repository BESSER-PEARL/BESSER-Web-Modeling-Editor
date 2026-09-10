/**
 * Predicate over the minimal node shape we
 * care about (`type` + `data.stereotype`). Lives in
 * `bpmnConstraints.ts` alongside `canDropIntoParent` because both are
 * zero-dependency boolean rules consumed by event handlers — keeping
 * them together avoids dragging React Flow types into the import
 * graph of pure-helper tests.
 *
 * Diagram-scoped rules (object-link association
 * availability; NN endpoint/singleton rules) live in
 * `services/connectionRules` and are consulted at the end of
 * `canConnectEndpoints` — the rule modules stay out of this file so it
 * remains a thin shared pipeline.
 */
import {
  evaluateConnectionRules,
  type MinimalRuleEdge,
} from "@/services/connectionRules"

export interface MinimalNodeForConnect {
  id?: string
  type?: string
  data?: { stereotype?: unknown } | null
}

/**
 * Returns `true` when the node represents a v3
 * Enumeration class (`type === 'class'` and `data.stereotype ===
 * 'Enumeration'`). v3 enumerations are referenced by *type* from
 * class attributes and must never participate in an edge.
 */
export const isEnumerationClassNode = (
  node: MinimalNodeForConnect | undefined | null
): boolean => {
  if (!node) return false
  if (node.type !== "class") return false
  return node.data?.stereotype === "Enumeration"
}

/**
 * Reject any connection where either endpoint
 * resolves to an Enumeration class node. Mirrors 's
 * `canDropIntoParent` predicate style — a single boolean rule consumed
 * by event handlers.
 */
export const canConnectEndpoints = (
  nodes: readonly MinimalNodeForConnect[],
  source: string | null | undefined,
  target: string | null | undefined,
  getId: (n: MinimalNodeForConnect) => string | undefined = (n) =>
    (n as { id?: string }).id,
  // Existing-edge topology for rules that need it (NN Configuration
  // singleton). Optional so endpoint-only callers stay unchanged.
  edges: readonly MinimalRuleEdge[] = []
): boolean => {
  const sourceNode = nodes.find((n) => getId(n) === source)
  const targetNode = nodes.find((n) => getId(n) === target)
  if (isEnumerationClassNode(sourceNode)) return false
  if (isEnumerationClassNode(targetNode)) return false
  // Diagram-scoped rules (registered in `services/connectionRules`).
  return evaluateConnectionRules({ nodes, sourceNode, targetNode, edges })
}

/**
 * Allowed NN layer kinds inside an `NNContainer`. Top-level-only kinds
 * (Configuration, TrainingDataset, TestDataset) are intentionally
 * excluded — datasets and configuration bind to the container via
 * NNAssociation edges, not by nesting.
 *
 * Keep this set in sync with the NN palette in
 * `lib/constants.ts` (`UMLDiagramType.NNDiagram`). NNReference is
 * allowed inside as well so a forward-reference can sit next to the
 * layers it points at.
 */
const NN_LAYER_KINDS_IN_CONTAINER: ReadonlySet<string> = new Set([
  "Conv1DLayer",
  "Conv2DLayer",
  "Conv3DLayer",
  "PoolingLayer",
  "RNNLayer",
  "LSTMLayer",
  "GRULayer",
  "LinearLayer",
  "FlattenLayer",
  "EmbeddingLayer",
  "DropoutLayer",
  "LayerNormalizationLayer",
  "BatchNormalizationLayer",
  "TensorOp",
  "NNReference",
])

/**
 * Determines if a node type can be dropped into a parent node type
 * based on BPMN rules and constraints
 */
export const canDropIntoParent = (
  childType: string,
  parentType: string
): boolean => {
  // NNContainer accepts the layer kinds (and only
  // those). The drop-handler in `DraggableGhost.tsx` /
  // `useNodeDragStop.ts` consults this to set `parentId` on the new
  // node — without this rule layer drops land at the canvas root.
  if (parentType === "NNContainer") {
    return NN_LAYER_KINDS_IN_CONTAINER.has(childType)
  }

  // State machine `State` parents the three legacy
  // body shapes (entry/exit body, fallback body, code block). Mirrors
  // rendering contract — bodies use `parentId = state.id`.
  if (parentType === "State") {
    return (
      childType === "StateBody" ||
      childType === "StateFallbackBody" ||
      childType === "StateCodeBlock"
    )
  }

  // AgentDiagram intent parents its body / description
  // / object-component children. AgentState is intentionally absent —
  // Inlined those bodies onto `AgentState.data.bodies`.
  if (parentType === "AgentIntent") {
    return (
      childType === "AgentIntentBody" ||
      childType === "AgentIntentDescription" ||
      childType === "AgentIntentObjectComponent"
    )
  }

  // AgentState is no longer advertised by
  // `isParentNodeType` (its bodies are inlined on `data.bodies`), so we
  // shouldn't reach this branch from the drop handler. We keep the guard
  // defensively so any other call site that still passes "AgentState"
  // for parentType gets a clean rejection rather than the permissive
  // fallthrough at the bottom of this function.
  if (parentType === "AgentState") {
    return false
  }

  // BPMN Pool constraints
  if (parentType === "bpmnPool") {
    // Pools can contain most BPMN elements including other pools
    return (
      childType === "bpmnTask" ||
      childType === "bpmnStartEvent" ||
      childType === "bpmnIntermediateEvent" ||
      childType === "bpmnEndEvent" ||
      childType === "bpmnGateway" ||
      childType === "bpmnSubprocess" ||
      childType === "bpmnTransaction" ||
      childType === "bpmnCallActivity" ||
      childType === "bpmnDataObject" ||
      childType === "bpmnDataStore" ||
      childType === "bpmnAnnotation" ||
      childType === "bpmnGroup" ||
      childType === "bpmnSwimlane" ||
      childType === "bpmnPool"
    )
  }

  // BPMN Group constraints
  if (parentType === "bpmnGroup") {
    // Groups can contain any BPMN elements
    return childType.startsWith("bpmn")
  }

  // BPMN Swimlane constraints — a lane holds the same elements a
  // subprocess does (everything except pools and other lanes).
  if (parentType === "bpmnSwimlane") {
    return (
      childType === "bpmnTask" ||
      childType === "bpmnStartEvent" ||
      childType === "bpmnIntermediateEvent" ||
      childType === "bpmnEndEvent" ||
      childType === "bpmnGateway" ||
      childType === "bpmnSubprocess" ||
      childType === "bpmnTransaction" ||
      childType === "bpmnCallActivity" ||
      childType === "bpmnDataObject" ||
      childType === "bpmnDataStore" ||
      childType === "bpmnAnnotation" ||
      childType === "bpmnGroup"
    )
  }

  // BPMN Subprocess constraints
  if (
    parentType === "bpmnSubprocess" ||
    parentType === "bpmnTransaction" ||
    parentType === "bpmnCallActivity"
  ) {
    // Subprocesses can contain most BPMN elements except pools
    return (
      childType === "bpmnTask" ||
      childType === "bpmnStartEvent" ||
      childType === "bpmnIntermediateEvent" ||
      childType === "bpmnEndEvent" ||
      childType === "bpmnGateway" ||
      childType === "bpmnSubprocess" ||
      childType === "bpmnTransaction" ||
      childType === "bpmnCallActivity" ||
      childType === "bpmnDataObject" ||
      childType === "bpmnDataStore" ||
      childType === "bpmnAnnotation" ||
      childType === "bpmnGroup"
    )
  }

  // For non-BPMN parent types, use existing logic
  // Package can contain classes and other packages
  if (parentType === "package") {
    return childType === "class" || childType === "package"
  }

  // Activity can contain activity nodes
  if (parentType === "activity") {
    return childType.startsWith("activity")
  }

  // Use Case System can contain use cases and actors
  if (parentType === "useCaseSystem") {
    return childType === "useCase" || childType === "useCaseActor"
  }

  // Component Subsystem can contain components and interfaces
  if (parentType === "componentSubsystem") {
    return (
      childType === "component" ||
      childType === "componentInterface" ||
      childType === "componentSubsystem"
    )
  }

  // Deployment Node can contain deployment components and other nodes
  if (parentType === "deploymentNode") {
    return (
      childType === "deploymentComponent" ||
      childType === "deploymentArtifact" ||
      childType === "deploymentInterface" ||
      childType === "deploymentNode"
    )
  }

  // Deployment Component can contain artifacts and interfaces
  if (parentType === "deploymentComponent") {
    return (
      childType === "deploymentArtifact" || childType === "deploymentInterface"
    )
  }

  // Default: allow dropping
  return true
}

/** The two BPMN node types that can be collapsed/expanded via `data.isExpanded`. */
const COLLAPSIBLE_BPMN_TYPES = new Set(["bpmnSubprocess", "bpmnTransaction"])

/**
 * Minimal node shape for computing collapse visibility — kept independent of
 * `BesserNode` (and thus React Flow) for the same reason as
 * `MinimalNodeForConnect` above.
 */
export interface MinimalNodeForCollapse {
  id: string
  type?: string
  parentId?: string
  hidden?: boolean
  data?: { isExpanded?: boolean } | null
}

/**
 * Mirrors the old editor's `bpmn-subprocess.ts` / `bpmn-transaction.ts`
 * `render()`: when `data.isExpanded` is `false`, a Subprocess/Transaction
 * renders only itself — none of its descendants. React Flow has no
 * container-collapse primitive of its own, so this derives each node's
 * `hidden` flag from whether ANY ancestor (walking the `parentId` chain) is
 * a collapsed Subprocess/Transaction. React Flow auto-hides edges with a
 * hidden endpoint, so hiding descendant nodes is sufficient — no edge-level
 * bookkeeping needed.
 *
 * Pure and allocation-light: returns the same node object (not a copy)
 * whenever its `hidden` value doesn't change, so callers that feed this
 * straight into React Flow's `nodes` prop don't cause spurious re-renders
 * of unrelated nodes.
 */
export const applyBpmnCollapseVisibility = <T extends MinimalNodeForCollapse>(
  nodes: T[]
): T[] => {
  if (nodes.length === 0) return nodes

  const byId = new Map<string, T>()
  for (const n of nodes) byId.set(n.id, n)

  const hiddenCache = new Map<string, boolean>()
  const isHidden = (node: T): boolean => {
    const cached = hiddenCache.get(node.id)
    if (cached !== undefined) return cached
    // Cycle guard: parentId chains are tree-shaped in practice, but a
    // corrupt/legacy model could loop — bail to "not hidden" if we ever
    // revisit a node while resolving it.
    hiddenCache.set(node.id, false)

    let result = false
    if (node.parentId) {
      const parent = byId.get(node.parentId)
      if (parent) {
        const parentCollapsed =
          !!parent.type &&
          COLLAPSIBLE_BPMN_TYPES.has(parent.type) &&
          parent.data?.isExpanded === false
        result = parentCollapsed || isHidden(parent)
      }
    }
    hiddenCache.set(node.id, result)
    return result
  }

  let changed = false
  const result = nodes.map((node) => {
    const hidden = isHidden(node)
    if (hidden === !!node.hidden) return node
    changed = true
    return { ...node, hidden }
  })
  return changed ? result : nodes
}
