import { useDiagramStore, usePopoverStore } from "@/store/context"
import { useMetadataStore } from "@/store"
import { BesserMode } from "@/typings"
import {
  NodeMouseHandler,
  OnBeforeDelete,
  type Node,
  type Edge,
  EdgeMouseHandler,
} from "@xyflow/react"
import { useShallow } from "zustand/shallow"
import { useDiagramModifiable } from "./useDiagramModifiable"
import { getAllDescendants } from "@/utils/copyPasteUtils"

export const useElementInteractions = () => {
  const isDiagramModifiable = useDiagramModifiable()
  const { mode, readonly } = useMetadataStore(
    useShallow((state) => ({
      mode: state.mode,
      readonly: state.readonly,
    }))
  )
  const { setPopOverElementId } = usePopoverStore(
    useShallow((state) => ({
      setPopOverElementId: state.setPopOverElementId,
    }))
  )
  const allNodes = useDiagramStore(useShallow((state) => state.nodes))
  const canOpenAssessmentPopover = mode === BesserMode.Assessment && !readonly
  const canOpenPopover = isDiagramModifiable || canOpenAssessmentPopover

  // Expand the deletion set to include all descendants of any parent
  // that is being deleted (NNContainer, State, AgentIntent). React Flow's
  // default deletion only removes the selected node and reparents
  // children to the canvas root, which orphans them — undesirable for
  // the BESSER container types.
  const onBeforeDelete: OnBeforeDelete = ({ nodes, edges }) => {
    if (!isDiagramModifiable) {
      return Promise.resolve(false)
    }
    const seedIds = nodes.map((n) => n.id)
    const descendants = getAllDescendants(seedIds, allNodes)
    if (descendants.length === 0) {
      return Promise.resolve({ nodes, edges })
    }
    const expanded = [
      ...nodes,
      ...descendants.filter(
        (d) => !nodes.some((n) => n.id === d.id)
      ),
    ]
    return Promise.resolve({ nodes: expanded, edges })
  }

  const onNodeDoubleClick: NodeMouseHandler<Node> = (_event, node) => {
    if (!canOpenPopover) {
      return
    }
    setPopOverElementId(node.id)
  }

  const onEdgeDoubleClick: EdgeMouseHandler<Edge> = (_event, edge) => {
    if (!canOpenPopover) {
      return
    }
    setPopOverElementId(edge.id)
  }
  return {
    onBeforeDelete,
    onNodeDoubleClick,
    onEdgeDoubleClick,
  }
}
