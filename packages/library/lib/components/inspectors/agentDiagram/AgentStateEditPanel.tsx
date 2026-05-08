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
import { AgentStateNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-4 inspector for `AgentState`. Same pattern as SA-3's
 * `StateEditPanel` plus the `replyType` discriminator that drives the
 * agent-state child body's render mode (text / image / json / llm /
 * code / rag / db_reply).
 */
const REPLY_TYPES: { value: string; label: string }[] = [
  { value: "text", label: "text" },
  { value: "image", label: "image" },
  { value: "json", label: "json" },
  { value: "llm", label: "llm" },
  { value: "code", label: "code" },
  { value: "rag", label: "rag" },
  { value: "db_reply", label: "db_reply" },
]

const STEREOTYPES: { value: string; label: string }[] = [
  { value: "", label: "— none —" },
  { value: "initial", label: "«initial»" },
  { value: "final", label: "«final»" },
  { value: "intent", label: "«intent»" },
]

export const AgentStateEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )
  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as AgentStateNodeProps

  const update = (patch: Partial<AgentStateNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<AgentStateNodeProps>)
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
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
      />

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          replyType
        </Typography>
        <Select
          size="small"
          value={data.replyType ?? "text"}
          onChange={(e) => update({ replyType: String(e.target.value) })}
          sx={{ flex: 1 }}
        >
          {REPLY_TYPES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          stereotype
        </Typography>
        <Select
          size="small"
          value={data.stereotype ?? ""}
          onChange={(e) => {
            const v = String(e.target.value)
            update({ stereotype: v === "" ? null : v })
          }}
          sx={{ flex: 1 }}
        >
          {STEREOTYPES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <Stack direction="row" spacing={1}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.italic}
              onChange={(e) => update({ italic: e.target.checked })}
            />
          }
          label="italic"
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.underline}
              onChange={(e) => update({ underline: e.target.checked })}
            />
          }
          label="underline"
        />
      </Stack>
    </Box>
  )
}
