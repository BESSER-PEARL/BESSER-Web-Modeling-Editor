import { useStore, type Edge, type Node } from "@xyflow/react"
import { useDiagramStore } from "@/store/context"

/**
 * Reactive single-element reads for edit popovers / inspector panels
 * (ported from upstream Apollon). A popover must subscribe to the node or
 * edge it edits rather than reading `getNode` / `getEdge` imperatively
 * during render, so it re-renders on every data change -- undo/redo, a
 * collaborator's edit, a swap -- instead of showing stale values until some
 * unrelated re-render.
 *
 * Reads React Flow's lookups first (exactly what `getNode` / `getEdge`
 * returned), then falls back to BESSER's diagram store for elements React
 * Flow never sees -- the edge-anchored `ClassLinkRel` links, which live only
 * in the store (see `utils/associationClassLink.ts`).
 */
export function useReactiveNode(id: string | undefined): Node | undefined {
  const rfNode = useStore((state) =>
    id ? state.nodeLookup.get(id)?.internals.userNode : undefined
  )
  const storeNode = useDiagramStore((state) =>
    !id || rfNode ? undefined : state.nodes.find((node) => node.id === id)
  )
  return rfNode ?? storeNode
}

export function useReactiveEdge(id: string | undefined): Edge | undefined {
  const rfEdge = useStore((state) =>
    id ? state.edgeLookup.get(id) : undefined
  )
  const storeEdge = useDiagramStore((state) =>
    !id || rfEdge ? undefined : state.edges.find((edge) => edge.id === id)
  )
  return rfEdge ?? storeEdge
}
