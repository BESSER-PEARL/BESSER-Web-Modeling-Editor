import { Box, Button } from "@mui/material"
import { useReactFlow } from "@xyflow/react"
import { useShallow } from "zustand/shallow"
import { useReactiveNode } from "@/hooks/useReactiveElement"
import { useDiagramStore } from "@/store/context"
import { PopoverProps } from "../types"
import { TextField } from "@/components/ui"
import { useTranslation } from "@/i18n"

/** Collapsed size of a subprocess / transaction (the palette default). */
export const COLLAPSED_ACTIVITY_SIZE = { width: 160, height: 60 }
/** Smallest expanded size: room for a few child elements. */
export const EXPANDED_ACTIVITY_MIN_SIZE = { width: 360, height: 220 }
const EXPANDED_CONTENT_PADDING = 20

type SizedNode = {
  id: string
  parentId?: string
  position: { x: number; y: number }
  width?: number
  height?: number
  measured?: { width?: number; height?: number }
  data: Record<string, unknown>
}

/**
 * Flip `data.isExpanded` and resize to match: expanding grows the activity
 * to hold its (now visible) children, collapsing shrinks it back to the
 * collapsed task size.
 */
export const toggleActivityExpanded = <N extends SizedNode>(
  nodes: N[],
  id: string
): N[] => {
  const node = nodes.find((n) => n.id === id)
  if (!node) return nodes
  const expand = node.data.isExpanded !== true
  let size = COLLAPSED_ACTIVITY_SIZE
  if (expand) {
    let width = Math.max(
      node.width ?? node.measured?.width ?? 0,
      EXPANDED_ACTIVITY_MIN_SIZE.width
    )
    let height = Math.max(
      node.height ?? node.measured?.height ?? 0,
      EXPANDED_ACTIVITY_MIN_SIZE.height
    )
    for (const child of nodes) {
      if (child.parentId !== id) continue
      const cw = child.width ?? child.measured?.width ?? 0
      const ch = child.height ?? child.measured?.height ?? 0
      width = Math.max(width, child.position.x + cw + EXPANDED_CONTENT_PADDING)
      height = Math.max(height, child.position.y + ch + EXPANDED_CONTENT_PADDING)
    }
    size = { width, height }
  }
  return nodes.map((n) =>
    n.id === id
      ? {
          ...n,
          width: size.width,
          height: size.height,
          measured: { width: size.width, height: size.height },
          data: { ...n.data, isExpanded: expand },
        }
      : n
  )
}

/**
 * Shared editor for the two expandable activities (Subprocess &
 * Transaction). Mirrors develop's `BPMNExpandableUpdate`: a name field
 * plus a full-width button that expands / collapses the activity.
 */
export const BPMNExpandableEditPopover: React.FC<
  PopoverProps & { label: string; labelKey?: string }
> = ({ elementId, label, labelKey }) => {
  const { updateNodeData } = useReactFlow()
  const { setNodes } = useDiagramStore(
    useShallow((state) => ({ setNodes: state.setNodes }))
  )
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
        onClick={() => setNodes((ns) => toggleActivityExpanded(ns, elementId))}
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
