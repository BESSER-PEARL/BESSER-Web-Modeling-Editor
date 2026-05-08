import { Box, MenuItem, Select, Stack, TextField as MuiTextField } from "@mui/material"
import React, { useMemo } from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateObjectNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { diagramBridge } from "@/services/diagramBridge"

/**
 * SA-3 inspector body for `StateObjectNode`. Editable fields:
 *
 * - `name` (instance name, e.g. `myInstance`)
 * - `classId` — class-picker driven by
 *   `diagramBridge.getAvailableClasses()` (resolves spec open question
 *   4: yes, the link is preserved on `node.data.classId`).
 *
 * `className` mirrors the picked class for display and gets pinned at
 * commit time so the canvas can render `myInstance: Customer` without
 * re-querying the bridge on every render.
 */
export const StateObjectNodeEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)

  const availableClasses = useMemo(() => {
    try {
      return diagramBridge.getAvailableClasses()
    } catch {
      return []
    }
  }, [nodes])

  if (!node) return null

  const data = node.data as StateObjectNodeProps

  const update = (patch: Partial<StateObjectNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<StateObjectNodeProps>)
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
        label="instance name"
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
      />

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          class
        </Typography>
        <Select
          size="small"
          value={data.classId ?? ""}
          displayEmpty
          onChange={(e) => {
            const v = String(e.target.value)
            if (!v) {
              update({ classId: undefined, className: undefined })
              return
            }
            const match = availableClasses.find((c) => c.id === v)
            update({
              classId: v,
              className: match?.name ?? data.className,
            })
          }}
          sx={{ flex: 1 }}
        >
          <MenuItem value="">— Unlinked —</MenuItem>
          {availableClasses.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </Stack>
    </Box>
  )
}
