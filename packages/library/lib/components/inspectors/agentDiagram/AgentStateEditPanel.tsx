import {
  Box,
  Button,
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
import { generateUUID } from "@/utils"
import { diagramBridge } from "@/services/diagramBridge"
import { AgentStateBodyRow, AgentStateNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { InspectorSectionHeader } from "../_shared"
import { AgentActionCard } from "./AgentActionCard"
import { AgentActionEditor } from "./AgentActionEditor"

/**
 * Full AgentState inspector.
 *
 * Source-of-truth port: `agent-state-diagram/agent-state/
 * agent-state-update.tsx` (develop `StateUpdate`, ~1599 LoC).
 *
 * Mirrors develop's layout:
 *   1. Name / style.
 *   2. State Type select (`standard` | `reasoning`).
 *   3. Quality warnings (missing LLM / chat-compatible LLM / WebSocket
 *      platform).
 *   4. `reasoning`: LLM / max-steps / planning / streaming / system
 *      prompt / fallback message. Body & fallback sections are hidden.
 *   5. `standard`: a multi-action `ActionCard` list per section
 *      (Body + optional Fallback Body), each card drag-reorderable and
 *      collapsible, plus an "Add action" 2-level picker (Simple / AI /
 *      Data tab → type). `fallbackBodyEnabled` gates the fallback
 *      section (clearing it drops the fallback rows).
 *
 * Bodies live inline on `data.bodies` / `data.fallbackBodies` (delta from
 * develop's separate child elements) and are preserved across a
 * standard ↔ reasoning toggle, so switching back restores them untouched
 * (satisfies the "prefer preserving body content" requirement by
 * construction).
 */

type BodySection = "main" | "fallback"
type ActionTab = "simple" | "ai" | "data"

const WS_REPLY_TYPES = new Set([
  "ws_markdown",
  "ws_html",
  "ws_speech",
  "ws_options",
  "ws_location",
  "ws_file",
  "ws_image",
  "ws_dataframe",
  "ws_plotly",
])

const SECTION_ACTION_TYPES: Record<ActionTab, string[]> = {
  simple: [
    "text",
    "ws_markdown",
    "ws_html",
    "ws_speech",
    "ws_options",
    "ws_location",
    "ws_file",
    "ws_image",
    "ws_dataframe",
    "ws_plotly",
  ],
  ai: ["llm", "llm_chat"],
  // `code` (Python) is a develop feature exposed here as a reply type
  // (develop surfaced it via a separate Predefined/Custom toggle); folded
  // into the Data tab so the affordance is preserved in the flat list.
  data: ["rag", "db_reply", "web_crawl_llm", "code"],
}

const ACTION_TABS: { value: ActionTab; label: string }[] = [
  { value: "simple", label: "Simple Replies" },
  { value: "ai", label: "AI Replies" },
  { value: "data", label: "Data Query" },
]

const ACTION_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  llm: "LLM",
  llm_chat: "LLM Chat",
  rag: "RAG",
  db_reply: "SQL Query",
  code: "Python Code",
  web_crawl_llm: "Web Crawl + LLM",
  ws_markdown: "Markdown",
  ws_html: "HTML",
  ws_speech: "Speech",
  ws_options: "Options",
  ws_location: "Location",
  ws_file: "File",
  ws_image: "Image",
  ws_dataframe: "Dataframe",
  ws_plotly: "Plotly",
}

const CODE_BODY_DEFAULT = "def body_name(session: 'Session'):\n    pass\n"

const LLM_ACTION_TYPES = new Set(["llm", "llm_chat", "rag", "web_crawl_llm"])

const truncate = (s: string, n = 40): string =>
  s.length > n ? `${s.slice(0, n)}…` : s

const getRagDisplayName = (databaseName?: string): string => {
  const trimmed = (databaseName || "").trim()
  return trimmed.length
    ? `RAG reply using ${trimmed} database`
    : "RAG reply (select database)"
}

const getDbDisplayName = (
  dbSelectionType?: string,
  dbCustomName?: string,
  dbQueryMode?: string,
  dbOperation?: string
): string => {
  const customDb = (dbCustomName || "").trim()
  const dbLabel =
    dbSelectionType === "custom"
      ? customDb.length
        ? customDb
        : "custom database"
      : "Default database"
  const modeLabel = dbQueryMode === "sql" ? "SQL" : "LLM query"
  const opLabel =
    dbOperation === "any" || !dbOperation ? "Any" : dbOperation.toUpperCase()
  return `DB action using ${dbLabel} (${modeLabel}, ${opLabel})`
}

/** Collapsed one-line summary of an action (develop `getActionSummary`). */
const getActionSummary = (row: AgentStateBodyRow): string => {
  const name = row.name || ""
  switch (row.replyType) {
    case "llm":
      return row.llm_name ? `LLM: ${row.llm_name}` : "(default LLM)"
    case "llm_chat":
      return row.llm_name ? `Chat: ${row.llm_name}` : "(default LLM chat)"
    case "rag":
      return row.ragDatabaseName
        ? `DB: ${row.ragDatabaseName}${row.prompt ? " (prompt)" : ""}`
        : "(select database)"
    case "web_crawl_llm":
      return row.initial_url
        ? `Crawl: ${truncate(row.initial_url, 30)}${
            row.run_crawl === false ? " (no crawl)" : ""
          }`
        : "(set URL)"
    case "ws_markdown":
    case "ws_html":
    case "ws_speech":
      return row.ws_message ? truncate(row.ws_message) : "(no message)"
    case "ws_options": {
      const opts = (row.ws_options || "").split("\n").filter(Boolean)
      return opts.length ? `${opts.length} option(s)` : "(no options)"
    }
    case "ws_location":
      return `(${row.ws_latitude ?? 0}, ${row.ws_longitude ?? 0})`
    case "ws_file":
      return "(placeholder: file)"
    case "ws_image":
      return "(placeholder: image)"
    case "ws_dataframe":
      return "(placeholder: dataframe)"
    case "ws_plotly":
      return "(placeholder: plot)"
    default:
      return truncate(name)
  }
}

/** Per-type seed defaults for a freshly added action (develop `addPredefinedAction`). */
const seedRow = (replyType: string): Partial<AgentStateBodyRow> => {
  switch (replyType) {
    case "text":
      return { name: "Enter reply message" }
    case "llm":
      return { name: "LLM Reply" }
    case "llm_chat":
      return { name: "LLM Chat Reply" }
    case "rag":
      return { ragDatabaseName: "", prompt: "", name: getRagDisplayName("") }
    case "db_reply":
      return {
        dbSelectionType: "default",
        dbCustomName: "",
        dbQueryMode: "llm_query",
        dbOperation: "any",
        dbSqlQuery: "",
        name: getDbDisplayName("default", "", "llm_query", "any"),
      }
    case "code":
      return { code: CODE_BODY_DEFAULT, name: CODE_BODY_DEFAULT }
    case "web_crawl_llm":
      return {
        initial_url: "",
        max_depth: 2,
        max_pages: 20,
        crawl_format: "markdown",
        base_url_prefix: "",
        run_crawl: true,
        no_crawl_error_message: "No web crawl data is available yet.",
        system_message_prefix: "",
        name: "Web Crawl + LLM (set URL)",
      }
    case "ws_markdown":
      return { ws_message: "", name: "Markdown (empty)" }
    case "ws_html":
      return { ws_message: "", name: "HTML (empty)" }
    case "ws_speech":
      return { ws_message: "", ws_audio_speed: null, name: "Speech (empty)" }
    case "ws_options":
      return { ws_options: "", name: "Options (no options)" }
    case "ws_location":
      return { ws_latitude: 0, ws_longitude: 0, name: "Location (0, 0)" }
    case "ws_file":
      return { name: "File (placeholder)" }
    case "ws_image":
      return { name: "Image (placeholder)" }
    case "ws_dataframe":
      return { name: "Dataframe (placeholder)" }
    case "ws_plotly":
      return { name: "Plotly (placeholder)" }
    default:
      return { name: replyType }
  }
}

export const AgentStateEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )

  const [expanded, setExpanded] = React.useState<Record<BodySection, Set<string>>>(
    { main: new Set(), fallback: new Set() }
  )
  const [drag, setDrag] = React.useState<{
    section: BodySection | null
    fromIndex: number | null
    overIndex: number | null
  }>({ section: null, fromIndex: null, overIndex: null })
  const [picker, setPicker] = React.useState<
    Record<BodySection, { tab: ActionTab; type: string }>
  >({
    main: { tab: "simple", type: "text" },
    fallback: { tab: "simple", type: "text" },
  })

  // Registered AgentLLM definitions → names + providers (for warnings).
  const llmEntries = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const n of nodes) {
      if ((n.type as string) !== "AgentLLM") continue
      const nm = ((n.data as { name?: string }).name ?? "").trim()
      if (!nm || map.has(nm)) continue
      map.set(
        nm,
        String((n.data as { provider?: string }).provider ?? "").toLowerCase()
      )
    }
    return map
  }, [nodes])
  const llmNameOptions = React.useMemo(
    () => Array.from(llmEntries.keys()),
    [llmEntries]
  )
  const llmProviderByName = React.useMemo(
    () => Object.fromEntries(llmEntries),
    [llmEntries]
  )
  const hasCompatibleChatLlm = React.useMemo(
    () =>
      Array.from(llmEntries.values()).some(
        (p) => p === "openai" || p === "huggingface"
      ),
    [llmEntries]
  )
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
  // Agent platform is configured from the webapp's Agent Configuration
  // panel; probe the bridge without hard-coupling to a method that only
  // exists once that wiring lands (library-only scope).
  const hasWebSocketPlatform = React.useMemo(() => {
    const bridge = diagramBridge as { getAgentPlatform?: () => string }
    return (
      typeof bridge.getAgentPlatform === "function" &&
      bridge.getAgentPlatform() === "websocket"
    )
  }, [])

  const node = nodes.find((n) => n.id === elementId)
  if (!node) return null

  const data = node.data as AgentStateNodeProps
  const mainBodies: AgentStateBodyRow[] = data.bodies ?? []
  const fallbackBodies: AgentStateBodyRow[] = data.fallbackBodies ?? []
  const stateType = data.stateType === "reasoning" ? "reasoning" : "standard"
  const fallbackEnabled = data.fallbackBodyEnabled !== false

  /* ─────────────────────── data helpers ─────────────────────── */

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

  const sectionRows = (section: BodySection): AgentStateBodyRow[] =>
    section === "fallback" ? fallbackBodies : mainBodies

  const replaceSection = (
    section: BodySection,
    mapper: (rows: AgentStateBodyRow[]) => AgentStateBodyRow[]
  ) => {
    if (section === "fallback") {
      updateNode({ fallbackBodies: mapper(fallbackBodies) })
    } else {
      updateNode({ bodies: mapper(mainBodies) })
    }
  }

  const updateRow = (
    section: BodySection,
    rowId: string,
    patch: Partial<AgentStateBodyRow>
  ) => {
    replaceSection(section, (rows) =>
      rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
    )
  }

  const removeRow = (section: BodySection, rowId: string) => {
    replaceSection(section, (rows) => rows.filter((r) => r.id !== rowId))
    setExpanded((prev) => {
      const set = new Set(prev[section])
      set.delete(rowId)
      return { ...prev, [section]: set }
    })
  }

  const moveRow = (section: BodySection, from: number, to: number) => {
    replaceSection(section, (rows) => {
      const next = rows.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const addAction = (section: BodySection, replyType: string) => {
    const id = generateUUID()
    const newRow: AgentStateBodyRow = { id, replyType, ...seedRow(replyType) }
    replaceSection(section, (rows) => [...rows, newRow])
    setExpanded((prev) => {
      const set = new Set(prev[section])
      set.add(id)
      return { ...prev, [section]: set }
    })
  }

  const toggleExpand = (section: BodySection, rowId: string) => {
    setExpanded((prev) => {
      const set = new Set(prev[section])
      if (set.has(rowId)) set.delete(rowId)
      else set.add(rowId)
      return { ...prev, [section]: set }
    })
  }

  const rowWarning = (row: AgentStateBodyRow): boolean =>
    (WS_REPLY_TYPES.has(row.replyType ?? "") && !hasWebSocketPlatform) ||
    (row.replyType === "llm_chat" && !hasCompatibleChatLlm) ||
    (llmNameOptions.length === 0 &&
      (row.replyType === "llm" ||
        row.replyType === "rag" ||
        row.replyType === "web_crawl_llm" ||
        (row.replyType === "db_reply" &&
          (row.dbQueryMode || "llm_query") === "llm_query")))

  /* ─────────────────────── quality warnings ─────────────────────── */

  const allActions = [...mainBodies, ...fallbackBodies]
  const needsLlm =
    llmNameOptions.length === 0 &&
    (stateType === "reasoning" ||
      allActions.some(
        (a) =>
          LLM_ACTION_TYPES.has(a.replyType ?? "") ||
          (a.replyType === "db_reply" &&
            (a.dbQueryMode || "llm_query") === "llm_query")
      ))
  const needsChatLlm =
    !hasCompatibleChatLlm &&
    allActions.some((a) => a.replyType === "llm_chat")
  const needsPlatform =
    !hasWebSocketPlatform &&
    allActions.some((a) => WS_REPLY_TYPES.has(a.replyType ?? ""))

  /* ─────────────────────── section renderer ─────────────────────── */

  const renderBodySection = (section: BodySection) => {
    const rows = sectionRows(section)
    const pick = picker[section]
    const tabTypes = SECTION_ACTION_TYPES[pick.tab]
    const selectedType = tabTypes.includes(pick.type) ? pick.type : tabTypes[0]

    return (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {rows.map((row, index) => (
          <AgentActionCard
            key={row.id}
            label={ACTION_TYPE_LABELS[row.replyType ?? "text"] ?? row.replyType ?? "text"}
            summary={getActionSummary(row)}
            warning={rowWarning(row)}
            expanded={expanded[section].has(row.id)}
            draggable
            dragging={drag.section === section && drag.fromIndex === index}
            dragOver={drag.section === section && drag.overIndex === index}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", String(index))
              e.dataTransfer.effectAllowed = "move"
              setDrag({ section, fromIndex: index, overIndex: null })
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"
              if (drag.section === section && drag.overIndex !== index) {
                setDrag((d) => ({ ...d, overIndex: index }))
              }
            }}
            onDragLeave={() => {
              if (drag.section === section && drag.overIndex === index) {
                setDrag((d) => ({ ...d, overIndex: null }))
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              const from = parseInt(e.dataTransfer.getData("text/plain"), 10)
              // Reorder only within the same section (develop guard).
              if (
                drag.section === section &&
                !Number.isNaN(from) &&
                from !== index &&
                from < rows.length
              ) {
                moveRow(section, from, index)
              }
              setDrag({ section: null, fromIndex: null, overIndex: null })
            }}
            onDragEnd={() =>
              setDrag({ section: null, fromIndex: null, overIndex: null })
            }
            onToggleExpand={() => toggleExpand(section, row.id)}
            onDelete={() => removeRow(section, row.id)}
          >
            <AgentActionEditor
              row={row}
              onChange={(patch) => updateRow(section, row.id, patch)}
              llmNameOptions={llmNameOptions}
              llmProviderByName={llmProviderByName}
              ragDatabaseOptions={ragDatabaseOptions}
              hasWebSocketPlatform={hasWebSocketPlatform}
              hasCompatibleChatLlm={hasCompatibleChatLlm}
            />
          </AgentActionCard>
        ))}

        <Typography
          variant="caption"
          sx={{ opacity: 0.55, textTransform: "uppercase", mt: 1, mb: 0.5 }}
        >
          New action
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ mb: 0.75 }}>
          {ACTION_TABS.map((t) => (
            <Button
              key={t.value}
              size="small"
              variant={pick.tab === t.value ? "contained" : "outlined"}
              onClick={() =>
                setPicker((prev) => ({
                  ...prev,
                  [section]: {
                    tab: t.value,
                    type: SECTION_ACTION_TYPES[t.value][0],
                  },
                }))
              }
              sx={{ flex: 1, minWidth: 0, fontSize: 11, px: 0.5 }}
            >
              {t.label}
            </Button>
          ))}
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Select
            size="small"
            fullWidth
            value={selectedType}
            onChange={(e) =>
              setPicker((prev) => ({
                ...prev,
                [section]: { ...prev[section], type: String(e.target.value) },
              }))
            }
          >
            {tabTypes.map((t) => (
              <MenuItem key={t} value={t}>
                {ACTION_TYPE_LABELS[t] ?? t}
              </MenuItem>
            ))}
          </Select>
          <Button
            size="small"
            variant="contained"
            onClick={() => addAction(section, selectedType)}
          >
            Add
          </Button>
        </Stack>
      </Box>
    )
  }

  /* ─────────────────────── render ─────────────────────── */

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <NodeStyleEditor
        nodeData={data}
        handleDataFieldUpdate={handleDataFieldUpdate}
        showNameInputChange={false}
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

      <InspectorSectionHeader>State Type</InspectorSectionHeader>
      <Select
        size="small"
        fullWidth
        value={stateType}
        onChange={(e) =>
          updateNode({
            stateType: e.target.value === "reasoning" ? "reasoning" : "standard",
          })
        }
      >
        <MenuItem value="standard">Standard</MenuItem>
        <MenuItem value="reasoning">Reasoning</MenuItem>
      </Select>

      {(needsLlm || needsChatLlm || needsPlatform) && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {needsLlm && (
            <Typography variant="caption" sx={{ color: "#e04040" }}>
              ⚠ No LLM is defined in the diagram, but this state requires one.
              Add an LLM in the Agent Configuration.
            </Typography>
          )}
          {needsChatLlm && (
            <Typography variant="caption" sx={{ color: "#e04040" }}>
              ⚠ LLM Chat requires an OpenAI or Hugging Face LLM, but none are
              defined. Add a compatible LLM in the Agent Configuration.
            </Typography>
          )}
          {needsPlatform && (
            <Typography variant="caption" sx={{ color: "#e04040" }}>
              ⚠ This state has WebSocket reply actions, but the platform is not
              set to WebSocket. Change the platform in Agent Configuration.
            </Typography>
          )}
        </Box>
      )}

      {stateType === "reasoning" ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <DividerLine width="100%" />
          <Typography variant="caption">LLM name</Typography>
          <Select
            size="small"
            fullWidth
            displayEmpty
            value={data.llm_name ?? ""}
            onChange={(e) => updateNode({ llm_name: String(e.target.value) })}
          >
            <MenuItem value="">(use default)</MenuItem>
            {(data.llm_name && !llmNameOptions.includes(data.llm_name)
              ? [...llmNameOptions, data.llm_name]
              : llmNameOptions
            ).map((name) => (
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
              updateNode({ max_steps: Number.isNaN(parsed) ? 8 : parsed })
            }}
          />
          <Stack direction="column">
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={data.enable_task_planning !== false}
                  onChange={(e) =>
                    updateNode({ enable_task_planning: e.target.checked })
                  }
                />
              }
              label="Enable task planning"
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={data.stream_steps !== false}
                  onChange={(e) => updateNode({ stream_steps: e.target.checked })}
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
            onChange={(e) => updateNode({ system_prompt: e.target.value })}
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
            onChange={(e) => updateNode({ fallback_message: e.target.value })}
          />
        </Box>
      ) : (
        <>
          <DividerLine width="100%" />
          <InspectorSectionHeader>Body</InspectorSectionHeader>
          {renderBodySection("main")}

          <DividerLine width="100%" />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={fallbackEnabled}
                onChange={(e) => {
                  const checked = e.target.checked
                  // Clearing the toggle drops the fallback rows (develop
                  // L529). Set both fields in one update.
                  updateNode(
                    checked
                      ? { fallbackBodyEnabled: true }
                      : { fallbackBodyEnabled: false, fallbackBodies: [] }
                  )
                }}
              />
            }
            label="Enable Fallback Body"
          />
          {fallbackEnabled && (
            <>
              <InspectorSectionHeader>Fallback Body</InspectorSectionHeader>
              {renderBodySection("fallback")}
            </>
          )}
        </>
      )}
    </Box>
  )
}
