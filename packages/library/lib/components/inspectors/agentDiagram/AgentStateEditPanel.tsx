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
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { useShallow } from "zustand/shallow"
import { useDiagramStore } from "@/store/context"
import { generateUUID } from "@/utils"
import { AgentStateBodyRow, AgentStateNodeProps } from "@/types"
import { DividerLine, NodeStyleEditor, Typography } from "@/components/ui"
import { PopoverProps } from "@/components/popovers/types"
import { useTranslation, type Translate } from "@/i18n"
import { resolveReplyType, withActionType } from "@/utils/agentActions"
import { InspectorSectionHeader, useCodeMirrorTheme } from "../_shared"
import { AgentActionCard } from "./AgentActionCard"
import { AgentActionEditor, Warning } from "./AgentActionEditor"
import { AgentNewActionPicker } from "./AgentNewActionPicker"
import { getAgentComponentLists } from "./agentComponentLists"
import {
  ActionSection,
  actionTypeLabel,
  DEFAULT_PYTHON_BODY,
  getDbDisplayName,
  getDefaultDbReplyValues,
  getRagDisplayName,
  isChatCompatibleProvider,
  LLM_ACTION_TYPES,
  SECTION_ACTION_TYPES,
  WS_REPLY_TYPES,
} from "./agentStateConstants"

/**
 * Full AgentState inspector.
 *
 * Port of smart-gen `agent-state-diagram/agent-state/agent-state-update.tsx`
 * (639b0c42 reworked panel, d765a3f8 session data flow, 11f7c913 GUI
 * replies, d418998e update flow, a46002d5 cards open by default):
 *   1. Name / style / initial flag.
 *   2. State Type (`standard` | `reasoning`).
 *   3. Quality warnings (missing LLM / chat-capable LLM / WebSocket).
 *   4. `reasoning`: LLM / max steps / planning / streaming / prompts.
 *   5. `standard`: per section (Body + optional Fallback Body) a
 *      Predefined / Custom (Python) toggle. Predefined = a drag-reorderable
 *      list of action cards (expanded by default) plus the "New action"
 *      picker; Custom = one Python code action. Switching modes stashes
 *      the other mode's content so switching back restores it.
 *
 * Bodies live inline on `data.bodies` / `data.fallbackBodies`; every row
 * written here carries both `replyType` and the metamodel `actionType`.
 * Intents / LLMs / RAG databases / GUIs come from the agent Components page
 * (via `diagramBridge`).
 */

type BodySection = "main" | "fallback"

/** Per-type seed values for a freshly added action (smart-gen `addPredefinedAction`). */
const seedRow = (t: Translate, replyType: string): Partial<AgentStateBodyRow> => {
  switch (replyType) {
    case "text":
      return { name: t("packages.AgentDiagram.enterReplyMessage", "Enter reply message") }
    case "llm":
      return { name: t("packages.AgentDiagram.llmReplyDefault", "LLM Reply"), system_message: "" }
    case "llm_chat":
      return {
        name: t("packages.AgentDiagram.llmChatReplyDefault", "LLM Chat Reply"),
        system_message: "",
      }
    case "rag":
      return { ragDatabaseName: "", prompt: "", name: getRagDisplayName(t, "") }
    case "db_reply": {
      const defaults = getDefaultDbReplyValues()
      return {
        ...defaults,
        name: getDbDisplayName(
          t,
          defaults.dbSelectionType,
          defaults.dbCustomName,
          defaults.dbQueryMode,
          defaults.dbOperation
        ),
      }
    }
    case "web_crawl_llm":
      return {
        initial_url: "",
        max_depth: 2,
        max_pages: 20,
        crawl_format: "markdown",
        base_url_prefix: "",
        run_crawl: true,
        no_crawl_error_message: t(
          "packages.AgentDiagram.noCrawlDataDefault",
          "No web crawl data is available yet."
        ),
        system_message_prefix: "",
        name: t("packages.AgentDiagram.webCrawlLlmSetUrl", "Web Crawl + LLM (set URL)"),
      }
    case "ws_markdown":
      return { ws_message: "", name: t("packages.AgentDiagram.markdownEmpty", "Markdown (empty)") }
    case "ws_html":
      return { ws_message: "", name: t("packages.AgentDiagram.htmlEmpty", "HTML (empty)") }
    case "ws_speech":
      return {
        ws_message: "",
        ws_audio_speed: null,
        name: t("packages.AgentDiagram.speechEmpty", "Speech (empty)"),
      }
    case "ws_options":
      return {
        ws_options: "",
        name: t("packages.AgentDiagram.optionsNoOptions", "Options (no options)"),
      }
    case "ws_location":
      return {
        ws_latitude: 0,
        ws_longitude: 0,
        name: t("packages.AgentDiagram.locationDefault", "Location (0, 0)"),
      }
    case "ws_file":
      return { name: t("packages.AgentDiagram.filePlaceholderName", "File (placeholder)") }
    case "ws_image":
      return { name: t("packages.AgentDiagram.imagePlaceholderName", "Image (placeholder)") }
    case "ws_dataframe":
      return {
        name: t("packages.AgentDiagram.dataframePlaceholderName", "Dataframe (placeholder)"),
      }
    case "ws_plotly":
      return { name: t("packages.AgentDiagram.plotlyPlaceholderName", "Plotly (placeholder)") }
    case "gui_reply":
      return { guiId: "", name: t("packages.AgentDiagram.guiReplySelectGui", "GUI Reply (select GUI)") }
    case "code":
      return { code: DEFAULT_PYTHON_BODY, name: DEFAULT_PYTHON_BODY }
    default:
      return { name: replyType }
  }
}

