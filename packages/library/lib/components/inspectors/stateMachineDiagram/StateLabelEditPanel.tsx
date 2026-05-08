import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateMarkerNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Shared inspector body for the marker-style state nodes:
 * `StateInitialNode`, `StateFinalNode`, `StateMergeNode`,
 * `StateForkNode`, `StateForkNodeHorizontal`. Only the `name` is
 * editable plus the standard color controls.
 *
 * SA-FIX-State (PC-6 #2): v3 marked Initial / Final / Fork /
 * ForkHorizontal as `updatable: false` and hid the inspector form
 * entirely. Honour that invariant by short-circuiting to `null` for
 * those types — the registry still routes the popover here, so the
 * empty body collapses the inspector. `StateMergeNode` is registered
 * separately to its dedicated decisions editor in `index.ts` and so
 * never reaches this panel in practice.
 */
const NON_UPDATABLE_TYPES = new Set([
  "StateInitialNode",
  "StateFinalNode",
  "StateForkNode",
  "StateForkNodeHorizontal",
])

export const StateLabelEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  // PC-6 #2: render nothing for non-updatable marker nodes.
  if (NON_UPDATABLE_TYPES.has(node.type as string)) return null

  const data = node.data as StateMarkerNodeProps

  const update = (patch: Partial<StateMarkerNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<StateMarkerNodeProps>)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="label"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />
    </Box>
  )
}
