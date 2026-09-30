import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material"
import { useReactiveNode } from "@/hooks/useReactiveElement"
import { useReactFlow } from "@xyflow/react"
import { PopoverProps } from "../types"
import { BPMNGatewayType } from "@/types"
import { TextField } from "@/components/ui"
import { useTranslation } from "@/i18n"
import { clearIneligibleBpmnDefaults } from "@/utils/bpmnDefaultFlow"

export const BPMNGatewayEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { updateNodeData, setEdges } = useReactFlow()
  const { t } = useTranslation()
  const node = useReactiveNode(elementId)
  if (!node) return null

  const data = node.data as { name?: string; gatewayType?: BPMNGatewayType }

  const handleNameChange = (value: string) =>
    updateNodeData(elementId, { name: value })
  const handleTypeChange = (value: BPMNGatewayType) => {
    updateNodeData(elementId, { gatewayType: value })
    // A Parallel / Event-Based gateway cannot carry a default flow
    // (BPMN 2.0.2 § 8.3.13): clear the flag on its outgoing flows so the
    // default slash does not linger.
    const retyped = { id: elementId, type: node.type, data: { ...data, gatewayType: value } }
    setEdges((edges) =>
      clearIneligibleBpmnDefaults([retyped], edges, { sourceId: elementId })
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <TextField
        size="small"
        label={t("popup.name", "Name")}
        value={data.name ?? ""}
        onChange={(e) => handleNameChange(e.target.value)}
      />
      <FormControl fullWidth size="small">
        <InputLabel id="bpmn-gateway-type-label">
          {t("popup.bpmn.gatewayType", "Gateway Type")}
        </InputLabel>
        <Select
          labelId="bpmn-gateway-type-label"
          id="bpmn-gateway-type-select"
          value={data.gatewayType ?? "exclusive"}
          label={t("popup.bpmn.gatewayType", "Gateway Type")}
          onChange={(e) => handleTypeChange(e.target.value as BPMNGatewayType)}
        >
          <MenuItem value="exclusive">
            {t("packages.BPMNDiagram.BPMNExclusiveGateway", "Exclusive")}
          </MenuItem>
          <MenuItem value="parallel">
            {t("packages.BPMNDiagram.BPMNParallelGateway", "Parallel")}
          </MenuItem>
          <MenuItem value="inclusive">
            {t("packages.BPMNDiagram.BPMNInclusiveGateway", "Inclusive")}
          </MenuItem>
          <MenuItem value="event-based">
            {t("packages.BPMNDiagram.BPMNEventBasedGateway", "Event-based")}
          </MenuItem>
          <MenuItem value="complex">
            {t("packages.BPMNDiagram.BPMNComplexGateway", "Complex")}
          </MenuItem>
        </Select>
      </FormControl>
    </Box>
  )
}