const truncate = (s: string, n = 40): string =>
  s.length > n ? `${s.slice(0, n)}…` : s

/** Collapsed one-line summary of an action card. */
const getActionSummary = (t: Translate, row: AgentStateBodyRow): string => {
  const rt = resolveReplyType(row)
  switch (rt) {
    case "llm":
      return row.llm_name ? `LLM: ${row.llm_name}` : `(${t("packages.AgentDiagram.default2", "default LLM")})`
    case "llm_chat":
      return row.llm_name
        ? `Chat: ${row.llm_name}`
        : `(${t("packages.AgentDiagram.defaultLlmChat", "default LLM chat")})`
    case "rag":
      return row.ragDatabaseName
        ? `DB: ${row.ragDatabaseName}`
        : `(${t("packages.AgentDiagram.selectDatabase2", "select database")})`
    case "web_crawl_llm":
      return row.initial_url
        ? `${t("packages.AgentDiagram.webCrawlNamePrefix", "Crawl:")} ${truncate(row.initial_url, 30)}${
            row.run_crawl === false ? ` (${t("packages.AgentDiagram.noCrawlData", "no crawl data")})` : ""
          }`
        : `(${t("packages.AgentDiagram.setUrl", "set URL")})`
    case "ws_markdown":
    case "ws_html":
    case "ws_speech":
      return row.ws_message
        ? truncate(row.ws_message)
        : `(${t("packages.AgentDiagram.noMessage", "no message")})`
    case "ws_options": {
      const opts = (row.ws_options || "").split("\n").filter(Boolean)
      return opts.length
        ? `${opts.length} ${t("packages.AgentDiagram.optionItems", "option(s)")}`
        : `(${t("packages.AgentDiagram.noOptions", "no options")})`
    }
    case "ws_location":
      return `(${row.ws_latitude ?? 0}, ${row.ws_longitude ?? 0})`
    case "ws_file":
      return `(${t("packages.AgentDiagram.placeholderFile", "placeholder: file")})`
    case "ws_image":
      return `(${t("packages.AgentDiagram.placeholderImage", "placeholder: image")})`
    case "ws_dataframe":
      return `(${t("packages.AgentDiagram.placeholderDataframe", "placeholder: dataframe")})`
    case "ws_plotly":
      return `(${t("packages.AgentDiagram.placeholderPlot", "placeholder: plot")})`
    default:
      return truncate(row.name || "")
  }
}

