import { useAssessmentSelectionStore, useMetadataStore } from "@/store"
import { useDiagramStoreApi } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { BesserMode } from "@/typings"
import { Node } from "@xyflow/react"
import { useMemo } from "react"

/**
 * Hook to handle assessment selection for nodes and their nested elements.
 * Mounted once per class row, so it subscribes only to values derived for
 * THIS element: a subscription to `nodes` re-rendered every row of every
 * node on each drag frame.
 */
export const useAssessmentSelection = (elementId: string) => {
  const isAssessmentSelectionMode = useAssessmentSelectionStore(
    (state) => state.isAssessmentSelectionMode
  )
  const isSelected = useAssessmentSelectionStore((state) =>
    state.selectedElementIds.includes(elementId)
  )
  const isHighlighted = useAssessmentSelectionStore(
    (state) => state.highlightedElementId === elementId
  )
  const selectElement = useAssessmentSelectionStore(
    (state) => state.selectElement
  )
  const setHighlightedElement = useAssessmentSelectionStore(
    (state) => state.setHighlightedElement
  )
  const selectMultipleElements = useAssessmentSelectionStore(
    (state) => state.selectMultipleElements
  )

  const diagramStore = useDiagramStoreApi()

  const { mode, readonly } = useMetadataStore(
    useShallow((state) => ({
      mode: state.mode,
      readonly: state.readonly,
    }))
  )

  // Check if we're in readonly assessment mode
  const isReadonlyAssessmentMode = useMemo(
    () => mode === BesserMode.Assessment && readonly,
    [mode, readonly]
  )

  // Get all child nodes recursively
  const getAllChildNodes = (nodes: Node[], parentId: string): Node[] => {
    const children: Node[] = []
    const directChildren = nodes.filter((node) => node.parentId === parentId)

    for (const child of directChildren) {
      children.push(child)
      children.push(...getAllChildNodes(nodes, child.id))
    }

    return children
  }

  // Get all nested element IDs for a given node (attributes, methods, child nodes)
  const getNestedElementIds = (nodes: Node[], nodeId: string): string[] => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return []

    const nestedIds: string[] = []

    // Add attributes and methods if they exist
    if (
      node.data &&
      "attributes" in node.data &&
      Array.isArray(node.data.attributes)
    ) {
      nestedIds.push(
        ...node.data.attributes.map((attr: { id: string }) => attr.id)
      )
    }
    if (
      node.data &&
      "methods" in node.data &&
      Array.isArray(node.data.methods)
    ) {
      nestedIds.push(
        ...node.data.methods.map((method: { id: string }) => method.id)
      )
    }

    // Add child nodes recursively
    const childNodes = getAllChildNodes(nodes, nodeId)
    for (const childNode of childNodes) {
      nestedIds.push(childNode.id)
      nestedIds.push(...getNestedElementIds(nodes, childNode.id))
    }

    return nestedIds
  }

  const handleElementClick = (e: React.PointerEvent | React.MouseEvent) => {
    if (!isReadonlyAssessmentMode || !isAssessmentSelectionMode) return

    e.stopPropagation()
    e.preventDefault()

    selectElement(elementId)

    // If this is a node (not a nested element), also select all nested elements
    const { nodes } = diagramStore.getState()
    const node = nodes.find((n) => n.id === elementId)
    if (node) {
      const nestedIds = getNestedElementIds(nodes, elementId)
      if (nestedIds.length > 0) {
        selectMultipleElements([elementId, ...nestedIds])
      }
    }
  }

  const handleElementMouseEnter = () => {
    if (!isReadonlyAssessmentMode || !isAssessmentSelectionMode) return
    setHighlightedElement(elementId)
  }

  const handleElementMouseLeave = () => {
    if (!isReadonlyAssessmentMode || !isAssessmentSelectionMode) return
    setHighlightedElement(null)
  }

  const showAssessmentInteraction =
    isReadonlyAssessmentMode && isAssessmentSelectionMode

  return {
    isSelected,
    isHighlighted,
    showAssessmentInteraction,
    handleElementClick,
    handleElementMouseEnter,
    handleElementMouseLeave,
    isReadonlyAssessmentMode,
    isAssessmentSelectionMode,
  }
}
