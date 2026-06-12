import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentSkillNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector for `AgentSkill`.
 *
 * Develop source: `agent-state-diagram/agent-skill/agent-skill-update.tsx`
 * — skill name, optional description, markdown content.
 */
export const AgentSkillEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as AgentSkillNodeProps

  const update = (patch: Partial<AgentSkillNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentSkillNodeProps>)
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
        label="Skill name"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        label="Description"
        placeholder="Optional short description"
        value={data.description ?? ""}
        onChange={(e) => update({ description: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={4}
        label="Markdown content"
        placeholder={"# Skill\n\nInstructions in markdown..."}
        value={data.content ?? ""}
        onChange={(e) => update({ content: e.target.value })}
      />
    </Box>
  )
}
