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
  AgentStateBodyNodeProps,
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
import { Node } from "@xyflow/react"

/**
 * SA-2.2 #21 — full AgentState body editor.
 *
 * Source-of-truth port: `packages/editor/src/main/packages/
 * agent-state-diagram/agent-state/agent-state-update.tsx` (~960 LoC).
 *
 * Mirrors v3's two-section layout:
 *   1. Agent Action — radio row picks a single body reply mode
 *      (text / llm / rag / db_reply / code) and renders the body
 *      editor for that mode below.
 *   2. Agent Fallback Action — same radio + editor pattern for the
 *      `AgentStateFallbackBody` children.
 *
 * Children of either kind hang off this `AgentState` via React-Flow
 * `parentId` (consistent with SA-3 / SA-4). Switching modes deletes
 * sibling bodies of the wrong reply type and creates one of the new
 * type when needed (mirroring v3's `componentDidMount` / radio
 * onChange behaviour).
 *
 * The RAG dropdown is sourced from sibling `AgentRagElement` nodes
 * via `nodes.filter(n => n.type === 'AgentRagElement').map(...)` per
 * the v3 source, with a free-text fallback when no RAG elements
 * exist. The DB-action editor reuses the shared `RagDbFields`
 * component so the same field set is available on
 * `AgentRagElementEditPanel` (SA-2.2 #22).
 */

const STEREOTYPES: { value: string; label: string }[] = [
  { value: "", label: "— none —" },
  { value: "initial", label: "«initial»" },
  { value: "final", label: "«final»" },
  { value: "intent", label: "«intent»" },
]

type ReplyMode = "text" | "llm" | "rag" | "db_reply" | "code"

const REPLY_MODES: { value: ReplyMode; label: string }[] = [
  { value: "text", label: "Text Reply" },
  { value: "llm", label: "LLM automatic reply" },
  { value: "rag", label: "RAG reply" },
  { value: "db_reply", label: "DB action" },
  { value: "code", label: "Python Code" },
]

const RAG_PROMPT_DEFAULT =
  "RAG reply (select database)"
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

