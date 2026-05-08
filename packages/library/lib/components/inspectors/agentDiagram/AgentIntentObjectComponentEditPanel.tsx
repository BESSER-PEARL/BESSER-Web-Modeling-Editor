import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentIntentObjectComponentNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-4 inspector for `AgentIntentObjectComponent`. Edits the entity name
 * and slot configuration that bind a slot of the intent to an entity
 * defined elsewhere in the agent model.
 */
export const AgentIntentObjectComponentEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as AgentIntentObjectComponentNodeProps

  const update = (patch: Partial<AgentIntentObjectComponentNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentIntentObjectComponentNodeProps>)
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
        label="name"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="entity"
        value={data.entity ?? ""}
        onChange={(e) => update({ entity: e.target.value })}
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="slot"
        value={data.slot ?? ""}
        onChange={(e) => update({ slot: e.target.value })}
      />
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="value"
        value={data.value ?? ""}
        onChange={(e) => update({ value: e.target.value })}
        placeholder="optional fixed value"
      />
    </Box>
  )
}
