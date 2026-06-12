import {
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentReasoningStateNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * Inspector for `AgentReasoningState`.
 *
 * Develop source: `agent-state-diagram/agent-reasoning-state/
 * agent-reasoning-state-update.tsx`. Fields, in develop order:
 * state name, LLM name picker, max steps, enable-task-planning +
 * stream-steps checkboxes, system prompt, fallback message.
 *
 * The LLM picker offers "(use default)" (empty value) plus the names of
 * any `AgentLLM` definition nodes in the model. AgentLLM definitions
 * arrive with the multi-LLM wave, so today the list is usually empty —
 * the picker degrades to the "(use default)" entry plus the current
 * value (when a loaded model carries a non-empty `llm_name`, it is kept
 * selectable so opening the inspector never silently drops it).
 */
export const AgentReasoningStateEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as AgentReasoningStateNodeProps

  // Names of registered AgentLLM definitions (multi-LLM wave populates
  // these; the seam is live already so no inspector change is needed
  // when they land).
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

  const update = (patch: Partial<AgentReasoningStateNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentReasoningStateNodeProps>)
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
        label="State name"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <Typography variant="caption">LLM name</Typography>
      <Select
        size="small"
        fullWidth
        displayEmpty
        value={currentLlm}
        onChange={(e) => update({ llm_name: e.target.value })}
      >
        <MenuItem value="">(use default)</MenuItem>
        {llmNames.map((name) => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
      </Select>

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        type="number"
        label="Max steps"
        value={data.max_steps ?? 8}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10)
          update({ max_steps: Number.isNaN(parsed) ? 0 : parsed })
        }}
      />

      <Stack direction="column">
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={data.enable_task_planning ?? true}
              onChange={(e) =>
                update({ enable_task_planning: e.target.checked })
              }
            />
          }
          label="Enable task planning"
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={data.stream_steps ?? true}
              onChange={(e) => update({ stream_steps: e.target.checked })}
            />
          }
          label="Stream steps"
        />
      </Stack>

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        label="System prompt"
        placeholder="Optional system prompt prefix for this state"
        value={data.system_prompt ?? ""}
        onChange={(e) => update({ system_prompt: e.target.value })}
      />

      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        multiline
        minRows={2}
        label="Fallback message"
        placeholder="Message returned if the reasoning loop fails"
        value={data.fallback_message ?? ""}
        onChange={(e) => update({ fallback_message: e.target.value })}
      />
    </Box>
  )
}