export const AgentStateEditPanel: React.FC<PopoverProps> = ({ elementId }) => {
  const { t } = useTranslation()
  const codeTheme = useCodeMirrorTheme()
  const { nodes, setNodes } = useDiagramStore(
    useShallow((state) => ({
      nodes: state.nodes,
      setNodes: state.setNodes,
    }))
  )

  // Actions open in edit mode by default (smart-gen a46002d5): track the
  // ones the user collapsed instead of the ones expanded.
  const [collapsed, setCollapsed] = React.useState<Record<BodySection, Set<string>>>(
    { main: new Set(), fallback: new Set() }
  )
  const [drag, setDrag] = React.useState<{
    section: BodySection | null
    fromIndex: number | null
    overIndex: number | null
  }>({ section: null, fromIndex: null, overIndex: null })
  const [picker, setPicker] = React.useState<
    Record<BodySection, { section: ActionSection; type: string }>
  >({
    main: { section: "simple", type: "text" },
    fallback: { section: "simple", type: "text" },
  })
  // Stashes that preserve content across a Predefined ↔ Custom switch.
  const [stash, setStash] = React.useState<{
    predefined: Record<BodySection, AgentStateBodyRow[] | null>
    custom: Record<BodySection, string | null>
  }>({ predefined: { main: null, fallback: null }, custom: { main: null, fallback: null } })

  // The panel is reused across states: never carry one state's stash over.
  React.useEffect(() => {
    setStash({ predefined: { main: null, fallback: null }, custom: { main: null, fallback: null } })
    setCollapsed({ main: new Set(), fallback: new Set() })
  }, [elementId])

  const lists = getAgentComponentLists(nodes)
  const llmNameOptions = lists.llms.map((l) => l.name)
  const llmProviderByName = Object.fromEntries(
    lists.llms.map((l) => [l.name, (l.provider || "").toLowerCase()])
  )
  const hasCompatibleChatLlm = lists.llms.some((l) =>
    isChatCompatibleProvider((l.provider || "").toLowerCase())
  )
  const ragDatabaseOptions = lists.rags.map((r) => r.name)
  const hasWebSocketPlatform = lists.platform === "websocket"

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

  // "Initial" is single-select across the diagram.
  const setInitial = (checked: boolean) => {
    setNodes((all) =>
      all.map((n) => {
        if (n.id === elementId) {
          return { ...n, data: { ...n.data, initial: checked } }
        }
        if (
          checked &&
          n.type === "AgentState" &&
          (n.data as { initial?: boolean } | undefined)?.initial
        ) {
          return { ...n, data: { ...n.data, initial: false } }
        }
        return n
      })
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
      rows.map((r) => (r.id === rowId ? withActionType({ ...r, ...patch }) : r))
    )
  }

  const removeRow = (section: BodySection, rowId: string) => {
    replaceSection(section, (rows) => rows.filter((r) => r.id !== rowId))
  }

  const moveRow = (section: BodySection, from: number, to: number) => {
    replaceSection(section, (rows) => {
      const next = rows.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const newRow = (replyType: string, extra?: Partial<AgentStateBodyRow>): AgentStateBodyRow =>
    withActionType({ id: generateUUID(), replyType, ...seedRow(t, replyType), ...extra })

  const addAction = (section: BodySection, replyType: string) => {
    replaceSection(section, (rows) => [...rows, newRow(replyType)])
  }

  const toggleExpand = (section: BodySection, rowId: string) => {
    setCollapsed((prev) => {
      const set = new Set(prev[section])
      if (set.has(rowId)) set.delete(rowId)
      else set.add(rowId)
      return { ...prev, [section]: set }
    })
  }

  /** Predefined ↔ Custom (Python) switch with content stashing (smart-gen `switchBodyType`). */
  const switchBodyType = (section: BodySection, target: "predefined" | "custom") => {
    const rows = sectionRows(section)
    if (target === "custom") {
      const savedCode = stash.custom[section]
      setStash((prev) => ({
        ...prev,
        predefined: { ...prev.predefined, [section]: rows },
      }))
      const code = savedCode ?? DEFAULT_PYTHON_BODY
      replaceSection(section, () => [newRow("code", { code, name: code })])
    } else {
      const codeRow = rows.find((r) => resolveReplyType(r) === "code")
      const saved = stash.predefined[section]
      setStash((prev) => ({
        ...prev,
        custom: {
          ...prev.custom,
          [section]: codeRow ? (codeRow.code ?? codeRow.name ?? null) : null,
        },
      }))
      replaceSection(section, () => (saved && saved.length ? saved : []))
    }
  }

  const rowWarning = (row: AgentStateBodyRow): boolean => {
    const rt = resolveReplyType(row)
    return (
      (WS_REPLY_TYPES.has(rt) && !hasWebSocketPlatform) ||
      (rt === "llm_chat" && !hasCompatibleChatLlm) ||
      (llmNameOptions.length === 0 &&
        (rt === "llm" ||
          rt === "rag" ||
          rt === "web_crawl_llm" ||
          (rt === "db_reply" && (row.dbQueryMode || "llm_query") === "llm_query")))
    )
  }

  /* ─────────────────────── quality warnings ─────────────────────── */

  const allActions = [...mainBodies, ...fallbackBodies]
  const needsLlm =
    llmNameOptions.length === 0 &&
    (stateType === "reasoning" ||
      allActions.some((a) => {
        const rt = resolveReplyType(a)
        return (
          LLM_ACTION_TYPES.has(rt) ||
          (rt === "db_reply" && (a.dbQueryMode || "llm_query") === "llm_query")
        )
      }))
  const needsChatLlm =
    !hasCompatibleChatLlm &&
    allActions.some((a) => resolveReplyType(a) === "llm_chat")
  const needsPlatform =
    !hasWebSocketPlatform &&
    allActions.some((a) => WS_REPLY_TYPES.has(resolveReplyType(a)))

  /* ─────────────────────── section renderers ─────────────────────── */

  const renderCustomBody = (section: BodySection) => {
    const rows = sectionRows(section)
    const codeRow = rows.find((r) => resolveReplyType(r) === "code")
    if (!codeRow) {
      return (
        <Button
          size="small"
          variant="contained"
          onClick={() => replaceSection(section, (all) => [...all, newRow("code")])}
        >
          {t("packages.AgentDiagram.initializePythonCode", "Initialize Python code")}
        </Button>
      )
    }
    const codeValue = (typeof codeRow.code === "string" && codeRow.code) || codeRow.name || ""
    return (
      <Box
        sx={{
          border: "1px solid var(--besser-gray, #ccc)",
          borderRadius: "4px",
          resize: "vertical",
          overflow: "auto",
          "& .cm-editor": { fontSize: "13px", minHeight: 150 },
        }}
      >
        <CodeMirror
          theme={codeTheme}
          value={codeValue}
          extensions={[python()]}
          onChange={(v) => updateRow(section, codeRow.id, { code: v, name: v })}
          basicSetup={{ lineNumbers: true, tabSize: 4, indentOnInput: true }}
        />
      </Box>
    )
  }

  const renderPredefinedBody = (section: BodySection) => {
    const rows = sectionRows(section)
    const pick = picker[section]
    const sectionTypes = SECTION_ACTION_TYPES[pick.section]
    const selectedType = sectionTypes.includes(pick.type) ? pick.type : sectionTypes[0]
    return (
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {rows.length === 0 && (
          <Typography variant="caption" sx={{ opacity: 0.6, fontStyle: "italic", my: 0.5 }}>
            {t("packages.AgentDiagram.noActionsDefined", "No actions defined.")}
          </Typography>
        )}
        {rows.map((row, index) => {
          const rt = resolveReplyType(row)
          return (
            <AgentActionCard
              key={row.id}
              label={actionTypeLabel(t, rt)}
              summary={getActionSummary(t, row)}
              warning={rowWarning(row)}
              expanded={!collapsed[section].has(row.id)}
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
                // Reorder only within the same section (smart-gen guard).
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
              onDragEnd={() => setDrag({ section: null, fromIndex: null, overIndex: null })}
              onToggleExpand={() => toggleExpand(section, row.id)}
              onDelete={() => removeRow(section, row.id)}
            >
              <AgentActionEditor
                row={row}
                onChange={(patch) => updateRow(section, row.id, patch)}
                llmNameOptions={llmNameOptions}
                llmProviderByName={llmProviderByName}
                ragDatabaseOptions={ragDatabaseOptions}
                guiOptions={lists.guis}
                hasWebSocketPlatform={hasWebSocketPlatform}
                hasCompatibleChatLlm={hasCompatibleChatLlm}
              />
            </AgentActionCard>
          )
        })}

        <AgentNewActionPicker
          section={pick.section}
          setSection={(s) =>
            setPicker((prev) => ({
              ...prev,
              [section]: { section: s, type: SECTION_ACTION_TYPES[s][0] },
            }))
          }
          selectedActionType={selectedType}
          setSelectedActionType={(type) =>
            setPicker((prev) => ({ ...prev, [section]: { ...prev[section], type } }))
          }
          hasWebSocketPlatform={hasWebSocketPlatform}
          hasCompatibleChatLlm={hasCompatibleChatLlm}
          onAdd={() => addAction(section, selectedType)}
        />
      </Box>
    )
  }

  const renderBodySection = (section: BodySection) => {
    const isCustom = sectionRows(section).some((r) => resolveReplyType(r) === "code")
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <div className="bp-segmented" role="group">
          <button
            type="button"
            className="bp-toggle"
            aria-pressed={!isCustom}
            onClick={() => isCustom && switchBodyType(section, "predefined")}
          >
            {t("packages.AgentDiagram.predefined", "Predefined")}
          </button>
          <button
            type="button"
            className="bp-toggle"
            aria-pressed={isCustom}
            onClick={() => !isCustom && switchBodyType(section, "custom")}
          >
            {t("packages.AgentDiagram.customPython", "Custom (Python)")}
          </button>
        </div>
        {isCustom ? renderCustomBody(section) : renderPredefinedBody(section)}
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
        preElements={[
          <MuiTextField
            key="name"
            size="small"
            variant="outlined"
            label={t("packages.AgentDiagram.stateName", "name")}
            value={data.name}
            onChange={(e) => updateNode({ name: e.target.value })}
            sx={{ flex: 1 }}
          />,
        ]}
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
          label={t("packages.AgentDiagram.italic", "italic")}
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!data.underline}
              onChange={(e) => updateNode({ underline: e.target.checked })}
            />
          }
          label={t("packages.AgentDiagram.underline", "underline")}
        />
      </Stack>

      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={!!data.initial}
            onChange={(e) => setInitial(e.target.checked)}
          />
        }
        label={t("packages.AgentDiagram.initialState", "Initial state")}
      />

      <DividerLine width="100%" />

      <InspectorSectionHeader>
        {t("packages.AgentDiagram.stateType", "State Type")}
      </InspectorSectionHeader>
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
        <MenuItem value="standard">{t("packages.AgentDiagram.standard", "Standard")}</MenuItem>
        <MenuItem value="reasoning">{t("packages.AgentDiagram.reasoning", "Reasoning")}</MenuItem>
      </Select>

      {(needsLlm || needsChatLlm || needsPlatform) && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {needsLlm && (
            <Warning>
              {t(
                "packages.AgentDiagram.noLlmDefinedInDiagram",
                "⚠ No LLM is defined in the diagram, but this state requires one. Add an LLM in the Components page."
              )}
            </Warning>
          )}
          {needsChatLlm && (
            <Warning>
              {t(
                "packages.AgentDiagram.noLlmDefinedChatComponents",
                "⚠ LLM Chat requires an OpenAI or Hugging Face LLM, but none are defined."
              )}
            </Warning>
          )}
          {needsPlatform && (
            <Warning>
              {t(
                "packages.AgentDiagram.noWebSocketWarning",
                "⚠ This state has WebSocket reply actions, but the platform is not set to WebSocket."
              )}
            </Warning>
          )}
        </Box>
      )}

      {stateType === "reasoning" ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <DividerLine width="100%" />
          <Typography variant="caption">
            {t("packages.AgentDiagram.llmName", "LLM name")}
          </Typography>
          <Select
            size="small"
            fullWidth
            displayEmpty
            value={data.llm_name ?? ""}
            onChange={(e) => updateNode({ llm_name: String(e.target.value) })}
          >
            <MenuItem value="">
              {t("packages.AgentDiagram.selectPlaceholder", "(use default)")}
            </MenuItem>
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
            label={t("packages.AgentDiagram.maxSteps", "Max steps")}
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
                  onChange={(e) => updateNode({ enable_task_planning: e.target.checked })}
                />
              }
              label={t("packages.AgentDiagram.enableTaskPlanning", "Enable task planning")}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={data.stream_steps !== false}
                  onChange={(e) => updateNode({ stream_steps: e.target.checked })}
                />
              }
              label={t("packages.AgentDiagram.streamSteps", "Stream steps")}
            />
          </Stack>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            label={t("packages.AgentDiagram.systemPrompt", "System prompt")}
            placeholder={t(
              "packages.AgentDiagram.optionalSystemPromptPrefix",
              "Optional system prompt prefix for this state"
            )}
            value={data.system_prompt ?? ""}
            onChange={(e) => updateNode({ system_prompt: e.target.value })}
          />
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            label={t("packages.AgentDiagram.fallbackMessage", "Fallback message")}
            placeholder={t(
              "packages.AgentDiagram.messageReturnedIfReasoningFails",
              "Message returned if the reasoning loop fails"
            )}
            value={data.fallback_message ?? ""}
            onChange={(e) => updateNode({ fallback_message: e.target.value })}
          />
        </Box>
      ) : (
        <>
          <DividerLine width="100%" />
          <InspectorSectionHeader>{t("packages.AgentDiagram.body", "Body")}</InspectorSectionHeader>
          {renderBodySection("main")}

          <DividerLine width="100%" />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={fallbackEnabled}
                onChange={(e) => {
                  const checked = e.target.checked
                  // Clearing the toggle drops the fallback rows.
                  updateNode(
                    checked
                      ? { fallbackBodyEnabled: true }
                      : { fallbackBodyEnabled: false, fallbackBodies: [] }
                  )
                }}
              />
            }
            label={t("packages.AgentDiagram.enableFallbackBody", "Enable Fallback Body")}
          />
          {fallbackEnabled && (
            <>
              <InspectorSectionHeader>
                {t("packages.AgentDiagram.fallbackBody", "Fallback Body")}
              </InspectorSectionHeader>
              {renderBodySection("fallback")}
            </>
          )}
        </>
      )}
    </Box>
  )
}
