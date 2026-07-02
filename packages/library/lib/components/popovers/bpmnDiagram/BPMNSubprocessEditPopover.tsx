import { Box, Button } from "@mui/material"
import { useReactFlow } from "@xyflow/react"
import { PopoverProps } from "../types"
import { TextField } from "@/components/ui"

/**
 * Shared editor for the two expandable activities (Subprocess &
 * Transaction). Mirrors develop's `BPMNExpandableUpdate`: a name field
 * plus a full-width button that flips `data.isExpanded`.
 */
export const BPMNExpandableEditPopover: React.FC<
  PopoverProps & { label: string }
> = ({ elementId, label }) => {
  const { getNode, updateNodeData } = useReactFlow()
  const node = getNode(elementId)
  if (!node) return null
  const data = node.data as { name?: string; isExpanded?: boolean }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <TextField
        size="small"
        label="Name"
        value={data.name ?? ""}
        onChange={(e) => updateNodeData(elementId, { name: e.target.value })}
      />
      <Button
        fullWidth
        variant="outlined"
        size="small"
        onClick={() =>
          updateNodeData(elementId, { isExpanded: !data.isExpanded })
        }
      >
        {data.isExpanded ? `Collapse ${label}` : `Expand ${label}`}
      </Button>
    </Box>
  )
}

export const BPMNSubprocessEditPopover: React.FC<PopoverProps> = (props) => (
  <BPMNExpandableEditPopover {...props} label="Subprocess" />
)
