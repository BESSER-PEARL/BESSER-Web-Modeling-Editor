import { Box, FormControl, InputLabel, Select, MenuItem } from "@mui/material"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { useReactFlow } from "@xyflow/react"
import { useEdgePopOver } from "@/hooks"
import { PopoverProps } from "../types"
import { SwapHorizIcon } from "@/components/Icon"
import { EdgeStyleEditor, TextField, Typography } from "@/components/ui"

export const BPMNDiagramEdgeEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { getEdge, getNode, updateEdgeData } = useReactFlow()

  const edge = getEdge(elementId)
  const { handleEdgeTypeChange, handleSwap, handleLabelChange } =
    useEdgePopOver(elementId)

  if (!edge) {
    return null
  }
  const edgeData = edge.data as CustomEdgeProps | undefined
  const sourceNode = getNode(edge.source)
  const targetNode = getNode(edge.target)
  const sourceName = (sourceNode?.data?.name as string) ?? "Source"
  const targetName = (targetNode?.data?.name as string) ?? "Target"

  const bpmnEdgeTypeOptions = [
    { value: "BPMNSequenceFlow", label: "Sequence Flow" },
    { value: "BPMNMessageFlow", label: "Message Flow" },
    { value: "BPMNAssociationFlow", label: "Association Flow" },
    { value: "BPMNDataAssociationFlow", label: "Data Association Flow" },
  ]

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={edgeData}
        handleDataFieldUpdate={(key, value) =>
          updateEdgeData(elementId, { ...edge.data, [key]: value })
        }
        label="Control Flow"
        sideElements={[
          handleSwap && (
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <SwapHorizIcon
                style={{ cursor: "pointer" }}
                onClick={handleSwap}
              />
            </Box>
          ),
        ]}
      />
      <FormControl fullWidth size="small">
        <InputLabel id="edge-type-label">Edge Type</InputLabel>
        <Select
          labelId="edge-type-label"
          id="edge-type-select"
          value={edge.type}
          label="Edge Type"
          onChange={(e) => handleEdgeTypeChange(e.target.value)}
        >
          {bpmnEdgeTypeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {sourceName} → {targetName}
      </Typography>
      {/* Label update */}
      <TextField
        value={edgeData?.label ?? ""}
        onChange={(e) => handleLabelChange(e.target.value)}
        size="small"
        fullWidth
      />
    </Box>
  )
}
