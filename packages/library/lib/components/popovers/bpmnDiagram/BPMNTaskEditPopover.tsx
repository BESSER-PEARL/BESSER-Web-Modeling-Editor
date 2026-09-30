import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material"
import { useReactiveNode } from "@/hooks/useReactiveElement"
import { NodeStyleEditor } from "@/components/ui"
import { useReactFlow } from "@xyflow/react"
import { PopoverProps } from "../types"
import { BPMNMarkerType, BPMNTaskProps, BPMNTaskType } from "@/types"
import { supportsMultilineName } from "@/utils/nodeUtils"
import { useTranslation } from "@/i18n"

export const BPMNTaskEditPopover: React.FC<PopoverProps> = ({ elementId }) => {
  const { updateNodeData } = useReactFlow()
  const { t } = useTranslation()
  const node = useReactiveNode(elementId)
  if (!node) return null

  const data = node.data as BPMNTaskProps

  const handleDataFieldUpdate = (key: string, value: string) => {
    updateNodeData(elementId, { [key]: value })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        handleDataFieldUpdate={(key, value) =>
          handleDataFieldUpdate(key, value)
        }
        nodeData={data}
        isMultilineName={supportsMultilineName(node.type)}
      />

      <FormControl fullWidth size="small">
        <InputLabel id="bpmn-task-type-label">
          {t("popup.bpmn.taskType", "Task Type")}
        </InputLabel>
        <Select
          labelId="bpmn-task-type-label"
          id="bpmn-task-type-select"
          value={data.taskType ?? "default"}
          label={t("popup.bpmn.taskType", "Task Type")}
          onChange={(e) =>
            handleDataFieldUpdate("taskType", e.target.value as BPMNTaskType)
          }
        >
          <MenuItem value="default">
            {t("packages.BPMNDiagram.BPMNTask", "Task")}
          </MenuItem>
          <MenuItem value="user">
            {t("packages.BPMNDiagram.BPMNUserTask", "User Task")}
          </MenuItem>
          <MenuItem value="service">
            {t("packages.BPMNDiagram.BPMNServiceTask", "Service Task")}
          </MenuItem>
          <MenuItem value="send">
            {t("packages.BPMNDiagram.BPMNSendTask", "Send Task")}
          </MenuItem>
          <MenuItem value="receive">
            {t("packages.BPMNDiagram.BPMNReceiveTask", "Receive Task")}
          </MenuItem>
          <MenuItem value="manual">
            {t("packages.BPMNDiagram.BPMNManualTask", "Manual Task")}
          </MenuItem>
          <MenuItem value="business-rule">
            {t("packages.BPMNDiagram.BPMNBusinessRuleTask", "Business Rule Task")}
          </MenuItem>
          <MenuItem value="script">
            {t("packages.BPMNDiagram.BPMNScriptTask", "Script Task")}
          </MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel id="bpmn-task-marker-label">
          {t("popup.bpmn.marker", "Marker")}
        </InputLabel>
        <Select
          labelId="bpmn-task-marker-label"
          id="bpmn-task-marker-select"
          value={data.marker ?? "none"}
          label={t("popup.bpmn.marker", "Marker")}
          onChange={(e) =>
            handleDataFieldUpdate("marker", e.target.value as BPMNMarkerType)
          }
        >
          <MenuItem value="none">{t("common.none", "None")}</MenuItem>
          <MenuItem value="parallel multi instance">
            {t(
              "popup.bpmn.markerParallelMultiInstance",
              "Parallel multi instance"
            )}
          </MenuItem>
          <MenuItem value="sequential multi instance">
            {t(
              "popup.bpmn.markerSequentialMultiInstance",
              "Sequential multi instance"
            )}
          </MenuItem>
          <MenuItem value="loop">{t("popup.bpmn.markerLoop", "Loop")}</MenuItem>
        </Select>
      </FormControl>
    </Box>
  )
}
