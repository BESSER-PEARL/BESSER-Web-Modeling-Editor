import {
  useAssessmentSelectionStore,
  useDiagramStore,
  useMetadataStore,
  usePopoverStore,
} from "@/store"
import { useShallow } from "zustand/shallow"
import { BesserMode } from "@/typings"
import { useCallback, useEffect } from "react"

export const usePaneClicked = () => {
  const { mode, readonly } = useMetadataStore(
    useShallow((state) => ({
      mode: state.mode,
      readonly: state.readonly,
    }))
  )
  const { nodes, edges, setSelectedElementsId, setNodes, setEdges } =
    useDiagramStore(
      useShallow((state) => ({
        nodes: state.nodes,
        edges: state.edges,
        selectedElementIds: state.selectedElementIds,
        setSelectedElementsId: state.setSelectedElementsId,
        setNodes: state.setNodes,
        setEdges: state.setEdges,
      }))
    )

  const {
    isAssessmentSelectionMode,
    setAssessmentSelectionMode,
    clearSelection,
  } = useAssessmentSelectionStore(
    useShallow((state) => ({
      isAssessmentSelectionMode: state.isAssessmentSelectionMode,
      setAssessmentSelectionMode: state.setAssessmentSelectionMode,
      clearSelection: state.clearSelection,
    }))
  )

  // Clicking empty canvas also closes the inspector (it only opens via
  // double-click or the edit button now).
  const setPopOverElementId = usePopoverStore(
    useShallow((state) => state.setPopOverElementId)
  )

  // Auto-enable assessment selection mode when in readonly assessment mode
  useEffect(() => {
    const shouldEnableAssessmentMode =
      mode === BesserMode.Assessment && readonly
    if (shouldEnableAssessmentMode !== isAssessmentSelectionMode) {
      setAssessmentSelectionMode(shouldEnableAssessmentMode)
    }
  }, [mode, readonly, isAssessmentSelectionMode, setAssessmentSelectionMode])

  const onPaneClicked = useCallback(() => {
    if (isAssessmentSelectionMode) {
      clearSelection()
    }
    setPopOverElementId(null)
    setSelectedElementsId([])
    const updatedExistingNodes = nodes.map((node) => ({
      ...node,
      selected: false,
      dragging: false,
    }))

    const updatedExistingEdges = edges.map((edge) => ({
      ...edge,
      selected: false,
      dragging: false,
    }))
    setNodes(updatedExistingNodes)
    setEdges(updatedExistingEdges)
  }, [
    isAssessmentSelectionMode,
    clearSelection,
    setPopOverElementId,
    setSelectedElementsId,
    nodes,
    edges,
    setNodes,
    setEdges,
  ])

  return { onPaneClicked }
}
