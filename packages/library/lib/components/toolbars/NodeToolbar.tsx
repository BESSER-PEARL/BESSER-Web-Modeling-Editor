import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { useHandleDelete } from "@/hooks/useHandleDelete"
import { useIsOnlyThisElementSelected } from "@/hooks/useIsOnlyThisElementSelected"
import { usePopoverStore } from "@/store"
import { Box } from "@mui/material"
import { Position, NodeToolbar as ReactFlowNodeToolbar } from "@xyflow/react"
import { FC, type SyntheticEvent } from "react"
import { useShallow } from "zustand/shallow"
import { DeleteIcon, EditIcon } from "../Icon"
import { AddAssociatedObjectButton } from "./AddAssociatedObjectButton"

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

const iconStyle = {
  cursor: "pointer",
  // The toolbar box itself is pointer-transparent; only the icons capture.
  pointerEvents: "auto",
  width: 16,
  height: 16,
} as const

interface Props {
  elementId: string
  showEdit?: boolean
}
export const NodeToolbar: FC<Props> = ({ elementId, showEdit = true }) => {
  const setPopOverElementId = usePopoverStore(
    useShallow((state) => state.setPopOverElementId)
  )
  const handleDelete = useHandleDelete(elementId)

  const isDiagramModifiable = useDiagramModifiable()
  const selected = useIsOnlyThisElementSelected(elementId)
  // The edit (pencil) button opens the inspector for this element — it is
  // the explicit affordance the user expects, alongside double-click. It
  // works in both editing modes: in popover mode it opens the floating
  // popover, in properties-panel mode it opens the right-side panel (both
  // via `setPopOverElementId`). The panel no longer auto-opens on selection,
  // so the pencil must stay visible.
  const showEditButton = showEdit

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
      <Box
        className="nodrag nopan"
        onPointerDownCapture={stopToolbarPointer}
        onMouseDownCapture={stopToolbarPointer}
        onTouchStartCapture={stopToolbarPointer}
        sx={{ display: "flex", gap: 1, flexDirection: "column" }}
      >
        <DeleteIcon onClick={handleDelete} style={iconStyle} />

        {showEditButton && (
          <EditIcon
            onClick={() => {
              setPopOverElementId(elementId)
            }}
            style={iconStyle}
          />
        )}

        {/* ObjectDiagram / UserDiagram only: (+) "Add and connect to new
            Object" (v3 updatable.tsx onAdd). Self-gating. */}
        <AddAssociatedObjectButton elementId={elementId} />
      </Box>
    </ReactFlowNodeToolbar>
  )
}
