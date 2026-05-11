/**
 * Predicate over the minimal node shape we
 * care about (`type` + `data.stereotype`). Lives in
 * `bpmnConstraints.ts` alongside `canDropIntoParent` because both are
 * zero-dependency boolean rules consumed by event handlers — keeping
 * them together avoids dragging React Flow types into the import
 * graph of pure-helper tests.
 */
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
    (n as { id?: string }).id
): boolean => {
  const sourceNode = nodes.find((n) => getId(n) === source)
  const targetNode = nodes.find((n) => getId(n) === target)
  if (isEnumerationClassNode(sourceNode)) return false
  if (isEnumerationClassNode(targetNode)) return false
  return true
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
      childType === "bpmnPool"
    )
  }

  // BPMN Group constraints
  if (parentType === "bpmnGroup") {
    // Groups can contain any BPMN elements
    return childType.startsWith("bpmn")
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
