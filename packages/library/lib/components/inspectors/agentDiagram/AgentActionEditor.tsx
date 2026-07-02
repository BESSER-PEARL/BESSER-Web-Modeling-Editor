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
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { AgentStateBodyRow } from "@/types"
import { Typography } from "@/components/ui"
import { RagDbFields } from "./RagDbFields"

/**
 * Per-`replyType` field editor for a single AgentState body / fallback
 * action. Rendered inside `AgentActionCard`'s expanded body from both the
 * main and fallback sections in `AgentStateEditPanel.tsx`.
 *
 * Develop source: `agent-state-diagram/agent-state/agent-state-update.tsx`
 * `renderActionEditor` + all per-type sub-renderers (L866-1549):
 * `renderLlmNameField`, `renderWebCrawlLlmEditor`,
 * `renderWebSocketReplyEditor`, and the RAG / DB delegates.
 *
 * Pure switch-over-`replyType`: every field calls `onChange` with a
 * partial patch and the parent merges it into `data.bodies` /
 * `data.fallbackBodies`. `rag` / `db_reply` delegate to the shared
 * `RagDbFields`; `code` reuses the CodeMirror-python pattern used across
 * the agent inspectors.
 */

export interface AgentActionEditorProps {
  row: AgentStateBodyRow
  onChange: (patch: Partial<AgentStateBodyRow>) => void
  /** Registered `AgentLLM` names (empty = "(use default)"). */
  llmNameOptions: string[]
  /** name → lowercased provider, for the llm_chat compatibility warning. */
  llmProviderByName: Record<string, string>
  /** RAG database names sourced from sibling `AgentRagElement` nodes. */
  ragDatabaseOptions: string[]
  /** Whether the agent platform is WebSocket (drives the ws_* reminder). */
  hasWebSocketPlatform: boolean
  /** Whether any OpenAI / Hugging Face LLM exists (drives llm_chat warning). */
  hasCompatibleChatLlm: boolean
}

const CRAWL_FORMATS = [
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Plain text" },
  { value: "html", label: "HTML" },
] as const

const WsWarning: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="caption"
    sx={{ color: "#e04040", opacity: 0.85, display: "block", my: 0.5 }}
  >
    {children}
  </Typography>
)

const isChatCompatibleProvider = (provider: string): boolean =>
  provider === "openai" || provider === "huggingface"

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

