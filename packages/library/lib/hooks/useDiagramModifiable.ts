import {
  useDiagramStore,
  useDiagramStoreApi,
  useMetadataStore,
} from "@/store/context"
import { BesserMode, BesserView } from "@/typings"
import { getLockIndex } from "@/utils/locks"
import { useStore } from "@xyflow/react"
import { useEffect } from "react"
import { useShallow } from "zustand/shallow"

/**
 * Modelling mode and view in an editor the host has not made read-only:
 * elements can be inspected and locks toggled, whether or not they are locked.
 */
export const useModellingView = () =>
  useMetadataStore(
    (state) =>
      state.mode === BesserMode.Modelling &&
      state.view === BesserView.Modelling &&
      !state.readonly
  )

/** The diagram can be edited: modelling view and not locked. */
export const useDiagramModifiable = () => {
  const modelling = useModellingView()
  const diagramLocked = useDiagramStore((state) => state.diagramLocked)
  return modelling && !diagramLocked
}

/**
 * `locked`: the node or edge carries its own lock. `pinned`: a node that
 * cannot move or resize (locked, or inside a locked container).
 * `undeletable`: removing it would remove locked content.
 */
export const useElementLock = (elementId: string) =>
  useDiagramStore(
    useShallow((state) => {
      const index = getLockIndex(state.nodes, state.edges)
      return {
        locked: index.locked.has(elementId),
        pinned: index.pinned.has(elementId),
        undeletable: index.undeletable.has(elementId),
      }
    })
  )

/**
 * A press on a pinned node never reaches React Flow's drag handler, so it
 * does not start a drag; a click still selects it and its handles still
 * start connections.
 */
export const useBlockPinnedNodeDrag = () => {
  const domNode = useStore((state) => state.domNode)
  const diagramStoreApi = useDiagramStoreApi()
  useEffect(() => {
    if (!domNode) return
    const onPress = (event: Event) => {
      const target = event.target as Element
      if (target.closest?.(".react-flow__handle")) return
      const id = target.closest?.<HTMLElement>(".react-flow__node")?.dataset.id
      if (!id) return
      const { nodes, edges } = diagramStoreApi.getState()
      if (getLockIndex(nodes, edges).pinned.has(id)) event.stopPropagation()
    }
    domNode.addEventListener("mousedown", onPress, true)
    domNode.addEventListener("touchstart", onPress, true)
    return () => {
      domNode.removeEventListener("mousedown", onPress, true)
      domNode.removeEventListener("touchstart", onPress, true)
    }
  }, [domNode, diagramStoreApi])
}