const isBodyType = (
  childType: "AgentStateBody" | "AgentStateFallbackBody",
  type: string | undefined
) => type === childType

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

  /* ─────────────────────── Body / Fallback helpers ────────────────────── */

  const ragDatabaseOptions = React.useMemo(() => {
    return Array.from(
      new Set(
        nodes
          .filter((n) => n.type === "AgentRagElement")
          .map(
            (n) =>
              ((n.data as { name?: string }).name ?? "").trim()
          )
          .filter((s) => s.length > 0)
      )
    )
  }, [nodes])

  const childrenOfKind = (
    kind: "AgentStateBody" | "AgentStateFallbackBody"
  ): Node[] =>
    nodes.filter((n) => n.parentId === elementId && isBodyType(kind, n.type))

  const getActiveMode = (
    kind: "AgentStateBody" | "AgentStateFallbackBody"
  ): ReplyMode => {
    const children = childrenOfKind(kind)
    const order: ReplyMode[] = ["rag", "db_reply", "llm", "code", "text"]
    for (const m of order) {
      if (
        children.some(
          (c) => (c.data as AgentStateBodyNodeProps).replyType === m
        )
      ) {
        return m
      }
    }
    return "text"
  }

  const updateChild = (
    childId: string,
    patch: Partial<AgentStateBodyNodeProps>
  ) => {
    setNodes((all) =>
      all.map((n) =>
        n.id === childId ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const removeChildrenWhere = (
    kind: "AgentStateBody" | "AgentStateFallbackBody",
    keep: (data: AgentStateBodyNodeProps) => boolean
  ) => {
    setNodes((all) =>
      all.filter(
        (n) =>
          !(
            n.parentId === elementId &&
            isBodyType(kind, n.type) &&
            !keep(n.data as AgentStateBodyNodeProps)
          )
      )
    )
  }

  const createChild = (
    kind: "AgentStateBody" | "AgentStateFallbackBody",
    init: Partial<AgentStateBodyNodeProps> & { name: string }
  ) => {
    const newNode: Node = {
      id: generateUUID(),
      type: kind,
      parentId: elementId,
      position: { x: 16, y: 32 + childrenOfKind(kind).length * 30 },
      width: 220,
      height: 30,
      data: {
        replyType: "text",
        ...init,
      } as AgentStateBodyNodeProps,
    }
    setNodes((all) => [...all, newNode])
  }

  const setMode = (
    kind: "AgentStateBody" | "AgentStateFallbackBody",
    next: ReplyMode
  ) => {
    if (next === "text") {
      // Remove all non-text bodies; preserve existing text bodies.
      removeChildrenWhere(
        kind,
        (d) => d.replyType === "text" || d.replyType === undefined
      )
      // No auto-create — user adds text bodies via the "+ add" button.
      return
    }
    // For all single-body modes, delete siblings of other types and
    // create one of the new type if absent.
    const currentChildren = childrenOfKind(kind)
    const hasMode = currentChildren.some(
      (c) => (c.data as AgentStateBodyNodeProps).replyType === next
    )
    removeChildrenWhere(kind, (d) => d.replyType === next)
    if (!hasMode) {
      switch (next) {
        case "llm":
          createChild(kind, { name: LLM_BODY_DEFAULT, replyType: "llm" })
          break
        case "code":
          createChild(kind, {
            name: CODE_BODY_DEFAULT,
            replyType: "code",
            code: CODE_BODY_DEFAULT,
          })
          break
        case "rag": {
          const displayName = getRagDisplayName("")
          createChild(kind, {
            name: displayName,
            replyType: "rag",
            ragDatabaseName: "",
          })
          break
        }
        case "db_reply": {
          const dbSelectionType = "default"
          const dbCustomName = ""
          const dbQueryMode = "llm_query"
          const dbOperation = "any"
          createChild(kind, {
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
  }

  const renderBodyEditor = (
    kind: "AgentStateBody" | "AgentStateFallbackBody"
  ) => {
    const mode = getActiveMode(kind)
    const children = childrenOfKind(kind)

    if (mode === "text") {
      const textBodies = children.filter(
        (c) => (c.data as AgentStateBodyNodeProps).replyType === "text"
      )
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {textBodies.map((b) => (
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
                value={(b.data as AgentStateBodyNodeProps).name ?? ""}
                onChange={(e) =>
                  updateChild(b.id, { name: e.target.value })
                }
              />
              <IconButton
                size="small"
                onClick={() =>
                  setNodes((all) => all.filter((n) => n.id !== b.id))
                }
                aria-label="Remove text body"
              >
                <DeleteIcon width={14} height={14} />
              </IconButton>
            </Stack>
          ))}
          <Typography
            variant="caption"
            sx={{
              cursor: "pointer",
              color: "var(--apollon-primary)",
              alignSelf: "flex-start",
            }}
            onClick={() =>
              createChild(kind, { name: "", replyType: "text" })
            }
          >
            + add text body
          </Typography>
        </Box>
      )
    }

    if (mode === "llm") {
      const llmBody = children.find(
        (c) => (c.data as AgentStateBodyNodeProps).replyType === "llm"
      )
      if (!llmBody) {
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
          value={(llmBody.data as AgentStateBodyNodeProps).name ?? ""}
          onChange={(e) => updateChild(llmBody.id, { name: e.target.value })}
        />
      )
    }

    if (mode === "code") {
      const codeBody = children.find(
        (c) => (c.data as AgentStateBodyNodeProps).replyType === "code"
      )
      if (!codeBody) {
        return (
          <Typography variant="caption">Initialising code body…</Typography>
        )
      }
      const codeData = codeBody.data as AgentStateBodyNodeProps
      // v3 stored the code on `name`; v4 added a `code` field. Prefer
      // `code` when set, falling back to `name` for legacy fixtures.
      const codeValue =
        (typeof codeData.code === "string" && codeData.code) ||
        codeData.name ||
        ""
      return (
        <Box
          sx={{
            border: "1px solid var(--apollon-gray, #ccc)",
            borderRadius: "4px",
            "& .cm-editor": { fontSize: "13px", minHeight: 150 },
          }}
        >
          <CodeMirror
            value={codeValue}
            extensions={[python()]}
            onChange={(v) =>
              updateChild(codeBody.id, { code: v, name: v })
            }
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
      const ragBody = children.find(
        (c) => (c.data as AgentStateBodyNodeProps).replyType === "rag"
      )
      if (!ragBody) {
        return (
          <Typography variant="caption">Initialising RAG body…</Typography>
        )
      }
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <RagDbFields
            value={ragBody.data as AgentStateBodyNodeProps}
            onChange={(patch) => {
              const next = {
                ...(ragBody.data as AgentStateBodyNodeProps),
                ...patch,
              }
              updateChild(ragBody.id, {
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
            value={(ragBody.data as { name?: string }).name ?? ""}
            onChange={(e) => updateChild(ragBody.id, { name: e.target.value })}
            helperText="Override the auto-generated RAG label."
          />
        </Box>
      )
    }

    if (mode === "db_reply") {
      const dbBody = children.find(
        (c) => (c.data as AgentStateBodyNodeProps).replyType === "db_reply"
      )
      if (!dbBody) {
        return (
          <Typography variant="caption">
            Initialising database action…
          </Typography>
        )
      }
      return (
        <RagDbFields
          value={dbBody.data as AgentStateBodyNodeProps}
          onChange={(patch) => {
            const next = {
              ...(dbBody.data as AgentStateBodyNodeProps),
              ...patch,
            }
            updateChild(dbBody.id, {
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

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" sx={{ minWidth: 70 }}>
          stereotype
        </Typography>
        <Select
          size="small"
          value={data.stereotype ?? ""}
          onChange={(e) => {
            const v = String(e.target.value)
            updateNode({ stereotype: v === "" ? null : v })
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

      <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
        Agent Action
      </Typography>
      <Box
        component="div"
        sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}
      >
        {REPLY_MODES.map((m) => {
          const active = getActiveMode("AgentStateBody") === m.value
          return (
            <FormControlLabel
              key={`body-${m.value}`}
              control={
                <Checkbox
                  size="small"
                  checked={active}
                  onChange={() => setMode("AgentStateBody", m.value)}
                />
              }
              label={m.label}
            />
          )
        })}
      </Box>
      {renderBodyEditor("AgentStateBody")}

      <DividerLine width="100%" />

      <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
        Agent Fallback Action
      </Typography>
      <Box
        component="div"
        sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}
      >
        {REPLY_MODES.map((m) => {
          const active = getActiveMode("AgentStateFallbackBody") === m.value
          return (
            <FormControlLabel
              key={`fallback-${m.value}`}
              control={
                <Checkbox
                  size="small"
                  checked={active}
                  onChange={() => setMode("AgentStateFallbackBody", m.value)}
                />
              }
              label={m.label}
            />
          )
        })}
      </Box>
      {renderBodyEditor("AgentStateFallbackBody")}
    </Box>
  )
}
