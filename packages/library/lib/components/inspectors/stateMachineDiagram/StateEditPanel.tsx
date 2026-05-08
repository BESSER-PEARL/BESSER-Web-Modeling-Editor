import { Box, Checkbox, FormControlLabel, MenuItem, Stack, TextField as MuiTextField, Select } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-3 inspector body for the `State` parent node. Editable fields:
 *
 * - `name` (via the shared `NodeStyleEditor` text input)
 * - `stereotype` — dropdown with the v3 set plus "no stereotype". Mirrors
 *   the v3 update panel at `packages/editor/.../uml-state/uml-state-update.tsx`.
 * - `italic` / `underline` — display flags rendered straight on the canvas.
 *
 * Body / fallback-body / code-block children are not edited here — each
 * has its own React-Flow node and its own panel body.
 */
const STEREOTYPES: { value: string; label: string }[] = [
  { value: "", label: "— none —" },
  { value: "initial", label: "«initial»" },
  { value: "final", label: "«final»" },
  { value: "decision", label: "«decision»" },
  { value: "fork", label: "«fork»" },
  { value: "merge", label: "«merge»" },
]

export const StateEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as StateNodeProps

  const update = (patch: Partial<StateNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<StateNodeProps>)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          stereotype
        </Typography>
        <Select
          size="small"
          value={data.stereotype ?? ""}
          onChange={(e) => {
            const v = String(e.target.value)
            update({ stereotype: v === "" ? null : v })
          }}
          sx={{ flex: 1 }}
        >
          {STEREOTYPES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <Stack direction="row" spacing={1}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.italic}
              onChange={(e) => update({ italic: e.target.checked })}
            />
          }
          label="italic"
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.underline}
              onChange={(e) => update({ underline: e.target.checked })}
            />
          }
          label="underline"
        />
      </Stack>

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="name"
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
      />
    </Box>
  )
}
