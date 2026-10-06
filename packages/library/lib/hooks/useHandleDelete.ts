import { useMetadataStore } from "@/store"
import { useDiagramStoreApi } from "@/store/context"
import { BesserMode } from "@/typings"
import { useShallow } from "zustand/shallow"

export const useHandleDelete = (elementId: string) => {
  // Live state is read on delete: this hook runs in every node's toolbar,
  // and subscribing to the node list re-rendered all of them per drag step.
  const diagramStoreApi = useDiagramStoreApi()

  const { readonlyDiagram, diagramMode } = useMetadataStore(
    useShallow((state) => ({
      readonlyDiagram: state.readonly,
      diagramMode: state.mode,
    }))
  )

  const handleDelete = () => {
    if (
      readonlyDiagram ||
      diagramMode === BesserMode.Assessment ||
      diagramMode === BesserMode.Exporting
    )
      return
    const { nodes, edges, setNodesAndEdges, setSelectedElementsId } =
      diagramStoreApi.getState()
    const newNodes = nodes.filter((node) => node.id !== elementId)
    const newEdges = edges.filter((edge) => edge.id !== elementId)
    setNodesAndEdges(newNodes, newEdges)
    setSelectedElementsId([])
  }

  return handleDelete
}
