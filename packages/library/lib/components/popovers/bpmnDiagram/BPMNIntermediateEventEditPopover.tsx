import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material"
import { useReactiveNode } from "@/hooks/useReactiveElement"
import { useReactFlow } from "@xyflow/react"
import { PopoverProps } from "../types"
import { BPMNIntermediateEventType } from "@/types"
import { TextField } from "@/components/ui"
import { useTranslation } from "@/i18n"

export const BPMNIntermediateEventEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { updateNodeData } = useReactFlow()
  const { t } = useTranslation()
  const node = useReactiveNode(elementId)
  if (!node) return null

  const data = node.data as {
    name?: string
    eventType?: BPMNIntermediateEventType
  }

  const handleNameChange = (value: string) =>
    updateNodeData(elementId, { name: value })
  const handleTypeChange = (value: BPMNIntermediateEventType) =>
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
        <InputLabel id="bpmn-intermediate-type-label">
          {t("popup.bpmn.intermediateType", "Intermediate Type")}
        </InputLabel>
        <Select
          labelId="bpmn-intermediate-type-label"
          id="bpmn-intermediate-type-select"
          value={data.eventType ?? "default"}
          label={t("popup.bpmn.intermediateType", "Intermediate Type")}
          onChange={(e) =>
            handleTypeChange(e.target.value as BPMNIntermediateEventType)
          }
        >
          <MenuItem value="default">
            {t("packages.BPMNDiagram.BPMNIntermediateEvent", "Intermediate Event")}
          </MenuItem>
          <MenuItem value="message-catch">
            {t("packages.BPMNDiagram.BPMNMessageIntermediateCatchEvent", "Message Intermediate Catch Event")}
          </MenuItem>
          <MenuItem value="message-throw">
            {t("packages.BPMNDiagram.BPMNMessageIntermediateThrowEvent", "Message Intermediate Throw Event")}
          </MenuItem>
          <MenuItem value="timer-catch">
            {t("packages.BPMNDiagram.BPMNTimerIntermediateCatchEvent", "Timer Intermediate Catch Event")}
          </MenuItem>
          <MenuItem value="timer-throw">
            {t("packages.BPMNDiagram.BPMNTimerIntermediateThrowEvent", "Timer Intermediate Throw Event")}
          </MenuItem>
          <MenuItem value="escalation-throw">
            {t("packages.BPMNDiagram.BPMNEscalationIntermediateThrowEvent", "Escalation Intermediate Throw Event")}
          </MenuItem>
          <MenuItem value="conditional-catch">
            {t("packages.BPMNDiagram.BPMNConditionalIntermediateCatchEvent", "Conditional Intermediate Catch Event")}
          </MenuItem>
          <MenuItem value="link-catch">
            {t("packages.BPMNDiagram.BPMNLinkIntermediateCatchEvent", "Link Intermediate Catch Event")}
          </MenuItem>
          <MenuItem value="link-throw">
            {t("packages.BPMNDiagram.BPMNLinkIntermediateThrowEvent", "Link Intermediate Throw Event")}
          </MenuItem>
          <MenuItem value="compensation-throw">
            {t("packages.BPMNDiagram.BPMNCompensationIntermediateThrowEvent", "Compensation Intermediate Throw Event")}
          </MenuItem>
          <MenuItem value="signal-catch">
            {t("packages.BPMNDiagram.BPMNSignalIntermediateCatchEvent", "Signal Intermediate Catch Event")}
          </MenuItem>
          <MenuItem value="signal-throw">
            {t("packages.BPMNDiagram.BPMNSignalIntermediateThrowEvent", "Signal Intermediate Throw Event")}
          </MenuItem>
        </Select>
      </FormControl>
    </Box>
  )
}
