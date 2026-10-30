import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material"
import { useReactiveNode } from "@/hooks/useReactiveElement"
import { useReactFlow } from "@xyflow/react"
import { PopoverProps } from "../types"
import { BPMNEndEventType } from "@/types"
import { TextField } from "@/components/ui"
import { useTranslation } from "@/i18n"

export const BPMNEndEventEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { updateNodeData } = useReactFlow()
  const { t } = useTranslation()
  const node = useReactiveNode(elementId)
  if (!node) return null

  const data = node.data as { name?: string; eventType?: BPMNEndEventType }

  const handleNameChange = (value: string) =>
    updateNodeData(elementId, { name: value })
  const handleTypeChange = (value: BPMNEndEventType) =>
    updateNodeData(elementId, { eventType: value })

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <TextField
        size="small"
        label={t("popup.name", "Name")}
        value={data.name ?? ""}
        onChange={(e) => handleNameChange(e.target.value)}
      />
      <FormControl fullWidth size="small">
        <InputLabel id="bpmn-end-type-label">
          {t("popup.bpmn.endType", "End Type")}
        </InputLabel>
        <Select
          labelId="bpmn-end-type-label"
          id="bpmn-end-type-select"
          value={data.eventType ?? "default"}
          label={t("popup.bpmn.endType", "End Type")}
          onChange={(e) => handleTypeChange(e.target.value as BPMNEndEventType)}
        >
          <MenuItem value="default">
            {t("packages.BPMNDiagram.BPMNEndEvent", "End Event")}
          </MenuItem>
          <MenuItem value="message">
            {t("packages.BPMNDiagram.BPMNMessageEndEvent", "Message End Event")}
          </MenuItem>
          <MenuItem value="escalation">
            {t("packages.BPMNDiagram.BPMNEscalationEndEvent", "Escalation End Event")}
          </MenuItem>
          <MenuItem value="error">
            {t("packages.BPMNDiagram.BPMNErrorEndEvent", "Error End Event")}
          </MenuItem>
          <MenuItem value="compensation">
            {t("packages.BPMNDiagram.BPMNCompensationEndEvent", "Compensation End Event")}
          </MenuItem>
          <MenuItem value="signal">
            {t("packages.BPMNDiagram.BPMNSignalEndEvent", "Signal End Event")}
          </MenuItem>
          <MenuItem value="terminate">
            {t("packages.BPMNDiagram.BPMNTerminateEndEvent", "Terminate End Event")}
          </MenuItem>
        </Select>
      </FormControl>
    </Box>
  )
}
