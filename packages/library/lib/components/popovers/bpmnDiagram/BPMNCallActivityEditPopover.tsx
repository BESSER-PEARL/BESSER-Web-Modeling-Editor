import { Box } from "@mui/material"
import { useReactiveNode } from "@/hooks/useReactiveElement"
import { useReactFlow } from "@xyflow/react"
import { PopoverProps } from "../types"
import { NodeStyleEditor, TextField } from "@/components/ui"
import { DefaultNodeProps } from "@/types"
import { useTranslation } from "@/i18n"
import { supportsMultilineName } from "@/utils/nodeUtils"

/**
 * Call Activity editor: name + the referenced `calledElement` id. Mirrors
 * develop's bpmn-call-activity-update.tsx — `calledElement` is popup-only
 * (never rendered on the shape).
 */
export const BPMNCallActivityEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { updateNodeData } = useReactFlow()
  const { t } = useTranslation()
  const node = useReactiveNode(elementId)
  if (!node) return null
  const data = node.data as DefaultNodeProps & { calledElement?: string }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={(key, value) => updateNodeData(elementId, { [key]: value })}
        inputPlaceholder={t("popup.name", "Name")}
        isMultilineName={supportsMultilineName(node.type)}
      />
      <TextField
        size="small"
        label={t("packages.BPMNDiagram.BPMNCalledElement", "Called element")}
        placeholder={t(
          "packages.BPMNDiagram.BPMNCalledElementPlaceholder",
          "Process or task name"
        )}
        value={data.calledElement ?? ""}
        onChange={(e) =>
          updateNodeData(elementId, { calledElement: e.target.value })
        }
      />
    </Box>
  )
}
