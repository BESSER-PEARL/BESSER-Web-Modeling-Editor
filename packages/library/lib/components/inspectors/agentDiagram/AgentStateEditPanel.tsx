import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
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
import { generateUUID } from "@/utils"
import {
  AgentStateBodyRow,
  AgentStateNodeProps,
} from "@/types"
import {
  DividerLine,
  NodeStyleEditor,
  Typography,
} from "@/components/ui"
import { DeleteIcon } from "@/components/Icon"
import { PopoverProps } from "@/components/popovers/types"
import { RagDbFields } from "./RagDbFields"
import { InspectorSectionHeader, AddRowButton } from "../_shared"

/**
 * SA-FIX-Agent — full AgentState body editor.
 *
 * Source-of-truth port: `packages/editor/src/main/packages/
 * agent-state-diagram/agent-state/agent-state-update.tsx` (~960 LoC).
 *
 * Mirrors v3's two-section layout:
 *   1. Agent Action — radio row picks a single body reply mode
 *      (text / llm / rag / db_reply / code) and renders the body
 *      editor for that mode below.
 *   2. Agent Fallback Action — same radio + editor pattern for the
 *      fallback bodies.
 *
 * SA-FIX-Agent (delta from SA-2.2): bodies are now stored on the
 * parent's `data.bodies` array (inline, like a Class node's
 * attributes) rather than as separate React-Flow children. Switching
 * modes deletes existing rows of the wrong reply type within the
 * relevant section (`fallback` vs not-fallback) and creates one of the
 * new type when needed (mirroring v3's `componentDidMount` / radio
 * onChange behaviour).
 *
 * The RAG dropdown is sourced from sibling `AgentRagElement` nodes per
 * the v3 source. PC-7 #3: when no AgentRagElement is present the field
 * is disabled with an inline "Create an AgentRagElement from the
 * palette first" helper rather than falling back to a free-text input.
 */

type ReplyMode = "text" | "llm" | "rag" | "db_reply" | "code"

const REPLY_MODES: { value: ReplyMode; label: string }[] = [
  { value: "text", label: "Text Reply" },
  { value: "llm", label: "LLM automatic reply" },
  { value: "rag", label: "RAG reply" },
  { value: "db_reply", label: "DB action" },
  { value: "code", label: "Python Code" },
]

const RAG_PROMPT_DEFAULT = "RAG reply (select database)"
const CODE_BODY_DEFAULT =
  "def action_name(session: AgentSession):\n\n\n\n\n"
const LLM_BODY_DEFAULT = "AI response 🪄"

const getRagDisplayName = (databaseName?: string): string => {
  const trimmed = (databaseName || "").trim()
  return trimmed.length
    ? `RAG reply using ${trimmed} database`
    : RAG_PROMPT_DEFAULT
}

const getDbDisplayName = (
  dbSelectionType?: string,
  dbCustomName?: string,
  dbQueryMode?: string,
  dbOperation?: string
): string => {
  const customDatabaseName = (dbCustomName || "").trim()
  const databaseLabel =
    dbSelectionType === "custom"
      ? customDatabaseName.length
        ? customDatabaseName
        : "custom database"
      : "Default database"
  const modeLabel = dbQueryMode === "sql" ? "SQL" : "LLM query"
  const operationLabel =
    dbOperation === "any" || !dbOperation ? "Any" : dbOperation.toUpperCase()
  return `DB action using ${databaseLabel} (${modeLabel}, ${operationLabel})`
}

