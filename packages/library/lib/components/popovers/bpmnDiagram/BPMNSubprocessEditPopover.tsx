import { Box, Button } from "@mui/material"
import { useReactiveNode } from "@/hooks/useReactiveElement"
import { useReactFlow } from "@xyflow/react"
import { PopoverProps } from "../types"
import { TextField } from "@/components/ui"
import { useTranslation } from "@/i18n"

/**
 * Shared editor for the two expandable activities (Subprocess &
 * Transaction). Mirrors develop's `BPMNExpandableUpdate`: a name field
 * plus a full-width button that flips `data.isExpanded`.
 */
export const BPMNExpandableEditPopover: React.FC<
  PopoverProps & { label: string; labelKey?: string }
> = ({ elementId, label, labelKey }) => {
  const { updateNodeData } = useReactFlow()
  const { t } = useTranslation()
  const translatedLabel = labelKey ? t(labelKey, label) : label
  const node = useReactiveNode(elementId)
  if (!node) return null
  const data = node.data as { name?: string; isExpanded?: boolean }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <TextField
        size="small"
        label={t("popup.name", "Name")}
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
        {data.isExpanded
          ? `${t("packages.BPMNDiagram.BPMNCollapse", "Collapse")} ${translatedLabel}`
          : `${t("packages.BPMNDiagram.BPMNExpand", "Expand")} ${translatedLabel}`}
      </Button>
    </Box>
  )
}

export const BPMNSubprocessEditPopover: React.FC<PopoverProps> = (props) => (
  <BPMNExpandableEditPopover
    {...props}
    label="Subprocess"
    labelKey="packages.BPMNDiagram.BPMNSubprocess"
  />
)
