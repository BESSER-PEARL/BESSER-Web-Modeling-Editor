import {
  useAssessmentSelectionStore,
  useDiagramStore,
  useMetadataStore,
} from "@/store"
import { useShallow } from "zustand/shallow"
import { ApollonMode } from "@/typings"
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

  // Auto-enable assessment selection mode when in readonly assessment mode
  useEffect(() => {
    const shouldEnableAssessmentMode =
      mode === ApollonMode.Assessment && readonly
    if (shouldEnableAssessmentMode !== isAssessmentSelectionMode) {
      setAssessmentSelectionMode(shouldEnableAssessmentMode)
    }
  }, [mode, readonly, isAssessmentSelectionMode, setAssessmentSelectionMode])

  const onPaneClicked = useCallback(() => {
    if (isAssessmentSelectionMode) {
      clearSelection()
    }
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
    setSelectedElementsId,
    nodes,
    edges,
    setNodes,
    setEdges,
  ])

  return { onPaneClicked }
}
