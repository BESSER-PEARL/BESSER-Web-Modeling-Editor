import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material"
import { useReactiveNode } from "@/hooks/useReactiveElement"
import { useReactFlow } from "@xyflow/react"
import { PopoverProps } from "../types"
import { BPMNStartEventType } from "@/types"
import { TextField } from "@/components/ui"
import { useTranslation } from "@/i18n"

export const BPMNStartEventEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { updateNodeData } = useReactFlow()
  const { t } = useTranslation()
  const node = useReactiveNode(elementId)
  if (!node) return null

  const data = node.data as { name?: string; eventType?: BPMNStartEventType }

  const handleNameChange = (value: string) =>
    updateNodeData(elementId, { name: value })
  const handleTypeChange = (value: BPMNStartEventType) =>
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
        <InputLabel sx={{ color: "red" }} id="bpmn-start-type-label">
          {t("popup.bpmn.startType", "Start Type")}
        </InputLabel>
        <Select
          sx={{ color: "red" }}
          labelId="bpmn-start-type-label"
          id="bpmn-start-type-select"
          value={data.eventType ?? "default"}
          label={t("popup.bpmn.startType", "Start Type")}
          onChange={(e) =>
            handleTypeChange(e.target.value as BPMNStartEventType)
          }
        >
          <MenuItem value="default">
            {t("packages.BPMNDiagram.BPMNStartEvent", "Start Event")}
          </MenuItem>
          <MenuItem value="message">
            {t("packages.BPMNDiagram.BPMNMessageStartEvent", "Message Start Event")}
          </MenuItem>
          <MenuItem value="timer">
            {t("packages.BPMNDiagram.BPMNTimerStartEvent", "Timer Start Event")}
          </MenuItem>
          <MenuItem value="conditional">
            {t("packages.BPMNDiagram.BPMNConditionalStartEvent", "Conditional Start Event")}
          </MenuItem>
          <MenuItem value="signal">
            {t("packages.BPMNDiagram.BPMNSignalStartEvent", "Signal Start Event")}
          </MenuItem>
          <MenuItem value="escalation">
            {t("packages.BPMNDiagram.BPMNEscalationStartEvent", "Escalation Start Event")}
          </MenuItem>
          <MenuItem value="error">
            {t("packages.BPMNDiagram.BPMNErrorStartEvent", "Error Start Event")}
          </MenuItem>
          <MenuItem value="compensation">
            {t("packages.BPMNDiagram.BPMNCompensationStartEvent", "Compensation Start Event")}
          </MenuItem>
          <MenuItem value="link">
            {t("packages.BPMNDiagram.BPMNLinkStartEvent", "Link Start Event")}
          </MenuItem>
        </Select>
      </FormControl>
    </Box>
  )
}
