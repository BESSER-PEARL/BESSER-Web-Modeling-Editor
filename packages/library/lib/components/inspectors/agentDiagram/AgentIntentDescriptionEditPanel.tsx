import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentIntentDescriptionNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-4 inspector for `AgentIntentDescription`. A multi-line free-text
 * field stored on `data.name`. The migrator mirrors this value back onto
 * the parent intent's `intent_description` so the round-trip retains the
 * v3 wire shape.
 */
export const AgentIntentDescriptionEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as AgentIntentDescriptionNodeProps

  const update = (patch: Partial<AgentIntentDescriptionNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentIntentDescriptionNodeProps>)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />

      <Typography variant="caption">description</Typography>
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={3}
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="Description of what this intent represents"
      />
    </Box>
  )
}
