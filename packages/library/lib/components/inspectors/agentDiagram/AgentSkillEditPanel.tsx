import { Box, TextField as MuiTextField } from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentSkillNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { useTranslation } from "@/i18n"
import { Warning } from "./AgentActionEditor"

/**
 * Inspector for `AgentSkill`.
 *
 * Develop source: `agent-state-diagram/agent-skill/agent-skill-update.tsx`
 * — skill name, optional description, markdown content.
 */
export const AgentSkillEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { t } = useTranslation()
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as AgentSkillNodeProps
  // smart-gen a950afe9: tools / skills / workspaces are only used by a
  // reasoning state.
  const hasReasoningState = nodes.some(
    (n) =>
      n.type === "AgentState" &&
      (n.data as { stateType?: string } | undefined)?.stateType === "reasoning"
  )

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
      {!hasReasoningState && (
        <Warning>{t("packages.AgentDiagram.skillReasoningStateWarning", "Skills can only be used by a reasoning state. Add a reasoning state to use this skill")}</Warning>
      )}
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
      />
      <DividerLine width="100%" />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label={t("packages.AgentDiagram.skillName", "Skill name")}
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        label={t("packages.AgentDiagram.description", "Description")}
        placeholder={t("packages.AgentDiagram.skillDescriptionPlaceholder", "Optional short description")}
        value={data.description ?? ""}
        onChange={(e) => update({ description: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={4}
        label={t("packages.AgentDiagram.markdownContent", "Markdown content")}
        placeholder={t("packages.AgentDiagram.skillContentPlaceholder", "# Skill\n\nInstructions in markdown...")}
        value={data.content ?? ""}
        onChange={(e) => update({ content: e.target.value })}
      />
    </Box>
  )
}