/** Render the "LLM" picker + system-message field shared by llm / llm_chat. */
const LlmNameField: React.FC<{
  row: AgentStateBodyRow
  onChange: (patch: Partial<AgentStateBodyRow>) => void
  llmNameOptions: string[]
  warning?: string
}> = ({ row, onChange, llmNameOptions, warning }) => {
  const names = [...llmNameOptions]
  const current = row.llm_name ?? ""
  if (current && !names.includes(current)) names.push(current)
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="caption">LLM</Typography>
      <Select
        size="small"
        fullWidth
        displayEmpty
        value={current}
        onChange={(e) => onChange({ llm_name: String(e.target.value) })}
      >
        <MenuItem value="">(use default)</MenuItem>
        {names.map((name) => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
      </Select>
      {warning && (
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {warning}
        </Typography>
      )}
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        label="System message"
        placeholder="You are a helpful assistant."
        value={row.system_message ?? ""}
        onChange={(e) => onChange({ system_message: e.target.value })}
      />
    </Box>
  )
}

export const AgentActionEditor: React.FC<AgentActionEditorProps> = ({
  row,
  onChange,
  llmNameOptions,
  llmProviderByName,
  ragDatabaseOptions,
  hasWebSocketPlatform,
  hasCompatibleChatLlm,
}) => {
  const rt = row.replyType ?? "text"
  const noLlm = llmNameOptions.length === 0

  switch (rt) {
    case "text":
      return (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          multiline
          minRows={1}
          placeholder="Enter reply message"
          value={row.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      )

    case "llm":
      return (
        <>
          {noLlm && (
            <WsWarning>
              No LLM defined. Add one in the Agent Configuration.
            </WsWarning>
          )}
          <LlmNameField
            row={row}
            onChange={onChange}
            llmNameOptions={llmNameOptions}
          />
        </>
      )

    case "llm_chat": {
      const selectedProvider = row.llm_name
        ? llmProviderByName[row.llm_name]
        : ""
      const incompatibleSelection = Boolean(
        row.llm_name &&
          selectedProvider &&
          !isChatCompatibleProvider(selectedProvider)
      )
      return (
        <>
          {!hasCompatibleChatLlm && (
            <WsWarning>
              LLM Chat requires an OpenAI or Hugging Face LLM. Add one from the
              palette and set its provider accordingly.
            </WsWarning>
          )}
          <LlmNameField
            row={row}
            onChange={onChange}
            llmNameOptions={llmNameOptions}
            warning={
              incompatibleSelection
                ? "Selected LLM provider is incompatible with chat(). Use OpenAI or Hugging Face."
                : undefined
            }
          />
        </>
      )
    }

    case "rag":
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {noLlm && (
            <WsWarning>
              No LLM defined. RAG requires an LLM. Add one in the Agent
              Configuration.
            </WsWarning>
          )}
          <RagDbFields
            value={row}
            onChange={(patch) => {
              const next = { ...row, ...patch }
              onChange({
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
            label="Prompt (optional)"
            placeholder="Optional prompt passed to RAGReply(prompt=…)"
            value={row.prompt ?? ""}
            onChange={(e) => onChange({ prompt: e.target.value })}
          />
        </Box>
      )

    case "db_reply":
      return (
        <RagDbFields
          value={row}
          onChange={(patch) => {
            const next = { ...row, ...patch }
            onChange({
              ...patch,
              name: getDbDisplayName(
                next.dbSelectionType,
                next.dbCustomName,
                next.dbQueryMode,
                next.dbOperation
              ),
            })
          }}
          llmNameOptions={llmNameOptions}
          showRag={false}
          showDb
        />
      )

    case "code": {
      const codeValue =
        (typeof row.code === "string" && row.code) || row.name || ""
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
            onChange={(v) => onChange({ code: v, name: v })}
            basicSetup={{ lineNumbers: true, tabSize: 4, indentOnInput: true }}
            placeholder="def action_name(session: AgentSession):\n    …"
          />
        </Box>
      )
    }

    case "web_crawl_llm": {
      const crawlFormat = row.crawl_format ?? "markdown"
      const names = [...llmNameOptions]
      const current = row.llm_name ?? ""
      if (current && !names.includes(current)) names.push(current)
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {noLlm && (
            <WsWarning>
              No LLM defined. Web Crawl + LLM requires an LLM. Add one in the
              Agent Configuration.
            </WsWarning>
          )}
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            label="Initial URL"
            placeholder="https://example.com"
            value={row.initial_url ?? ""}
            onChange={(e) => {
              const value = e.target.value
              onChange({
                initial_url: value,
                name: value
                  ? `Crawl: ${value.slice(0, 40)}`
                  : "Web Crawl + LLM (set URL)",
              })
            }}
          />
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            label="Base URL prefix (optional)"
            placeholder="https://example.com/docs"
            value={row.base_url_prefix ?? ""}
            onChange={(e) => onChange({ base_url_prefix: e.target.value })}
          />
          <Stack direction="row" spacing={1}>
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              type="number"
              label="Max depth"
              value={row.max_depth ?? 2}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10)
                onChange({ max_depth: Number.isNaN(parsed) ? 2 : parsed })
              }}
            />
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              type="number"
              label="Max pages"
              value={row.max_pages ?? 20}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10)
                onChange({ max_pages: Number.isNaN(parsed) ? 20 : parsed })
              }}
            />
          </Stack>
          <Typography variant="caption">Crawl format</Typography>
          <Select
            size="small"
            fullWidth
            value={crawlFormat}
            onChange={(e) => onChange({ crawl_format: String(e.target.value) })}
          >
            {CRAWL_FORMATS.map((f) => (
              <MenuItem key={f.value} value={f.value}>
                {f.label}
              </MenuItem>
            ))}
          </Select>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={row.run_crawl !== false}
                onChange={(e) => onChange({ run_crawl: e.target.checked })}
              />
            }
            label="Run crawl (uncheck to reuse cached result)"
          />
          {row.run_crawl === false && (
            <MuiTextField
              size="small"
              variant="outlined"
              fullWidth
              label="No-crawl error message"
              placeholder="No web crawl data is available yet."
              value={row.no_crawl_error_message ?? ""}
              onChange={(e) =>
                onChange({ no_crawl_error_message: e.target.value })
              }
            />
          )}
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            label="System message prefix (optional)"
            placeholder="Use the following webpage content to answer the question:"
            value={row.system_message_prefix ?? ""}
            onChange={(e) =>
              onChange({ system_message_prefix: e.target.value })
            }
          />
          <Typography variant="caption">LLM</Typography>
          <Select
            size="small"
            fullWidth
            displayEmpty
            value={current}
            onChange={(e) => onChange({ llm_name: String(e.target.value) })}
          >
            <MenuItem value="">(use default)</MenuItem>
            {names.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </Box>
      )
    }

    case "ws_markdown":
    case "ws_html":
    case "ws_speech":
    case "ws_options":
    case "ws_location":
    case "ws_file":
    case "ws_image":
    case "ws_dataframe":
    case "ws_plotly":
      return (
        <WebSocketReplyEditor
          row={row}
          onChange={onChange}
          hasWebSocketPlatform={hasWebSocketPlatform}
        />
      )

    default:
      return null
  }
}

