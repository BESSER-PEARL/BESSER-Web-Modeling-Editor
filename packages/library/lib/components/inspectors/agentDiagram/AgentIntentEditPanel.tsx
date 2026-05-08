import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentIntentNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-4 inspector for `AgentIntent`. Edits the intent name; description
 * and body rows live on dedicated child nodes (with their own panels).
 */
export const AgentIntentEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as AgentIntentNodeProps

  const update = (patch: Partial<AgentIntentNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentIntentNodeProps>)
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
        label="intent name"
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
      />
    </Box>
  )
}