type Section = "main" | "fallback"

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
  const mainBodies: AgentStateBodyRow[] = data.bodies ?? []
  const fallbackBodies: AgentStateBodyRow[] = data.fallbackBodies ?? []

  /* ─────────────────────── Top-level node helpers ─────────────────────── */

  const updateNode = (patch: Partial<AgentStateNodeProps>) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === elementId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const handleDataFieldUpdate = (key: string, value: string) => {
    updateNode({ [key]: value } as Partial<AgentStateNodeProps>)
  }

  /**
   * v3 parity: fallback rows live in their own array (`data.fallbackBodies`)
   * rather than carrying a `kind: "fallback"` discriminator on each row.
   * Helpers below route reads/writes to the right array based on `section`.
   */
  const replaceSection = (
    section: Section,
    mapper: (rows: AgentStateBodyRow[]) => AgentStateBodyRow[]
  ) => {
    if (section === "fallback") {
      updateNode({ fallbackBodies: mapper(fallbackBodies) })
    } else {
      updateNode({ bodies: mapper(mainBodies) })
    }
  }

  const sectionForRow = (rowId: string): Section =>
    mainBodies.some((r) => r.id === rowId) ? "main" : "fallback"

  /* ─────────────────────── Body / Fallback helpers ────────────────────── */

  const ragDatabaseOptions = React.useMemo(() => {
    return Array.from(
      new Set(
        nodes
          .filter((n) => n.type === "AgentRagElement")
          .map((n) => ((n.data as { name?: string }).name ?? "").trim())
          .filter((s) => s.length > 0)
      )
    )
  }, [nodes])

  const sectionRows = (section: Section): AgentStateBodyRow[] =>
    section === "fallback" ? fallbackBodies : mainBodies

  const getActiveMode = (section: Section): ReplyMode => {
    const rows = sectionRows(section)
    const order: ReplyMode[] = ["rag", "db_reply", "llm", "code", "text"]
    for (const m of order) {
      if (rows.some((r) => r.replyType === m)) return m
    }
    return "text"
  }

  const updateRow = (
    rowId: string,
    patch: Partial<AgentStateBodyRow>
  ) => {
    replaceSection(sectionForRow(rowId), (rows) =>
      rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
    )
  }

  const removeRow = (rowId: string) => {
    replaceSection(sectionForRow(rowId), (rows) =>
      rows.filter((r) => r.id !== rowId)
    )
  }

  const addRow = (
    section: Section,
    init: Partial<AgentStateBodyRow> & { name?: string }
  ) => {
    const newRow: AgentStateBodyRow = {
      id: generateUUID(),
      replyType: "text",
      ...init,
    }
    replaceSection(section, (rows) => [...rows, newRow])
  }

  const removeRowsWhere = (
    section: Section,
    predicate: (r: AgentStateBodyRow) => boolean
  ) => {
    replaceSection(section, (rows) => rows.filter((r) => !predicate(r)))
  }

  const setMode = (section: Section, next: ReplyMode) => {
    const rows = sectionRows(section)
    if (next === "text") {
      // Remove all non-text rows in this section.
      removeRowsWhere(section, (r) => r.replyType !== "text")
      // No auto-create — user adds text bodies via the "+ add" button.
      return
    }
    const hasMode = rows.some((r) => r.replyType === next)
    removeRowsWhere(section, (r) => r.replyType !== next)
    if (hasMode) return
    switch (next) {
      case "llm":
        addRow(section, { name: LLM_BODY_DEFAULT, replyType: "llm" })
        break
      case "code":
        addRow(section, {
          name: CODE_BODY_DEFAULT,
          replyType: "code",
          code: CODE_BODY_DEFAULT,
        })
        break
      case "rag":
        addRow(section, {
          name: getRagDisplayName(""),
          replyType: "rag",
          ragDatabaseName: "",
        })
        break
      case "db_reply": {
        const dbSelectionType = "default"
        const dbCustomName = ""
        const dbQueryMode = "llm_query"
        const dbOperation = "any"
        addRow(section, {
          name: getDbDisplayName(
            dbSelectionType,
            dbCustomName,
            dbQueryMode,
            dbOperation
          ),
          replyType: "db_reply",
          dbSelectionType,
          dbCustomName,
          dbQueryMode,
          dbOperation,
          dbSqlQuery: "",
        })
        break
      }
    }
  }

  const renderBodyEditor = (section: Section) => {
    const mode = getActiveMode(section)
    const rows = sectionRows(section)

    if (mode === "text") {
      const textRows = rows.filter((r) => r.replyType === "text")
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {textRows.map((b) => (
            <Stack
              key={b.id}
              direction="row"
              alignItems="center"
              spacing={0.5}
            >
              <MuiTextField
                size="small"
                variant="outlined"
                fullWidth
                placeholder="reply text"
                value={b.name ?? ""}
                onChange={(e) => updateRow(b.id, { name: e.target.value })}
              />
              <IconButton
                size="small"
                onClick={() => removeRow(b.id)}
                aria-label="Remove text body"
              >
                <DeleteIcon width={14} height={14} />
              </IconButton>
            </Stack>
          ))}
          <Box sx={{ alignSelf: "flex-start" }}>
            <AddRowButton
              label="add text body"
              onClick={() => addRow(section, { name: "", replyType: "text" })}
            />
          </Box>
        </Box>
      )
    }

    if (mode === "llm") {
      const llmRow = rows.find((r) => r.replyType === "llm")
      if (!llmRow) {
        return (
          <Typography variant="caption">Initialising LLM body…</Typography>
        )
      }
      return (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          multiline
          minRows={3}
          label="System prompt"
          value={llmRow.name ?? ""}
          onChange={(e) => updateRow(llmRow.id, { name: e.target.value })}
        />
      )
    }

    if (mode === "code") {
      const codeRow = rows.find((r) => r.replyType === "code")
      if (!codeRow) {
        return (
          <Typography variant="caption">Initialising code body…</Typography>
        )
      }
      // v3 stored the code on `name`; v4 added a `code` field. Prefer
      // `code` when set, falling back to `name` for legacy fixtures.
      const codeValue =
        (typeof codeRow.code === "string" && codeRow.code) || codeRow.name || ""
      return (
        <Box
          sx={{
            border: "1px solid var(--besser-gray, #ccc)",
            borderRadius: "4px",
            "& .cm-editor": { fontSize: "13px", minHeight: 150 },
          }}
        >
          <CodeMirror
            value={codeValue}
            extensions={[python()]}
            onChange={(v) => updateRow(codeRow.id, { code: v, name: v })}
            basicSetup={{
              lineNumbers: true,
              tabSize: 4,
              indentOnInput: true,
            }}
            placeholder="def action_name(session: AgentSession):\n    …"
          />
        </Box>
      )
    }

    if (mode === "rag") {
      const ragRow = rows.find((r) => r.replyType === "rag")
      if (!ragRow) {
        return (
          <Typography variant="caption">Initialising RAG body…</Typography>
        )
      }
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <RagDbFields
            value={ragRow}
            onChange={(patch) => {
              const next = { ...ragRow, ...patch }
              updateRow(ragRow.id, {
                ...patch,
                name: getRagDisplayName(next.ragDatabaseName),
              })
            }}
            ragDatabaseOptions={ragDatabaseOptions}
            showRag
            showDb={false}
          />
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            label="RAG prompt (optional)"
            value={ragRow.name ?? ""}
            onChange={(e) => updateRow(ragRow.id, { name: e.target.value })}
            helperText="Override the auto-generated RAG label."
          />
        </Box>
      )
    }

    if (mode === "db_reply") {
      const dbRow = rows.find((r) => r.replyType === "db_reply")
      if (!dbRow) {
        return (
          <Typography variant="caption">
            Initialising database action…
          </Typography>
        )
      }
      return (
        <RagDbFields
          value={dbRow}
          onChange={(patch) => {
            const next = { ...dbRow, ...patch }
            updateRow(dbRow.id, {
              ...patch,
              name: getDbDisplayName(
                next.dbSelectionType,
                next.dbCustomName,
                next.dbQueryMode,
                next.dbOperation
              ),
            })
          }}
          showRag={false}
          showDb
        />
      )
    }

    return null
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
        onChange={(e) => updateNode({ name: e.target.value })}
      />

      {/*
       * Match v3 fork: AgentState inspector exposed only name + italic /
       * underline / bodies. The stereotype selector was a SA-4 addition
       * that the BESSER metamodel doesn't use, so it's removed from the
       * inspector. The `stereotype` field still exists on the node data
       * for round-trip preservation but is not editable here.
       */}

      <Stack direction="row" spacing={1}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.italic}
              onChange={(e) => updateNode({ italic: e.target.checked })}
            />
          }
          label="italic"
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.underline}
              onChange={(e) => updateNode({ underline: e.target.checked })}
            />
          }
          label="underline"
        />
      </Stack>

      <DividerLine width="100%" />

      <InspectorSectionHeader>Agent Action</InspectorSectionHeader>
      <Select
        size="small"
        fullWidth
        value={getActiveMode("main")}
        onChange={(e) => setMode("main", e.target.value as ReplyMode)}
      >
        {REPLY_MODES.map((m) => (
          <MenuItem key={`body-${m.value}`} value={m.value}>
            {m.label}
          </MenuItem>
        ))}
      </Select>
      {renderBodyEditor("main")}

      <DividerLine width="100%" />

      <InspectorSectionHeader>Agent Fallback Action</InspectorSectionHeader>
      <Select
        size="small"
        fullWidth
        value={getActiveMode("fallback")}
        onChange={(e) => setMode("fallback", e.target.value as ReplyMode)}
      >
        {REPLY_MODES.map((m) => (
          <MenuItem key={`fallback-${m.value}`} value={m.value}>
            {m.label}
          </MenuItem>
        ))}
      </Select>
      {renderBodyEditor("fallback")}
    </Box>
  )
}
