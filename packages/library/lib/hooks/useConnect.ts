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
  findClosestHandle,
  generateUUID,
  getDefaultEdgeType,
  resolveNNEdgeType,
} from "@/utils"
import { canConnectEndpoints } from "@/utils/bpmnConstraints"
import { DiagramNodeTypeRecord } from "@/nodes"
import { useDiagramStore, useMetadataStore } from "@/store/context"
import { useShallow } from "zustand/shallow"

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
  defaultType: string
): string => {
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
 * graph.
 */
const isConnectionAllowed = (
  nodes: Node[],
  source: string | null | undefined,
  target: string | null | undefined
): boolean => canConnectEndpoints(nodes, source, target, (n) => n.id)

export const useConnect = () => {
  const startEdge = useRef<Edge | null>(null)
  const connectionStartParams = useRef<OnConnectStartParams | null>(null)
  const { screenToFlowPosition, getIntersectingNodes, getInternalNode } =
    useReactFlow()
  const { setEdges, addEdge, edges, nodes } = useDiagramStore(
    useShallow((state) => ({
      setEdges: state.setEdges,
      addEdge: state.addEdge,
      edges: state.edges,
      nodes: state.nodes,
    }))
  )

  const diagramType = useMetadataStore(useShallow((state) => state.diagramType))

  const defaultEdgeType = getDefaultEdgeType(diagramType)

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

  const onConnectStart: OnConnectStart = (event, params) => {
    connectionStartParams.current = params
    startEdge.current = null
    const dropPosition = getDropPosition(event)

    const intersectingNodes = getIntersectingNodes({
      x: dropPosition.x - 60,
      y: dropPosition.y - 60,
      width: 120,
      height: 120,
    })
    const intersectingNodesIds = intersectingNodes.map((node) => node.id)

    const existingEdges = [
      ...edges.filter(
        (edge) =>
          edge.source === params.nodeId &&
          edge.sourceHandle === params.handleId &&
          intersectingNodesIds.includes(edge.target)
      ),
      ...edges.filter(
        (edge) =>
          edge.target === params.nodeId &&
          edge.targetHandle === params.handleId &&
          intersectingNodesIds.includes(edge.source)
      ),
    ]

    if (existingEdges.length > 0) {
      startEdge.current = existingEdges[existingEdges.length - 1]
    }
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      // Defensive guard — even though React
      // Flow runs `isValidConnection` first, callers may invoke
      // `onConnect` directly (programmatic edge creation). Reject any
      // connection touching an Enumeration class node.
      if (!isConnectionAllowed(nodes, connection.source, connection.target)) {
        return
      }
      // ClassDiagram-only auto-detect: if either endpoint
      // is an OCL constraint node, force `ClassOCLLink`; otherwise use
      // the diagram default edge type. NNDiagram auto-detect:
      // Configuration ↔ NNContainer is a composition, Dataset ↔
      // NNContainer is an association; everything else uses NNNext.
      const sourceType = nodes.find((n) => n.id === connection.source)?.type
      const targetType = nodes.find((n) => n.id === connection.target)?.type
      let resolvedType: typeof defaultEdgeType
      if (diagramType === "ClassDiagram") {
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
      } else {
        resolvedType = defaultEdgeType
      }
      const newEdge: Edge = {
        ...connection,
        id: generateUUID(),
        type: resolvedType,
        selected: false,
      }

      addEdge(newEdge)
    },
    [addEdge, defaultEdgeType, diagramType, nodes]
  )

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
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

        const targetHandle = findClosestHandle({
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

        if (startEdge.current) {
          const updatedEdge = edges.find(
            (edge) => edge.id === startEdge.current?.id
          )

          if (!updatedEdge) return
          const newEdge =
            connectionStartParams.current?.handleType === "source"
              ? { ...updatedEdge, target: nodeOnTop.id, targetHandle }
              : {
                  ...updatedEdge,
                  source: nodeOnTop.id,
                  sourceHandle: targetHandle,
                }

          // Disallow loop from a handle to the same handle on the same node.
          if (
            newEdge.source === newEdge.target &&
            newEdge.sourceHandle === newEdge.targetHandle
          ) {
            startEdge.current = null
            connectionStartParams.current = null
            return
          }

          // Refuse to reroute an existing edge
          // onto / off of an Enumeration class node.
          if (!isConnectionAllowed(nodes, newEdge.source, newEdge.target)) {
            startEdge.current = null
            connectionStartParams.current = null
            return
          }

          setEdges((eds) =>
            eds.map((edge) => (edge.id === newEdge.id ? newEdge : edge))
          )
        } else {
          const sourceNodeId = connectionState.fromNode!.id
          const sourceHandleId = connectionState.fromHandle?.id

          // Disallow loop from a handle to itself, but allow loops to other handles.
          if (
            sourceNodeId === nodeOnTop.id &&
            sourceHandleId === targetHandle
          ) {
            startEdge.current = null
            connectionStartParams.current = null
            return
          }

          // Refuse to create a new edge whose
          // source or target is an Enumeration class node.
          if (!isConnectionAllowed(nodes, sourceNodeId, nodeOnTop.id)) {
            startEdge.current = null
            connectionStartParams.current = null
            return
          }

          // Same auto-detect logic as `onConnect`.
          const sourceTypeOnEnd = nodes.find((n) => n.id === sourceNodeId)?.type
          const targetTypeOnEnd = nodeOnTop.type
          let resolvedTypeOnEnd: typeof defaultEdgeType
          if (diagramType === "ClassDiagram") {
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
          } else {
            resolvedTypeOnEnd = defaultEdgeType
          }
          setEdges((eds) =>
            eds.concat({
              id: generateUUID(),
              source: sourceNodeId,
              target: nodeOnTop.id,
              type: resolvedTypeOnEnd,
              sourceHandle: sourceHandleId,
              targetHandle,
            })
          )
        }
      }
      startEdge.current = null
      connectionStartParams.current = null
    },
    [
      defaultEdgeType,
      diagramType,
      edges,
      getDropPosition,
      getInternalNode,
      getIntersectingNodes,
      isFourHandleNode,
      nodes,
      setEdges,
    ]
  )

  const onEdgesDelete: OnEdgesDelete = useCallback(() => {
    startEdge.current = null
    connectionStartParams.current = null
  }, [setEdges])

  /**
   * React Flow consults this *before* firing
   * `onConnect`. Returning `false` aborts the drag so the user gets the
   * "invalid" cursor. Enumeration class nodes never participate in
   * edges — they're referenced by attribute type instead.
   */
  const isValidConnection: IsValidConnection = useCallback(
    (connection) =>
      isConnectionAllowed(nodes, connection.source, connection.target),
    [nodes]
  )

  return {
    onConnect,
    onConnectEnd,
    onConnectStart,
    onEdgesDelete,
    isValidConnection,
  }
}
