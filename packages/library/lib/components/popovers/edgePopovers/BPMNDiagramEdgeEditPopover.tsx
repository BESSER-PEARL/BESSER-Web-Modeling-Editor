import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { useReactFlow } from "@xyflow/react"
import { useEdgePopOver } from "@/hooks"
import { PopoverProps } from "../types"
import { SwapHorizIcon } from "@/components/Icon"
import { EdgeStyleEditor, TextField, Typography } from "@/components/ui"
import { getAllowedBpmnFlowEdgeTypes } from "@/utils/edgeUtils"

const BPMN_EDGE_TYPE_LABELS: Record<string, string> = {
  BPMNSequenceFlow: "Sequence Flow",
  BPMNMessageFlow: "Message Flow",
  BPMNAssociationFlow: "Association Flow",
  BPMNDataAssociationFlow: "Data Association Flow",
}

// Port of develop's `canSourceCarryDefault` (bpmn-flow-validator.ts): a
// default sequence flow can only originate from an activity, or from an
// exclusive / inclusive / complex gateway.
const canSourceCarryDefault = (
  sourceType: string | undefined,
  gatewayType: string | undefined
): boolean => {
  if (
    sourceType === "bpmnTask" ||
    sourceType === "bpmnSubprocess" ||
    sourceType === "bpmnTransaction" ||
    sourceType === "bpmnCallActivity"
  ) {
    return true
  }
  return (
    sourceType === "bpmnGateway" &&
    (gatewayType === "exclusive" ||
      gatewayType === "inclusive" ||
      gatewayType === "complex")
  )
}

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

  // Only offer the flow subtypes that are actually legal for this
  // endpoint pair (port of develop's getAllowedBpmnFlowTypes). Always
  // keep the current edge type in the list so the Select's value stays
  // in sync even if the pair changed after creation.
  const allowedTypes = getAllowedBpmnFlowEdgeTypes(
    sourceNode?.type,
    targetNode?.type
  )
  const optionTypes = Array.from(
    new Set<string>([
      ...(edge.type ? [edge.type] : []),
      ...allowedTypes,
    ])
  )
  const bpmnEdgeTypeOptions = optionTypes.map((value) => ({
    value,
    label: BPMN_EDGE_TYPE_LABELS[value] ?? value,
  }))

  const gatewayType = sourceNode?.data?.gatewayType as string | undefined
  const showDefaultToggle =
    edge.type === "BPMNSequenceFlow" &&
    canSourceCarryDefault(sourceNode?.type, gatewayType)

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

      {showDefaultToggle && (
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={edgeData?.isDefault ?? false}
              onChange={() =>
                updateEdgeData(elementId, {
                  ...edge.data,
                  isDefault: !edgeData?.isDefault,
                })
              }
            />
          }
          label="Default flow"
        />
      )}

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
