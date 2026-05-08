import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { StateActionNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-3 inspector body for `StateActionNode`. Editable: `name` plus the
 * (optional) `code` body. Kept deliberately small — the v3 update panel
 * was a single-textfield rename.
 */
export const StateActionNodeEditPanel: React.FC<PopoverProps> = ({
  elementId,
}) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as StateActionNodeProps

  const update = (patch: Partial<StateActionNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<StateActionNodeProps>)
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
        label="action name"
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={4}
        label="code"
        value={data.code ?? ""}
        onChange={(e) => update({ code: e.target.value })}
        placeholder="Python / BAL action code…"
      />
    </Box>
  )
}
