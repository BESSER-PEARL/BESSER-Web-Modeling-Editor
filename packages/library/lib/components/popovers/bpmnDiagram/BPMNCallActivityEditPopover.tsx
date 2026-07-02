import { Box } from "@mui/material"
import { useReactFlow } from "@xyflow/react"
import { PopoverProps } from "../types"
import { TextField } from "@/components/ui"

/**
 * Call Activity editor: name + the referenced `calledElement` id. Mirrors
 * develop's bpmn-call-activity-update.tsx — `calledElement` is popup-only
 * (never rendered on the shape).
 */
export const BPMNCallActivityEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { getNode, updateNodeData } = useReactFlow()
  const node = getNode(elementId)
  if (!node) return null
  const data = node.data as { name?: string; calledElement?: string }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <TextField
        size="small"
        label="Name"
        value={data.name ?? ""}
        onChange={(e) => updateNodeData(elementId, { name: e.target.value })}
      />
      <TextField
        size="small"
        label="Called Element"
        value={data.calledElement ?? ""}
        onChange={(e) =>
          updateNodeData(elementId, { calledElement: e.target.value })
        }
      />
    </Box>
  )
}
