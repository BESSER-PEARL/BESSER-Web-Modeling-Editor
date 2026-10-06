import {
  type Edge,
  type Node,
  Connection,
  useReactFlow,
  OnConnectEnd,
  OnConnectStart,
  OnConnectStartParams,
  OnEdgesDelete,
  IsValidConnection,
} from "@xyflow/react"
import { useCallback, useRef } from "react"
import {
  applyOclContextAutofill,
  findClosestHandle,
  generateUUID,
  getDefaultEdgeType,
  getInitialEdgeData,
  normalizeNNCompositionEndpoints,
  resolveAgentEdgeType,
  resolveBpmnEdgeType,
  resolveCommentEdgeType,
  resolveNNEdgeType,
} from "@/utils"
import { canConnectEndpoints } from "@/utils/bpmnConstraints"
import { DiagramEdgeType } from "@/typings"
import { DiagramNodeTypeRecord } from "@/nodes"
import { useDiagramStore, useMetadataStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { FLOATING_PORT_DIAGRAMS } from "@/utils/floatingEdges"
import { facingHandleIds } from "@/utils/edgePorts"
import { setConnectStart } from "@/edges/FloatingConnectionLine"

/**
 * Edge-type predicate. When the user drops a connection
 * between an OCL constraint node and any other node, auto-pick
 * `ClassOCLLink` (only meaningful for that endpoint pair). Otherwise
 * fall back to the diagram default. Mirrors v3's
 * `ClassOCLConstraint.supportedRelationships = [ClassOCLLink]`.
 */
const resolveClassEdgeType = (
  sourceType: string | undefined,
  targetType: string | undefined,
  defaultType: DiagramEdgeType
): DiagramEdgeType => {
  const isOcl = (t?: string) => t === "ClassOCLConstraint"
  const isClassEnd = (t?: string) =>
    t === "class" || t === "Enumeration" || t === "AbstractClass"
  const sourceIsOcl = isOcl(sourceType)
  const targetIsOcl = isOcl(targetType)
  // Only flip to ClassOCLLink when exactly one endpoint is OCL and the
  // other endpoint is a class. OCL→OCL and OCL→non-class connections
  // would otherwise silently flip and produce semantically meaningless
  // links (finding #3).
  if (sourceIsOcl !== targetIsOcl) {
    const otherType = sourceIsOcl ? targetType : sourceType
    if (isClassEnd(otherType)) return "ClassOCLLink"
  }
  return defaultType
}

/**
 * Thin React Flow adapter over the pure
 * `canConnectEndpoints` predicate (in `@/utils/bpmnConstraints`).
 * Keeping the rule in a zero-dependency file lets the regression test
 * import it without dragging React Flow / zustand into the test
 * graph. `edges` feeds the topology-aware rules (NN Configuration
 * singleton in `services/connectionRules/nnDiagramRules`).
 */
const isConnectionAllowed = (
  nodes: Node[],
  edges: Edge[],
  source: string | null | undefined,
  target: string | null | undefined
): boolean => canConnectEndpoints(nodes, source, target, (n) => n.id, edges)

export const useConnect = () => {
  const connectionStartParams = useRef<OnConnectStartParams | null>(null)
  /** Whether the pointer left the source node during the current drag. */
  const leftSourceRef = useRef(false)
  const stopTrackingRef = useRef<(() => void) | null>(null)
  const { screenToFlowPosition, getIntersectingNodes, getInternalNode } =
    useReactFlow()
  const { setEdges, addEdge, edges, nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      setEdges: state.setEdges,
      addEdge: state.addEdge,
      edges: state.edges,
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )

  const diagramType = useMetadataStore(useShallow((state) => state.diagramType))

  const defaultEdgeType = getDefaultEdgeType(diagramType)
  const floatingPorts = FLOATING_PORT_DIAGRAMS.has(diagramType)

  /** Absolute rect of a rendered node. */
  const rectOf = useCallback(
    (id: string) => {
      const n = getInternalNode(id)
      if (!n) return undefined
      return {
        x: n.internals.positionAbsolute.x,
        y: n.internals.positionAbsolute.y,
        width: n.measured.width ?? n.width ?? 0,
        height: n.measured.height ?? n.height ?? 0,
      }
    },
    [getInternalNode]
  )

  /**
   * Continuous ports: the stored handle ids are the facing sides (valid ids
   * every node renders); where the ends attach is computed at render time.
   */
  const facingHandles = useCallback(
    (sourceId: string, targetId: string) => {
      const s = rectOf(sourceId)
      const t = rectOf(targetId)
      if (!s || !t) return { sourceHandle: "right", targetHandle: "left" }
      return sourceId === targetId
        ? facingHandleIds(s, s)
        : facingHandleIds(s, t)
    },
    [rectOf]
  )

  const isFourHandleNode = useCallback(
    (nodeType?: string) =>
      nodeType === DiagramNodeTypeRecord.componentInterface ||
      nodeType === DiagramNodeTypeRecord.petriNetPlace ||
      nodeType === DiagramNodeTypeRecord.petriNetTransition ||
      nodeType === DiagramNodeTypeRecord.sfcTransitionBranch,
    []
  )
  const getDropPosition = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const { clientX, clientY } =
        "changedTouches" in event ? event.changedTouches[0] : event
      return screenToFlowPosition(
        { x: clientX, y: clientY },
        { snapToGrid: false }
      )
    },
    [screenToFlowPosition]
  )

  // Dragging from a handle always creates a NEW edge. (It used to grab an
  // existing edge on that handle and move it — reconnecting is done from a
  // selected edge's endpoint instead.)
  const onConnectStart: OnConnectStart = (_event, params) => {
    connectionStartParams.current = params
    leftSourceRef.current = false
    stopTrackingRef.current?.()
    const sourceRect = params.nodeId ? rectOf(params.nodeId) : undefined
    if (!sourceRect) return
    // A self-loop needs the pointer to leave the node and come back, so a
    // click or tiny drag on a port never creates one by accident.
    const onMove = (e: PointerEvent) => {
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const pad = 12
      if (
        p.x < sourceRect.x - pad ||
        p.y < sourceRect.y - pad ||
        p.x > sourceRect.x + sourceRect.width + pad ||
        p.y > sourceRect.y + sourceRect.height + pad
      ) {
        leftSourceRef.current = true
      }
    }
    document.addEventListener("pointermove", onMove, true)
    stopTrackingRef.current = () =>
      document.removeEventListener("pointermove", onMove, true)
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      // Defensive guard — even though React
      // Flow runs `isValidConnection` first, callers may invoke
      // `onConnect` directly (programmatic edge creation). Reject any
      // connection touching an Enumeration class node.
      if (
        !isConnectionAllowed(nodes, edges, connection.source, connection.target)
      ) {
        return
      }
      // Comment tethering first, then per-diagram auto-detect.
      // Comments sit in EVERY diagram's palette, so the comment check
      // runs before the per-diagram switch (StateMachine / Agent /
      // Object / User / … included, not just ClassDiagram) — and a
      // comment endpoint can never be an OCL / association-class
      // endpoint, so the ordering is unambiguous. Uniform rule: any
      // non-Enumeration node can be tethered (see
      // `resolveCommentEdgeType` for the develop-parity rationale);
      // Enumerations stay blocked upstream by `isValidConnection`.
      //
      // ClassDiagram auto-detect: if either endpoint
      // is an OCL constraint node, force `ClassOCLLink`; otherwise use
      // the diagram default edge type. NNDiagram auto-detect:
      // Configuration ↔ NNContainer is a composition, Dataset ↔
      // NNContainer is an association; everything else uses NNNext.
      // AgentDiagram auto-detect: initial node ↔ AgentState is the
      // `AgentStateTransitionInit` marker edge.
      if (
        floatingPorts &&
        connection.source === connection.target &&
        !leftSourceRef.current
      ) {
        return
      }
      if (floatingPorts) {
        connection = {
          ...connection,
          ...facingHandles(connection.source, connection.target),
        }
      }
      const sourceType = nodes.find((n) => n.id === connection.source)?.type
      const targetType = nodes.find((n) => n.id === connection.target)?.type
      const commentEdgeType = resolveCommentEdgeType(sourceType, targetType)
      let resolvedType: typeof defaultEdgeType
      if (commentEdgeType) {
        resolvedType = commentEdgeType
      } else if (diagramType === "ClassDiagram") {
        resolvedType = resolveClassEdgeType(
          sourceType,
          targetType,
          defaultEdgeType
        )
      } else if (diagramType === "NNDiagram") {
        resolvedType = resolveNNEdgeType(
          sourceType,
          targetType,
          defaultEdgeType
        )
      } else if (diagramType === "AgentDiagram") {
        resolvedType = resolveAgentEdgeType(
          sourceType,
          targetType,
          defaultEdgeType
        )
      } else if (diagramType === "BPMNDiagram") {
        resolvedType = resolveBpmnEdgeType(
          sourceType,
          targetType,
          defaultEdgeType
        )
      } else {
        resolvedType = defaultEdgeType
      }
      const initialData = getInitialEdgeData(resolvedType)
      // NNComposition endpoint normalization — the NNContainer always
      // lands at the target end so the rhombus (markerEnd) sits on the
      // container, replacing develop's render-time path reversal.
      const normalizedConnection =
        resolvedType === "NNComposition"
          ? normalizeNNCompositionEndpoints(connection, sourceType, targetType)
          : connection
      const newEdge: Edge = {
        ...normalizedConnection,
        id: generateUUID(),
        type: resolvedType,
        selected: false,
        ...(initialData ? { data: initialData } : {}),
      }

      addEdge(newEdge)

      // OCL context auto-fill (v3 parity): linking a
      // constraint to a class rewrites the constraint's context clause
      // to reference the connected class.
      if (resolvedType === "ClassOCLLink") {
        setNodes(
          (all) =>
            applyOclContextAutofill(
              all,
              connection.source,
              connection.target
            ) ?? all
        )
      }
    },
    [
      addEdge,
      defaultEdgeType,
      diagramType,
      nodes,
      setNodes,
      edges,
      floatingPorts,
      facingHandles,
    ]
  )

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      stopTrackingRef.current?.()
      stopTrackingRef.current = null
      setConnectStart(null)
      if (!connectionState.isValid) {
        const dropPosition = getDropPosition(event)
        const intersectingNodes = getIntersectingNodes({
          x: dropPosition.x - 5,
          y: dropPosition.y - 5,
          width: 10,
          height: 10,
        })

        if (intersectingNodes.length === 0) return

        const fromNodeId = connectionState.fromNode?.id
        const nodeOnTop =
          intersectingNodes.findLast((node) => node.id !== fromNodeId) ??
          intersectingNodes[intersectingNodes.length - 1]

        const internalNodeData = getInternalNode(nodeOnTop.id)

        if (
          !internalNodeData ||
          nodeOnTop.width == null ||
          nodeOnTop.height == null
        )
          return

        const sourceNodeId = connectionState.fromNode!.id
        // Continuous ports: the end goes on the side facing the source, no
        // matter where on the target it was dropped.
        const floatingHandles = floatingPorts
          ? facingHandles(sourceNodeId, nodeOnTop.id)
          : null
        const targetHandle =
          floatingHandles?.targetHandle ??
          findClosestHandle({
            point: dropPosition,
            rect: {
              x: internalNodeData.internals.positionAbsolute.x,
              y: internalNodeData.internals.positionAbsolute.y,
              width: nodeOnTop.width,
              height: nodeOnTop.height,
            },
            useFourHandles: isFourHandleNode(nodeOnTop.type),
          })

        if (!targetHandle) return

        if (floatingPorts && sourceNodeId === nodeOnTop.id && !leftSourceRef.current) {
          connectionStartParams.current = null
          return
        }

        {
          const sourceHandleId =
            floatingHandles?.sourceHandle ?? connectionState.fromHandle?.id

          // Disallow loop from a handle to itself, but allow loops to other handles.
          if (
            sourceNodeId === nodeOnTop.id &&
            sourceHandleId === targetHandle
          ) {
            connectionStartParams.current = null
            return
          }

          // Refuse to create a new edge whose
          // source or target is an Enumeration class node.
          if (!isConnectionAllowed(nodes, edges, sourceNodeId, nodeOnTop.id)) {
            connectionStartParams.current = null
            return
          }

          // Same auto-detect logic as `onConnect` —
          // comment tethering first (diagram-agnostic), then the
          // per-diagram switch.
          const sourceTypeOnEnd = nodes.find((n) => n.id === sourceNodeId)?.type
          const targetTypeOnEnd = nodeOnTop.type
          const commentEdgeTypeOnEnd = resolveCommentEdgeType(
            sourceTypeOnEnd,
            targetTypeOnEnd
          )
          let resolvedTypeOnEnd: typeof defaultEdgeType
          if (commentEdgeTypeOnEnd) {
            resolvedTypeOnEnd = commentEdgeTypeOnEnd
          } else if (diagramType === "ClassDiagram") {
            resolvedTypeOnEnd = resolveClassEdgeType(
              sourceTypeOnEnd,
              targetTypeOnEnd,
              defaultEdgeType
            )
          } else if (diagramType === "NNDiagram") {
            resolvedTypeOnEnd = resolveNNEdgeType(
              sourceTypeOnEnd,
              targetTypeOnEnd,
              defaultEdgeType
            )
          } else if (diagramType === "AgentDiagram") {
            resolvedTypeOnEnd = resolveAgentEdgeType(
              sourceTypeOnEnd,
              targetTypeOnEnd,
              defaultEdgeType
            )
          } else if (diagramType === "BPMNDiagram") {
            resolvedTypeOnEnd = resolveBpmnEdgeType(
              sourceTypeOnEnd,
              targetTypeOnEnd,
              defaultEdgeType
            )
          } else {
            resolvedTypeOnEnd = defaultEdgeType
          }
          const initialDataOnEnd = getInitialEdgeData(resolvedTypeOnEnd)
          // Same NNComposition endpoint normalization as `onConnect`.
          const endpointsOnEnd =
            resolvedTypeOnEnd === "NNComposition"
              ? normalizeNNCompositionEndpoints(
                  {
                    source: sourceNodeId,
                    target: nodeOnTop.id,
                    sourceHandle: sourceHandleId,
                    targetHandle,
                  },
                  sourceTypeOnEnd,
                  targetTypeOnEnd
                )
              : {
                  source: sourceNodeId,
                  target: nodeOnTop.id,
                  sourceHandle: sourceHandleId,
                  targetHandle,
                }
          setEdges((eds) =>
            eds.concat({
              id: generateUUID(),
              ...endpointsOnEnd,
              type: resolvedTypeOnEnd,
              ...(initialDataOnEnd ? { data: initialDataOnEnd } : {}),
            })
          )

          // Same OCL context auto-fill as `onConnect`.
          if (resolvedTypeOnEnd === "ClassOCLLink") {
            setNodes(
              (all) =>
                applyOclContextAutofill(all, sourceNodeId, nodeOnTop.id) ?? all
            )
          }
        }
      }
      connectionStartParams.current = null
    },
    [
      defaultEdgeType,
      diagramType,
      edges,
      floatingPorts,
      facingHandles,
      getDropPosition,
      getInternalNode,
      getIntersectingNodes,
      isFourHandleNode,
      nodes,
      setEdges,
      setNodes,
    ]
  )

  const onEdgesDelete: OnEdgesDelete = useCallback(() => {
    connectionStartParams.current = null
  }, [])

  /**
   * React Flow consults this *before* firing
   * `onConnect`. Returning `false` aborts the drag so the user gets the
   * "invalid" cursor. Enumeration class nodes never participate in
   * edges — they're referenced by attribute type instead.
   */
  const isValidConnection: IsValidConnection = useCallback(
    (connection) =>
      isConnectionAllowed(nodes, edges, connection.source, connection.target),
    [nodes, edges]
  )

  return {
    onConnect,
    onConnectEnd,
    onConnectStart,
    onEdgesDelete,
    isValidConnection,
  }
}
