import { useCallback } from "react"
import { type OnNodeDrag, type Node, useReactFlow } from "@xyflow/react"
import {
  getPositionOnCanvas,
  isParentNodeType,
  resizeAllParents,
  sortNodesTopologically,
} from "@/utils"
import { canDropIntoParent, clampIntoLaneBody } from "@/utils/bpmnConstraints"
import { CANVAS } from "@/constants"
import { useDiagramStore, useAlignmentGuidesStore } from "@/store/context"
import { useShallow } from "zustand/shallow"

/** True when `nodeId` sits (transitively) inside `ancestorId`. */
const isDescendantOf = (
  nodeId: string,
  ancestorId: string,
  nodes: readonly Node[]
): boolean => {
  const seen = new Set<string>()
  let current = nodes.find((n) => n.id === nodeId)
  while (current?.parentId && !seen.has(current.id)) {
    if (current.parentId === ancestorId) return true
    seen.add(current.id)
    const parentId: string = current.parentId
    current = nodes.find((n) => n.id === parentId)
  }
  return false
}

export const useNodeDragStop = () => {
  const { screenToFlowPosition, getIntersectingNodes } = useReactFlow()
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )

  const { clearGuides } = useAlignmentGuidesStore(
    useShallow((state) => ({
      clearGuides: state.clearGuides,
    }))
  )

  const onNodeDragStop: OnNodeDrag<Node> = useCallback(
    (event, draggedNode) => {
      // Clear alignment guides when drag stops
      clearGuides()

      const draggedLastPoint = screenToFlowPosition({
        x:
          "changedTouches" in event
            ? // event is handled as Mouse event in the library but also it is touch event for mobile users
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (event as any).changedTouches[0].clientX
            : event.clientX,
        y:
          "changedTouches" in event
            ? // event is handled as Mouse event in the library but also it is touch event for mobile users
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (event as any).changedTouches[0].clientY
            : event.clientY,
      })

      const intersectionsWithDroppedLocation = getIntersectingNodes({
        x: draggedLastPoint.x,
        y: draggedLastPoint.y,
        width: CANVAS.MOUSE_UP_OFFSET_PX,
        height: CANVAS.MOUSE_UP_OFFSET_PX,
      }).filter((n) => {
        return (
          isParentNodeType(n.type) &&
          n.id !== draggedNode.id &&
          // A container dragged over its own content (a pool released over
          // one of its groups/subprocesses) must not become its descendant's
          // child — that would be a parentId cycle.
          !isDescendantOf(n.id, draggedNode.id, nodes) &&
          // Pools stay at the canvas root (old editor: appendAfterMove never
          // reparents an element into a container of its own type).
          !(draggedNode.type === "bpmnPool" && n.type === "bpmnPool") &&
          n.type &&
          draggedNode.type &&
          canDropIntoParent(draggedNode.type, n.type, n.data)
        )
      })

      const parentNode = intersectionsWithDroppedLocation.length
        ? intersectionsWithDroppedLocation[
            intersectionsWithDroppedLocation.length - 1
          ]
        : null

      if (!parentNode) {
        const updatedNode = nodes.map((n) =>
          n.id === draggedNode.id
            ? {
                ...draggedNode,
                position: getPositionOnCanvas(draggedNode, nodes),
                parentId: undefined,
              }
            : n
        )
        setNodes(updatedNode)
        return
      }

      const isThisNewParent =
        parentNode && parentNode?.id !== draggedNode.parentId

      if (isThisNewParent) {
        const updatedNode: Node = {
          ...structuredClone(draggedNode),
          position: getPositionOnCanvas(draggedNode, nodes),
          parentId: undefined,
        }
        const parentsFlowPosition = getPositionOnCanvas(parentNode, nodes)

        updatedNode.position.x -= parentsFlowPosition.x
        updatedNode.position.y -= parentsFlowPosition.y
        // Children of a BPMN lane stay out of its header strip.
        updatedNode.position = clampIntoLaneBody(
          updatedNode.position,
          parentNode.type
        )
        updatedNode.parentId = parentNode.id

        const updatedNodes = structuredClone(nodes)
        const updatedNodesList = sortNodesTopologically(
          resizeAllParents(
            updatedNode,
            updatedNodes.map((n) => (n.id === updatedNode.id ? updatedNode : n))
          )
        )

        setNodes(updatedNodesList)
        return
      }

      if (draggedNode.parentId) {
        const currentParentType = nodes.find(
          (n) => n.id === draggedNode.parentId
        )?.type
        const movedNode = {
          ...draggedNode,
          position: clampIntoLaneBody(draggedNode.position, currentParentType),
        }
        const updatedNodes = structuredClone(nodes)
        const updatedNodesList = sortNodesTopologically(
          resizeAllParents(
            movedNode,
            updatedNodes.map((n) =>
              n.id === draggedNode.id ? { ...movedNode } : n
            )
          )
        )
        setNodes(updatedNodesList)
      }
    },
    [screenToFlowPosition, nodes, getIntersectingNodes, setNodes, clearGuides]
  )

  return onNodeDragStop
}
