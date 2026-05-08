import {
  Box,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { NNReferenceNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-5 inspector for `NNReference`. Edits the visible label + the
 * `referenceTarget` id (chosen from layers in the same NNContainer
 * scope; falls back to a free-text input for cross-container
 * references).
 */
export const NNReferenceEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null
  const data = node.data as NNReferenceNodeProps

  const update = (patch: Partial<NNReferenceNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<NNReferenceNodeProps>)
  }

  // Same-parent layer candidates (typical case: this NNReference points
  // at a layer in the same container as itself).
  const candidates = nodes
    .filter(
      (n) =>
        n.id !== elementId &&
        n.parentId === node.parentId &&
        typeof n.type === "string" &&
        n.type.endsWith("Layer")
    )
    .map((n) => ({
      id: n.id,
      name: (n.data as { name?: string }).name ?? n.id,
    }))

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data as never}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="name"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 100 }}>
          referenceTarget
        </Typography>
        <Select
          size="small"
          value={data.referenceTarget ?? ""}
          onChange={(e) => update({ referenceTarget: String(e.target.value) })}
          displayEmpty
          sx={{ flex: 1 }}
        >
          <MenuItem value="">— none —</MenuItem>
          {candidates.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </Stack>
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="referenceTarget (manual override)"
        value={data.referenceTarget ?? ""}
        onChange={(e) => update({ referenceTarget: e.target.value })}
        helperText="Free-form id for cross-container references."
      />
    </Box>
  )
}
