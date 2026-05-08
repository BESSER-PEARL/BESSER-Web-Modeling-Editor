import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentIntentBodyNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-4 inspector for `AgentIntentBody` — one training utterance / user
 * phrase row. Renders the row as a multiline textarea: the body's `name`
 * holds the entire phrase. The user can paste multiple phrases joined by
 * newlines and the intent runtime will treat each line as a separate
 * training example.
 */
export const AgentIntentBodyEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as AgentIntentBodyNodeProps

  const update = (patch: Partial<AgentIntentBodyNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentIntentBodyNodeProps>)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />

      <Typography variant="caption">training phrases (one per line)</Typography>
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={4}
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
        placeholder={"hello\nhi there\nhey agent"}
      />
    </Box>
  )
}
