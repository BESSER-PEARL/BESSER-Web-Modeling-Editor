import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import { useHandleDelete } from "@/hooks/useHandleDelete"
import { useIsOnlyThisElementSelected } from "@/hooks/useIsOnlyThisElementSelected"
import { usePopoverStore } from "@/store"
import { useUsePropertiesPanel } from "@/store/settingsStore"
import { Box } from "@mui/material"
import { Position, NodeToolbar as ReactFlowNodeToolbar } from "@xyflow/react"
import { FC } from "react"
import { useShallow } from "zustand/shallow"
import { DeleteIcon, EditIcon } from "../Icon"

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
  // When the right-side properties panel is the
  // active editing surface (`usePropertiesPanel=true`), the floating
  // pencil affordance becomes redundant — the panel auto-shows on
  // selection. Hide the pencil to avoid the duplicate-UI confusion.
  const usePropertiesPanel = useUsePropertiesPanel()
  const showEditButton = showEdit && !usePropertiesPanel

  return (
    <ReactFlowNodeToolbar
      isVisible={isDiagramModifiable && !!selected}
      position={Position.Top}
      align="end"
      offset={10}
    >
      <Box sx={{ display: "flex", gap: 1, flexDirection: "column" }}>
        <DeleteIcon
          onClick={handleDelete}
          style={{ cursor: "pointer", width: 16, height: 16 }}
        />

        {showEditButton && (
          <EditIcon
            onClick={() => {
              setPopOverElementId(elementId)
            }}
            style={{ cursor: "pointer", width: 16, height: 16 }}
          />
        )}
      </Box>
    </ReactFlowNodeToolbar>
  )
}
