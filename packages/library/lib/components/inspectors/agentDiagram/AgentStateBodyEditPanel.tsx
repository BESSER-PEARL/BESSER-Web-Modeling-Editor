import {
  Box,
  MenuItem,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { AgentStateBodyNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { RagDbFields } from "./RagDbFields"

/**
 * SA-2.2 #22 — body inspector with the full v3 RAG / DB-action field
 * surface area.
 *
 * Source-of-truth port: see `agent-state-update.tsx` `renderDbReplyEditor`
 * (~lines 809-943) — that v3 form lives on the body itself, but the
 * SA-4 split moved most of the action UI onto the parent
 * `AgentStateEditPanel`. This panel preserves direct field editing for
 * users who pop the body inspector directly (e.g., from the canvas
 * popover) and keeps the v3 → v4 → v3 round-trip lossless when the
 * user edits a body in isolation.
 *
 * Fields exposed: `name`, `replyType`, `code` (Python CodeMirror when
 * `replyType === 'code'`), and the shared RAG/DB block via
 * `RagDbFields` (`ragDatabaseName` / `dbSelectionType` /
 * `dbCustomName` / `dbQueryMode` / `dbOperation` / `dbSqlQuery`).
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

  const ragDatabaseOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          nodes
            .filter((n) => n.type === "AgentRagElement")
            .map((n) => ((n.data as { name?: string }).name ?? "").trim())
            .filter((s) => s.length > 0)
        )
      ),
    [nodes]
  )

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

      {data.replyType === "code" && (
        <Box
          sx={{
            border: "1px solid var(--besser-gray, #ccc)",
            borderRadius: "4px",
            "& .cm-editor": { fontSize: "13px", minHeight: 120 },
          }}
        >
          <CodeMirror
            value={data.code ?? ""}
            extensions={[python()]}
            onChange={(v) => update({ code: v })}
            basicSetup={{
              lineNumbers: true,
              tabSize: 4,
              indentOnInput: true,
            }}
            placeholder="def action_name(session: AgentSession):\n    …"
          />
        </Box>
      )}

      {(data.replyType === "rag" ||
        data.replyType === "db_reply") && (
        <>
          <DividerLine width="100%" />
          <Typography variant="caption">
            {data.replyType === "rag" ? "RAG" : "DB action"} settings
          </Typography>
          <RagDbFields
            value={data}
            onChange={(patch) => update(patch)}
            ragDatabaseOptions={ragDatabaseOptions}
            showRag={data.replyType === "rag"}
            showDb={data.replyType === "db_reply"}
          />
        </>
      )}
    </Box>
  )
}
