import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material"
import { useReactiveEdge, useReactiveNode } from "@/hooks/useReactiveElement"
import { CustomEdgeProps } from "@/edges/EdgeProps"
import { useReactFlow } from "@xyflow/react"
import { useEdgePopOver } from "@/hooks"
import { PopoverProps } from "../types"
import { SwapHorizIcon } from "@/components/Icon"
import { EdgeStyleEditor, TextField, Typography } from "@/components/ui"
import { getAllowedBpmnFlowEdgeTypes } from "@/utils/edgeUtils"
import { useTranslation } from "@/i18n"
// BPMN 2.0.2 § 8.3.13: a default sequence flow can only originate from an
// activity or an exclusive / inclusive / complex gateway.
import { canSourceCarryDefault } from "@/services/bpmnFlowValidation"
import {
  defaultFlagAfterSourceChange,
  setBpmnDefaultFlow,
} from "@/utils/bpmnDefaultFlow"

// English fallbacks; the label is resolved through
// `packages.BPMNDiagram.<edgeType>` (the keys develop's flow popup used).
const BPMN_EDGE_TYPE_LABELS: Record<string, string> = {
  BPMNSequenceFlow: "Sequence Flow",
  BPMNMessageFlow: "Message Flow",
  BPMNAssociationFlow: "Association Flow",
  BPMNDataAssociationFlow: "Data Association Flow",
}

export const BPMNDiagramEdgeEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { updateEdgeData, setEdges } = useReactFlow()
  const { t } = useTranslation()

  const edge = useReactiveEdge(elementId)
  const sourceNode = useReactiveNode(edge?.source)
  const targetNode = useReactiveNode(edge?.target)
  const { handleEdgeTypeChange, handleSwap, handleLabelChange } =
    useEdgePopOver(elementId)

  if (!edge) {
    return null
  }
  const edgeData = edge.data as CustomEdgeProps | undefined
  const sourceName = (sourceNode?.data?.name as string) ?? t("common.source", "Source")
  const targetName = (targetNode?.data?.name as string) ?? t("common.target", "Target")

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
    label: BPMN_EDGE_TYPE_LABELS[value]
      ? t(`packages.BPMNDiagram.${value}`, BPMN_EDGE_TYPE_LABELS[value])
      : value,
  }))

  const showDefaultToggle =
    edge.type === "BPMNSequenceFlow" && canSourceCarryDefault(sourceNode)

  // A source has at most one default flow: ticking it clears the siblings.
  const handleDefaultToggle = () =>
    setEdges((edges) =>
      setBpmnDefaultFlow(edges, elementId, !edgeData?.isDefault)
    )

  // Flipping makes the target the new source; drop `isDefault` when that
  // node cannot carry a default flow (a parallel gateway, an event, ...).
  const handleSwapWithDefault = handleSwap
    ? () => {
        if (
          edgeData?.isDefault &&
          !defaultFlagAfterSourceChange(edge, targetNode)
        ) {
          updateEdgeData(elementId, { isDefault: false })
        }
        handleSwap()
      }
    : undefined

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <EdgeStyleEditor
        edgeData={edgeData}
        handleDataFieldUpdate={(key, value) =>
          updateEdgeData(elementId, { ...edge.data, [key]: value })
        }
        label={t("popup.bpmn.controlFlow", "Control Flow")}
        sideElements={[
          handleSwapWithDefault && (
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <SwapHorizIcon
                style={{ cursor: "pointer" }}
                onClick={handleSwapWithDefault}
              />
            </Box>
          ),
        ]}
      />
      <FormControl fullWidth size="small">
        <InputLabel id="edge-type-label">
          {t("common.edgeType", "Edge Type")}
        </InputLabel>
        <Select
          labelId="edge-type-label"
          id="edge-type-select"
          value={edge.type}
          label={t("common.edgeType", "Edge Type")}
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
              onChange={handleDefaultToggle}
            />
          }
          label={t("packages.BPMNDiagram.BPMNDefaultSequenceFlow", "Default flow")}
        />
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {sourceName} → {targetName}
      </Typography>
      {/* Label update */}
      <TextField
        label={t("common.edgeLabel", "Edge Label")}
        value={edgeData?.label ?? ""}
        onChange={(e) => handleLabelChange(e.target.value)}
        size="small"
        fullWidth
      />
    </Box>
  )
}
