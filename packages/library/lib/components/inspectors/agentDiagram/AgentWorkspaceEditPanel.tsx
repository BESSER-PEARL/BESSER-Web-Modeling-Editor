import {
  Box,
  Checkbox,
  FormControlLabel,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentWorkspaceNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector for `AgentWorkspace`.
 *
 * Develop source:
 * `agent-state-diagram/agent-workspace/agent-workspace-update.tsx` —
 * workspace name, filesystem path, description, writable checkbox,
 * max read bytes.
 */
export const AgentWorkspaceEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as AgentWorkspaceNodeProps

  const update = (patch: Partial<AgentWorkspaceNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentWorkspaceNodeProps>)
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
        label="Workspace name"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="Filesystem path"
        placeholder="/path/to/workspace"
        value={data.path ?? ""}
        onChange={(e) => update({ path: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        label="Description"
        placeholder="Optional description"
        value={data.description ?? ""}
        onChange={(e) => update({ description: e.target.value })}
      />

      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={data.writable ?? true}
            onChange={(e) => update({ writable: e.target.checked })}
          />
        }
        label="Writable"
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        type="number"
        label="Max read bytes"
        value={data.max_read_bytes ?? 200000}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10)
          update({ max_read_bytes: Number.isNaN(parsed) ? 0 : parsed })
        }}
      />
    </Box>
  )
}
