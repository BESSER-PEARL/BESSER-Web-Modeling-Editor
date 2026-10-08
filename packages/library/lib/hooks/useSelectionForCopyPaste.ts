import { useCallback } from "react"
import type { XYPosition } from "@xyflow/react"
import { useDiagramStore, useDiagramStoreApi } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { sortNodesTopologically } from "@/utils"
import { log } from "../logger"
import {
  ClipboardData,
  createClipboardData,
  getAllNodesToInclude,
  getEdgesToRemove,
  materializeClipboardData,
} from "@/utils/copyPasteUtils"
import { centerPastedOn, withUniqueCopyNames } from "@/utils/elementNaming"
import { CANVAS } from "@/constants"

export const useSelectionForCopyPaste = () => {
  const {
    nodes,
    edges,
    selectedElementIds,
    setSelectedElementsId,
    setNodes,
    setEdges,
  } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      selectedElementIds: state.selectedElementIds,
      setSelectedElementsId: state.setSelectedElementsId,
      setNodes: state.setNodes,
      setEdges: state.setEdges,
    }))
  )
  const storeApi = useDiagramStoreApi()

  const hasSelectedElements = useCallback(() => {
    return selectedElementIds.length > 0
  }, [selectedElementIds])

  const selectAll = useCallback(() => {
    const allElementIds = [
      ...nodes.map((node) => node.id),
      ...edges.map((edge) => edge.id),
    ]

    setSelectedElementsId(allElementIds)
    setNodes(nodes.map((node) => ({ ...node, selected: true })))
    setEdges(edges.map((edge) => ({ ...edge, selected: true })))
  }, [nodes, edges, setSelectedElementsId, setNodes, setEdges])

  const clearSelection = useCallback(() => {
    setSelectedElementsId([])
    setNodes(nodes.map((node) => ({ ...node, selected: false })))
    setEdges(edges.map((edge) => ({ ...edge, selected: false })))
  }, [nodes, edges, setSelectedElementsId, setNodes, setEdges])

  const copySelectedElements = useCallback(async () => {
    if (selectedElementIds.length === 0) {
      return false
    }

    const clipboardData = createClipboardData(selectedElementIds, nodes, edges)

    try {
      const jsonString = JSON.stringify(clipboardData)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(jsonString)
        return true
      }
    } catch (error) {
      log.error("Failed to copy to clipboard:", error as Error)
      return false
    }

    return false
  }, [selectedElementIds, nodes, edges])

  /**
   * Pastes the clipboard. With `anchor` (flow coordinates) the copies are
   * centred there, cascading 20 px per repeated paste; without it they land
   * 20 px per paste down-right of the originals (duplicate).
   */
  const pasteElements = useCallback(
    async (pasteCount: number = 1, anchor?: XYPosition) => {
      try {
        let text: string
        if (navigator.clipboard && window.isSecureContext) {
          text = await navigator.clipboard.readText()
        } else {
          return false
        }

        const clipboardData = JSON.parse(text) as ClipboardData

        if (
          !clipboardData ||
          !Array.isArray(clipboardData.nodes) ||
          !Array.isArray(clipboardData.edges)
        ) {
          return false
        }

        let materialized = materializeClipboardData(clipboardData, pasteCount)
        if (anchor) {
          const cascade = CANVAS.PASTE_OFFSET_PX * Math.max(0, pasteCount - 1)
          materialized = {
            ...materialized,
            ...centerPastedOn(materialized.nodes, materialized.edges, {
              x: anchor.x + cascade,
              y: anchor.y + cascade,
            }),
          }
        }

        // Live state, not the render closure: the clipboard read is async,
        // so a second paste in quick succession must append to the first
        // paste's result, not to the pre-paste diagram.
        const { nodes: currentNodes, edges: currentEdges } =
          storeApi.getState()

        // A lone child copied without its parent keeps its parentId; if
        // that parent is gone by now (cut + paste), drop the dangling
        // reference instead of handing React Flow a missing parent.
        const knownIds = new Set([
          ...currentNodes.map((node) => node.id),
          ...materialized.nodes.map((node) => node.id),
        ])
        const pastedNodes = withUniqueCopyNames(
          materialized.nodes.map((node) =>
            node.parentId && !knownIds.has(node.parentId)
              ? { ...node, parentId: undefined }
              : node
          ),
          currentNodes
        )

        const updatedExistingNodes = currentNodes.map((node) => ({
          ...node,
          selected: false,
        }))

        const updatedExistingEdges = currentEdges.map((edge) => ({
          ...edge,
          selected: false,
        }))

        const allUpdatedNodes = sortNodesTopologically([
          ...updatedExistingNodes,
          ...pastedNodes,
        ])
        const allUpdatedEdges = [
          ...updatedExistingEdges,
          ...materialized.edges,
        ]

        setNodes(allUpdatedNodes)
        setEdges(allUpdatedEdges)

        setSelectedElementsId(materialized.newElementIds)

        return true
      } catch (error) {
        log.error("Failed to paste from clipboard:", error as Error)
        return false
      }
    },
    [storeApi, setNodes, setEdges, setSelectedElementsId]
  )

  const cutSelectedElements = useCallback(async () => {
    if (selectedElementIds.length === 0) {
      return false
    }

    const clipboardData = createClipboardData(selectedElementIds, nodes, edges)

    try {
      const jsonString = JSON.stringify(clipboardData)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(jsonString)
      } else {
        return false
      }
    } catch (error) {
      log.error("Failed to copy to clipboard:", error as Error)
      return false
    }

    const allNodesToCut = getAllNodesToInclude(selectedElementIds, nodes)
    const expandedNodeIds = allNodesToCut.map((node) => node.id)
    const edgeIdsToRemove = getEdgesToRemove(
      selectedElementIds,
      expandedNodeIds,
      edges
    )

    const remainingNodes = nodes.filter(
      (node) => !expandedNodeIds.includes(node.id)
    )
    const remainingEdges = edges.filter((edge) => !edgeIdsToRemove.has(edge.id))

    setNodes(remainingNodes)
    setEdges(remainingEdges)
    setSelectedElementsId([])

    return true
  }, [
    selectedElementIds,
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectedElementsId,
  ])

  const deleteSelectedElements = useCallback(() => {
    if (selectedElementIds.length === 0) {
      return false
    }

    const allNodesToDelete = getAllNodesToInclude(selectedElementIds, nodes)
    const expandedNodeIds = allNodesToDelete.map((node) => node.id)
    const edgeIdsToRemove = getEdgesToRemove(
      selectedElementIds,
      expandedNodeIds,
      edges
    )

    const remainingNodes = nodes.filter(
      (node) => !expandedNodeIds.includes(node.id)
    )
    const remainingEdges = edges.filter((edge) => !edgeIdsToRemove.has(edge.id))

    setNodes(remainingNodes)
    setEdges(remainingEdges)
    setSelectedElementsId([])

    return true
  }, [
    selectedElementIds,
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectedElementsId,
  ])

  return {
    selectedElementIds,
    hasSelectedElements,
    selectAll,
    clearSelection,
    copySelectedElements,
    pasteElements,
    cutSelectedElements,
    deleteSelectedElements,
  }
}
