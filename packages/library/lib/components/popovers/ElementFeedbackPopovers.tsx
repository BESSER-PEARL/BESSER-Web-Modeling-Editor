import { useDiagramStore } from "@/store"
import { PopoverProps } from "./types"
import { DefaultNodeGiveFeedbackPopover } from "./DefaultNodeGiveFeedbackPopover"
import { DefaultNodeSeeFeedbackPopover } from "./DefaultNodeSeeFeedbackPopover"
import { EdgeGiveFeedbackPopover } from "./edgePopovers/EdgeGiveFeedbackPopover"
import { EdgeSeeFeedbackPopover } from "./edgePopovers/EdgeSeeFeedbackPopover"

/**
 * Generic assessment bodies for ANY diagram element (node or edge).
 *
 * v3 wrapped every element in `assessable.tsx`, so every node and every
 * relationship could be scored — regardless of diagram type. The React-Flow
 * registry only had `feedbackGive` / `feedbackSee` slots for the stock
 * diagram types, so State*, Agent*, NN*, UserModel*, OCL constraint, comment
 * and their edges could not be assessed. These components are registered as
 * the per-kind registry FALLBACK (`registerInspectorFallback`) and pick the
 * node or edge body based on where `elementId` lives.
 */
const useIsEdge = (elementId: string) =>
  useDiagramStore((state) => state.edges.some((edge) => edge.id === elementId))

export const ElementGiveFeedbackPopover = ({ elementId }: PopoverProps) => {
  const isEdge = useIsEdge(elementId)
  return isEdge ? (
    <EdgeGiveFeedbackPopover elementId={elementId} />
  ) : (
    <DefaultNodeGiveFeedbackPopover elementId={elementId} />
  )
}

export const ElementSeeFeedbackPopover = ({ elementId }: PopoverProps) => {
  const isEdge = useIsEdge(elementId)
  return isEdge ? (
    <EdgeSeeFeedbackPopover elementId={elementId} />
  ) : (
    <DefaultNodeSeeFeedbackPopover elementId={elementId} />
  )
}
