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

/**
 * Last copied / cut payload. Paste falls back to it when the system
 * clipboard can't be read (no permission, insecure context), so copy and
 * paste inside the editor never depend on clipboard-read access.
 */
let copiedPayload: ClipboardData | null = null

const isClipboardData = (value: unknown): value is ClipboardData =>
  !!value &&
  Array.isArray((value as ClipboardData).nodes) &&
  Array.isArray((value as ClipboardData).edges)

const canUseClipboard = () => !!navigator.clipboard && window.isSecureContext

const clipboardReadPermission = async (): Promise<PermissionState | null> => {
  try {
    const status = await navigator.permissions?.query({
      name: "clipboard-read" as PermissionName,
    })
    return status?.state ?? null
  } catch {
    return null
  }
}

/** Puts `data` in the in-memory copy and, best effort, on the clipboard. */
const storeCopy = async (data: ClipboardData): Promise<boolean> => {
  copiedPayload = data
  if (!canUseClipboard()) return true
  try {
    await navigator.clipboard.writeText(JSON.stringify(data))
  } catch (error) {
    log.error("Failed to copy to clipboard:", error as Error)
  }
  return true
}

/**
 * What a paste inserts: the clipboard when it holds a diagram payload (a copy
 * from another tab), else the in-memory copy. Without read permission the
 * clipboard is not asked at all, so no permission prompt interrupts a paste.
 */
const readPastePayload = async (): Promise<ClipboardData | null> => {
  if (!canUseClipboard()) return copiedPayload
  if (copiedPayload) {
    const permission = await clipboardReadPermission()
    if (permission === "denied" || permission === "prompt") return copiedPayload
  }
  try {
    const parsed: unknown = JSON.parse(await navigator.clipboard.readText())
    if (isClipboardData(parsed)) return parsed
  } catch {
    // Not readable or not a diagram payload.
  }
  return copiedPayload
}

export const useSelectionForCopyPaste = () => {
  const { selectedElementIds, setSelectedElementsId, setNodes, setEdges } =
    useDiagramStore(
      useShallow((state) => ({
        selectedElementIds: state.selectedElementIds,
        setSelectedElementsId: state.setSelectedElementsId,
        setNodes: state.setNodes,
        setEdges: state.setEdges,
      }))
    )
  // Live state in the callbacks keeps them stable across drag frames.
  const storeApi = useDiagramStoreApi()

  const hasSelectedElements = useCallback(
    () => storeApi.getState().selectedElementIds.length > 0,
    [storeApi]
  )

  const selectAll = useCallback(() => {
    const { nodes, edges } = storeApi.getState()
    setSelectedElementsId([
      ...nodes.map((node) => node.id),
      ...edges.map((edge) => edge.id),
    ])
    setNodes(nodes.map((node) => ({ ...node, selected: true })))
    setEdges(edges.map((edge) => ({ ...edge, selected: true })))
  }, [storeApi, setSelectedElementsId, setNodes, setEdges])

  const clearSelection = useCallback(() => {
    const { nodes, edges } = storeApi.getState()
    setSelectedElementsId([])
    setNodes(nodes.map((node) => ({ ...node, selected: false })))
    setEdges(edges.map((edge) => ({ ...edge, selected: false })))
  }, [storeApi, setSelectedElementsId, setNodes, setEdges])

  /** The current selection as a clipboard payload (null when empty). */
  const selectionPayload = useCallback((): ClipboardData | null => {
    const { selectedElementIds: ids, nodes, edges } = storeApi.getState()
    return ids.length > 0 ? createClipboardData(ids, nodes, edges) : null
  }, [storeApi])

  const copySelectedElements = useCallback(async () => {
    const data = selectionPayload()
    return data ? storeCopy(data) : false
  }, [selectionPayload])

  /**
   * Pastes `payload`, or the clipboard / last copy without it. With `anchor`
   * (flow coordinates) the copies are centred there, cascading 20 px per
   * repeated paste; without it they land 20 px per paste down-right of the
   * originals (duplicate).
   */
  const pasteElements = useCallback(
    async (
      pasteCount: number = 1,
      anchor?: XYPosition,
      payload?: ClipboardData
    ) => {
      try {
        const clipboardData = payload ?? (await readPastePayload())
        if (!isClipboardData(clipboardData)) return false

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

  /** Ctrl+D: pastes a copy of the selection without touching the clipboard. */
  const duplicateSelectedElements = useCallback(
    async (pasteCount: number = 1) => {
      const data = selectionPayload()
      return data ? pasteElements(pasteCount, undefined, data) : false
    },
    [selectionPayload, pasteElements]
  )

  const deleteSelectedElements = useCallback(() => {
    const { selectedElementIds: ids, nodes, edges } = storeApi.getState()
    if (ids.length === 0) {
      return false
    }

    const allNodesToDelete = getAllNodesToInclude(ids, nodes)
    const expandedNodeIds = allNodesToDelete.map((node) => node.id)
    const edgeIdsToRemove = getEdgesToRemove(ids, expandedNodeIds, edges)

    const remainingNodes = nodes.filter(
      (node) => !expandedNodeIds.includes(node.id)
    )
    const remainingEdges = edges.filter((edge) => !edgeIdsToRemove.has(edge.id))

    setNodes(remainingNodes)
    setEdges(remainingEdges)
    setSelectedElementsId([])

    return true
  }, [storeApi, setNodes, setEdges, setSelectedElementsId])

  const cutSelectedElements = useCallback(async () => {
    const data = selectionPayload()
    if (!data) return false
    void storeCopy(data)
    return deleteSelectedElements()
  }, [selectionPayload, deleteSelectedElements])

  return {
    selectedElementIds,
    hasSelectedElements,
    selectAll,
    clearSelection,
    copySelectedElements,
    pasteElements,
    duplicateSelectedElements,
    cutSelectedElements,
    deleteSelectedElements,
  }
}
