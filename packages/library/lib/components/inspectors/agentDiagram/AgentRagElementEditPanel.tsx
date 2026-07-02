import {
  Box,
  MenuItem,
  Select,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentRagElementNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector for `AgentRagElement`.
 *
 * The standalone RAG cylinder carries its display name plus an
 * `llm_name` reference: the DB/RAG selection fields (`ragDatabaseName`,
 * `dbCustomName`, `dbSelectionType`, `dbQueryMode`, `dbOperation`,
 * `dbSqlQuery`) were moved off this inspector — they belong to the
 * AgentState `db_reply` reply mode (see `AgentStateEditPanel.tsx`).
 *
 * The LLM picker mirrors develop's
 * `agent-rag-element-update.tsx`: "Name of RAG DB" text field plus an
 * "LLM" dropdown offering "(use default)" and the names of registered
 * `AgentLLM` definition nodes.
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

  // Names of registered AgentLLM definitions. Keep a non-registry
  // current value selectable so opening the inspector never silently
  // drops a loaded `llm_name`.
  const llmNames = Array.from(
    new Set(
      nodes
        .filter((n) => (n.type as string) === "AgentLLM")
        .map((n) => ((n.data as { name?: string }).name ?? "").trim())
        .filter((name) => name.length > 0)
    )
  )
  const currentLlm = data.llm_name ?? ""
  if (currentLlm && !llmNames.includes(currentLlm)) {
    llmNames.push(currentLlm)
  }

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

      <Typography variant="caption">LLM</Typography>
      <Select
        size="small"
        fullWidth
        displayEmpty
        value={currentLlm}
        onChange={(e) => update({ llm_name: String(e.target.value) })}
      >
        <MenuItem value="">(use default)</MenuItem>
        {llmNames.map((name) => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
      </Select>

      {/* Develop `agent-rag-element-update.tsx` L71-94: LLM prompt prefix,
          K (retrieved chunks, clamped >= 1), num previous messages
          (clamped >= 0). */}
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        label="LLM Prompt Prefix"
        value={data.llm_prompt ?? ""}
        onChange={(e) => update({ llm_prompt: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        type="number"
        label="K (retrieved chunks)"
        value={data.k ?? 4}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10)
          update({ k: Math.max(1, Number.isNaN(parsed) ? 4 : parsed) })
        }}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        type="number"
        label="Num Previous Messages"
        value={data.num_previous_messages ?? 0}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10)
          update({
            num_previous_messages: Math.max(
              0,
              Number.isNaN(parsed) ? 0 : parsed
            ),
          })
        }}
      />
    </Box>
  )
}
