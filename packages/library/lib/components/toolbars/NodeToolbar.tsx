import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { useHandleDelete } from "@/hooks/useHandleDelete"
import { useIsOnlyThisElementSelected } from "@/hooks/useIsOnlyThisElementSelected"
import { usePopoverStore } from "@/store"
import { Position, NodeToolbar as ReactFlowNodeToolbar } from "@xyflow/react"
import { FC, type SyntheticEvent } from "react"
import { useShallow } from "zustand/shallow"
import { DeleteIcon, EditIcon } from "../Icon"
import { AddAssociatedObjectButton } from "./AddAssociatedObjectButton"
import { ToolbarButton } from "./ToolbarButton"
import { useTranslation } from "@/i18n"

// Keep a press on a toolbar icon away from React Flow (upstream Apollon
// #708): without this, pressing a button starts a pane pan / selection box
// or a node drag, so the canvas jumps. Only events that originate inside
// the toolbar's own DOM are stopped -- the (+) button's MUI Popover is
// portaled to <body> but still bubbles through this React subtree, and its
// buttons must keep receiving their pointer events.
const stopToolbarPointer = (event: SyntheticEvent<HTMLElement>) => {
  if (event.currentTarget.contains(event.target as Node)) {
    event.stopPropagation()
  }
}

interface Props {
  elementId: string
  showEdit?: boolean
}
export const NodeToolbar: FC<Props> = ({ elementId, showEdit = true }) => {
  const { t } = useTranslation()
  const setPopOverElementId = usePopoverStore(
    useShallow((state) => state.setPopOverElementId)
  )
  // While the inspector already shows this element the pencil is redundant.
  const inspectingThis = usePopoverStore(
    (state) => state.popoverElementId === elementId
  )
  const handleDelete = useHandleDelete(elementId)

  const isDiagramModifiable = useDiagramModifiable()
  const selected = useIsOnlyThisElementSelected(elementId)
  // The edit (pencil) button opens the inspector for this element — it is
  // the explicit affordance the user expects, alongside double-click. It
  // works in both editing modes: in popover mode it opens the floating
  // popover, in properties-panel mode it opens the right-side panel (both
  // via `setPopOverElementId`). The panel no longer auto-opens on selection,
  // so the pencil stays visible until the inspector shows this element.
  const showEditButton = showEdit && !inspectingThis

  return (
    <ReactFlowNodeToolbar
      isVisible={isDiagramModifiable && !!selected}
      position={Position.Top}
      align="end"
      offset={10}
      // The toolbar wrapper is larger than its icons; left opaque to the
      // pointer, its empty margins and the gaps between the icons swallow
      // clicks meant for whatever node sits beneath (the toolbar floats at
      // the node's top-right). Make the box transparent and re-enable only
      // the icons (upstream Apollon #791) -- matching the edge toolbar.
      style={{ pointerEvents: "none" }}
    >
      <div
        className="besser-canvas-toolbar nodrag nopan"
        onPointerDownCapture={stopToolbarPointer}
        onMouseDownCapture={stopToolbarPointer}
        onTouchStartCapture={stopToolbarPointer}
      >
        {showEditButton && (
          <ToolbarButton
            label={t("actions.edit", "Edit")}
            onClick={() => {
              setPopOverElementId(elementId)
            }}
          >
            <EditIcon />
          </ToolbarButton>
        )}

        {/* ObjectDiagram / UserDiagram only: (+) "Add and connect to new
            Object" (v3 updatable.tsx onAdd). Self-gating. */}
        <AddAssociatedObjectButton elementId={elementId} />

        <ToolbarButton label={t("actions.delete", "Delete")} danger onClick={handleDelete}>
          <DeleteIcon />
        </ToolbarButton>
      </div>
    </ReactFlowNodeToolbar>
  )
}
