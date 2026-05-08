import {
  Box,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentStateBodyNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"

/**
 * SA-4 inspector body for `AgentStateBody` / `AgentStateFallbackBody`.
 *
 * Mirrors SA-3's `StateBodyEditPanel` pattern with a `kind` field
 * (entry / do / exit) that round-trips through the migrator. Adds the
 * `replyType` carry-through so v3 fixtures storing reply discriminators
 * on the body row preserve them losslessly.
 *
 * The `code` field surfaces only when `replyType === 'code'`.
 */
const KINDS: { value: string; label: string }[] = [
  { value: "", label: "— none —" },
  { value: "entry", label: "entry" },
  { value: "do", label: "do" },
  { value: "exit", label: "exit" },
  { value: "on", label: "on transition" },
]

const REPLY_TYPES = [
  "text",
  "image",
  "json",
  "llm",
  "code",
  "rag",
  "db_reply",
] as const

export const AgentStateBodyEditPanel: React.FC<PopoverProps> = ({
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

  const data = node.data as AgentStateBodyNodeProps & { kind?: string }

  const update = (patch: Partial<typeof data>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    update({ [key]: value } as Partial<typeof data>)
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
        label="body"
        value={data.name ?? ""}
        onChange={(e) => update({ name: e.target.value })}
      />

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          kind
        </Typography>
        <Select
          size="small"
          value={data.kind ?? ""}
          onChange={(e) => {
            const v = String(e.target.value)
            update({ kind: v === "" ? undefined : v })
          }}
          sx={{ flex: 1 }}
        >
          {KINDS.map((k) => (
            <MenuItem key={k.value} value={k.value}>
              {k.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>

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
          {REPLY_TYPES.map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      {data.replyType === "code" ? (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          multiline
          minRows={4}
          label="code"
          value={data.code ?? ""}
          onChange={(e) => update({ code: e.target.value })}
          placeholder="Action body"
        />
      ) : null}
    </Box>
  )
}
