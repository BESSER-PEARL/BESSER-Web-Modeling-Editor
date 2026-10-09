import { useMetadataStore } from "@/store"
import { useDiagramStoreApi } from "@/store/context"
import { BesserMode } from "@/typings"
import { useShallow } from "zustand/shallow"
import { removePoolLane } from "@/components/popovers/bpmnDiagram/poolLanes"
import { getAllNodesToInclude, getEdgesToRemove } from "@/utils/copyPasteUtils"

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
    const node = nodes.find((n) => n.id === elementId)
    // As the lane editor does: an occupied lane merges into its neighbour,
    // an empty one shrinks the pool.
    if (node?.type === "bpmnSwimlane" && node.parentId) {
      setNodesAndEdges(removePoolLane(nodes, node.parentId, elementId), edges)
      setSelectedElementsId([])
      return
    }
    // Like the Delete key: a container goes with its content and every edge
    // touching what is removed.
    const removedIds = getAllNodesToInclude([elementId], nodes).map((n) => n.id)
    const removedEdges = getEdgesToRemove([elementId], removedIds, edges)
    setNodesAndEdges(
      nodes.filter((n) => !removedIds.includes(n.id)),
      edges.filter((edge) => !removedEdges.has(edge.id))
    )
    setSelectedElementsId([])
  }

  return handleDelete
}
