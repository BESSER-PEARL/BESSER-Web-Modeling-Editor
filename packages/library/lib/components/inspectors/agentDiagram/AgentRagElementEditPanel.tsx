import {
  Box,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentRagElementNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-FIX-AGENT-OCL inspector for `AgentRagElement`.
 *
 * The standalone RAG cylinder is now a name-only element: the
 * DB/RAG selection fields (`ragDatabaseName`, `dbCustomName`,
 * `dbSelectionType`, `dbQueryMode`, `dbOperation`, `dbSqlQuery`) were
 * moved off this inspector — they belong to the AgentState `db_reply`
 * reply mode (see `AgentStateEditPanel.tsx`). Keeping this panel
 * focused on `name` matches the underlying typed shape
 * (`AgentRagElementNodeProps = DefaultNodeProps`) and the v3 visual
 * (cylinder showing a single label).
 */
export const AgentRagElementEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as AgentRagElementNodeProps

  const update = (patch: Partial<AgentRagElementNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentRagElementNodeProps>)
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
    </Box>
  )
}
