import { Box, MenuItem, Select, Stack, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateBodyNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-3 inspector body for `StateBody` and `StateFallbackBody` rows.
 *
 * Editable fields:
 * - `name`
 * - body-kind dropdown — v3 represented entry / do / exit on the
 *   element type itself; v4 keeps `StateBody` vs `StateFallbackBody`
 *   separate, but the inspector exposes a free-form kind tag stored
 *   inline on the `name` (e.g. `"entry / setup()"`).
 * - colors via the shared `NodeStyleEditor`.
 */
const BODY_KINDS = [
  { value: "entry", label: "entry" },
  { value: "do", label: "do" },
  { value: "exit", label: "exit" },
  { value: "transition", label: "on transition" },
]

export const StateBodyEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as StateBodyNodeProps & { code?: string; kind?: string }

  const update = (patch: Partial<typeof data>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<typeof data>)
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
          kind
        </Typography>
        <Select
          size="small"
          value={data.kind ?? ""}
          onChange={(e) => update({ kind: String(e.target.value) || undefined })}
          displayEmpty
          sx={{ flex: 1 }}
        >
          <MenuItem value="">— unspecified —</MenuItem>
          {BODY_KINDS.map((k) => (
            <MenuItem key={k.value} value={k.value}>
              {k.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="label"
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={3}
        label="code"
        value={data.code ?? ""}
        onChange={(e) => update({ code: e.target.value })}
        placeholder="Action body (Python / BAL)…"
      />
    </Box>
  )
}