/** WebSocket-reply editor for the 9 `ws_*` kinds (develop L1168-1310). */
const WebSocketReplyEditor: React.FC<{
  row: AgentStateBodyRow
  onChange: (patch: Partial<AgentStateBodyRow>) => void
  hasWebSocketPlatform: boolean
}> = ({ row, onChange, hasWebSocketPlatform }) => {
  const rt = row.replyType ?? ""
  const platformWarning = !hasWebSocketPlatform ? (
    <WsWarning>
      This action requires a WebSocket Platform. You can change the Agent
      Platform in the Configuration Page.
    </WsWarning>
  ) : null

  let content: React.ReactNode = null
  switch (rt) {
    case "ws_markdown":
    case "ws_html":
      content = (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          multiline
          minRows={2}
          label="Message"
          placeholder={
            rt === "ws_markdown" ? "**Bold**, *italic*, etc." : "<p>HTML content</p>"
          }
          value={row.ws_message ?? ""}
          onChange={(e) => {
            const v = e.target.value
            onChange({
              ws_message: v,
              name: v ? v.slice(0, 40) : `${rt === "ws_markdown" ? "Markdown" : "HTML"} (empty)`,
            })
          }}
        />
      )
      break
    case "ws_speech":
      content = (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            label="Message (text to speech)"
            placeholder="Text to convert to speech"
            value={row.ws_message ?? ""}
            onChange={(e) => onChange({ ws_message: e.target.value })}
          />
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            label="Audio speed (optional)"
            placeholder="1.0 (default)"
            value={row.ws_audio_speed ?? ""}
            onChange={(e) => {
              const raw = e.target.value
              const parsed = parseFloat(raw)
              onChange({
                ws_audio_speed:
                  raw === "" || Number.isNaN(parsed) ? null : parsed,
              })
            }}
          />
        </Box>
      )
      break
    case "ws_options":
      content = (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          multiline
          minRows={3}
          label="Options (one per line)"
          placeholder={"Yes\nNo\nMaybe"}
          value={row.ws_options ?? ""}
          onChange={(e) => {
            const v = e.target.value
            const count = v.split("\n").filter(Boolean).length
            onChange({
              ws_options: v,
              name: count > 0 ? `Options: ${count} item(s)` : "Options (no options)",
            })
          }}
        />
      )
      break
    case "ws_location":
      content = (
        <Stack direction="row" spacing={1}>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            label="Latitude"
            placeholder="e.g. 48.8566"
            value={String(row.ws_latitude ?? 0)}
            onChange={(e) => {
              const p = parseFloat(String(e.target.value).replace(",", "."))
              if (!Number.isNaN(p)) onChange({ ws_latitude: p })
            }}
          />
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            label="Longitude"
            placeholder="e.g. 2.3522"
            value={String(row.ws_longitude ?? 0)}
            onChange={(e) => {
              const p = parseFloat(String(e.target.value).replace(",", "."))
              if (!Number.isNaN(p)) onChange({ ws_longitude: p })
            }}
          />
        </Stack>
      )
      break
    case "ws_file":
      content = (
        <WsWarning>
          The generated code contains a placeholder. You must assign a{" "}
          <code>baf.types.File</code> object to <code>reply_file_obj</code>{" "}
          before this state is reached.
        </WsWarning>
      )
      break
    case "ws_image":
      content = (
        <WsWarning>
          The generated code contains a placeholder. You must assign a{" "}
          <code>numpy.ndarray</code> image to <code>reply_image_arr</code>{" "}
          before this state is reached.
        </WsWarning>
      )
      break
    case "ws_dataframe":
      content = (
        <WsWarning>
          The generated code contains a placeholder. You must assign a{" "}
          <code>pandas.DataFrame</code> to <code>reply_df</code> before this
          state is reached.
        </WsWarning>
      )
      break
    case "ws_plotly":
      content = (
        <WsWarning>
          The generated code contains a placeholder. You must assign a{" "}
          <code>plotly.graph_objs.Figure</code> to <code>reply_plot</code>{" "}
          before this state is reached.
        </WsWarning>
      )
      break
    default:
      break
  }

  return (
    <>
      {platformWarning}
      {content}
    </>
  )
}
