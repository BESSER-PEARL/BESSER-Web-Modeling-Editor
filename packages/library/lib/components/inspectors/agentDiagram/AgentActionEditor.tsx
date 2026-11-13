import {
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField as MuiTextField,
} from "@mui/material"
import React from "react"
import { AgentStateBodyRow } from "@/types"
import { Typography } from "@/components/ui"
import { useTranslation, type Translate } from "@/i18n"
import type { AgentGUIInfo } from "@/services/diagramBridge"
import { resolveReplyType } from "@/utils/agentActions"
import {
  getDbDisplayName,
  getRagDisplayName,
  isChatCompatibleProvider,
  LLM_PLACEHOLDER_NAME,
} from "./agentStateConstants"

/**
 * Per-action field editor for one AgentState body / fallback action,
 * rendered inside `AgentActionCard`'s expanded body.
 *
 * Port of smart-gen `agent-state-action-editor.tsx` +
 * `agent-state-action-fields.tsx` + `agent-state-db-reply-editor.tsx` +
 * `agent-state-web-crawl-editor.tsx` + `agent-state-ws-reply-editor.tsx`
 * (d765a3f8 session data flow, f0d17038 GUI replies, 639b0c42 layout).
 * Every field calls `onChange` with a partial patch; the parent merges it
 * into `data.bodies` / `data.fallbackBodies` (and stamps `actionType`).
 */

export interface AgentActionEditorProps {
  row: AgentStateBodyRow
  onChange: (patch: Partial<AgentStateBodyRow>) => void
  /** LLM names from the agent Components page (empty = "(use default)"). */
  llmNameOptions: string[]
  /** name → lowercased provider, for the llm_chat compatibility warning. */
  llmProviderByName: Record<string, string>
  /** RAG database names from the agent Components page. */
  ragDatabaseOptions: string[]
  /** GUIs from the agent Components page (for `gui_reply`). */
  guiOptions?: AgentGUIInfo[]
  /** Whether the agent platform is WebSocket (drives the ws_* reminder). */
  hasWebSocketPlatform: boolean
  /** Whether any chat-capable LLM exists (drives the llm_chat warning). */
  hasCompatibleChatLlm: boolean
}

type Patch = (patch: Partial<AgentStateBodyRow>) => void

const WARNING_COLOR = "#e04040"

export const Warning: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Typography
    variant="caption"
    sx={{ color: WARNING_COLOR, opacity: 0.9, display: "block", my: 0.5 }}
  >
    {children}
  </Typography>
)

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="caption"
    sx={{ opacity: 0.6, display: "block", fontStyle: "italic", mb: 0.5 }}
  >
    {children}
  </Typography>
)

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="caption" sx={{ fontWeight: 600, mt: 0.75 }}>
    {children}
  </Typography>
)

const CheckboxField: React.FC<{
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
}> = ({ checked, onChange, label }) => (
  <FormControlLabel
    sx={{ ml: 0, "& .MuiFormControlLabel-label": { fontSize: 12 } }}
    control={
      <Checkbox
        size="small"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        sx={{ p: 0.5 }}
      />
    }
    label={label}
  />
)

/** LLM select (+ unknown current value kept selectable). */
const LlmSelect: React.FC<{
  value: string
  llmNameOptions: string[]
  onChange: (value: string) => void
  t: Translate
}> = ({ value, llmNameOptions, onChange, t }) => {
  const names = [...llmNameOptions]
  if (value && !names.includes(value)) names.push(value)
  return (
    <Select
      size="small"
      fullWidth
      displayEmpty
      value={value}
      onChange={(e) => onChange(String(e.target.value))}
    >
      <MenuItem value="">
        {t("packages.AgentDiagram.selectPlaceholder", "(use default)")}
      </MenuItem>
      {names.map((name) => (
        <MenuItem key={name} value={name}>
          {name}
        </MenuItem>
      ))}
    </Select>
  )
}

/** LLM picker + system message (smart-gen `renderLlmNameField`). */
const LlmNameField: React.FC<{
  row: AgentStateBodyRow
  onChange: Patch
  llmNameOptions: string[]
  warning?: string
  t: Translate
}> = ({ row, onChange, llmNameOptions, warning, t }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
    <FieldLabel>{t("packages.AgentDiagram.llm", "LLM")}</FieldLabel>
    <LlmSelect
      value={row.llm_name ?? ""}
      llmNameOptions={llmNameOptions}
      onChange={(llm_name) => onChange({ llm_name })}
      t={t}
    />
    {warning && (
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        {warning}
      </Typography>
    )}
    <FieldLabel>
      {t("packages.AgentDiagram.systemMessage", "System message")}
    </FieldLabel>
    <MuiTextField
      size="small"
      variant="outlined"
      fullWidth
      multiline
      minRows={1}
      placeholder={t(
        "packages.AgentDiagram.youAreHelpfulAssistant",
        "You are a helpful assistant."
      )}
      value={legacySystemMessage(row)}
      onChange={(e) => onChange({ system_message: e.target.value })}
    />
  </Box>
)

/**
 * The system prompt of an LLM row. Pre-sync React Flow rows kept it on
 * `name` (the backend converter wrote a placeholder there otherwise);
 * smart-gen keeps it on `system_message`.
 */
const legacySystemMessage = (row: AgentStateBodyRow): string => {
  if (typeof row.system_message === "string") return row.system_message
  const name = row.name ?? ""
  const rt = resolveReplyType(row)
  if ((rt === "llm" || rt === "llm_chat") && name && name !== LLM_PLACEHOLDER_NAME) {
    return name
  }
  return ""
}

/** "Store result in session" (smart-gen `renderStoreInSession`). */
const StoreInSession: React.FC<{
  row: AgentStateBodyRow
  onChange: Patch
  t: Translate
}> = ({ row, onChange, t }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.75 }}>
    <FieldLabel>
      {t(
        "packages.AgentDiagram.storeResultInSession",
        "Store result in session (optional)"
      )}
    </FieldLabel>
    <MuiTextField
      size="small"
      variant="outlined"
      fullWidth
      placeholder={t(
        "packages.AgentDiagram.sessionKeyPlaceholder",
        "session_key (leave empty to skip)"
      )}
      value={row.storeInSession ?? ""}
      onChange={(e) => onChange({ storeInSession: e.target.value.trim() })}
    />
    {row.storeInSession ? (
      <Hint>
        {`${t("packages.AgentDiagram.resultStoredHintPrefix", "Result stored as")} {${row.storeInSession}} ${t("packages.AgentDiagram.resultStoredHintSuffix", "— reuse it in later states.")}`}
      </Hint>
    ) : null}
  </Box>
)

/** "Send as agent reply" (smart-gen `renderSendReply`). */
const SendReply: React.FC<{
  row: AgentStateBodyRow
  onChange: Patch
  t: Translate
}> = ({ row, onChange, t }) => (
  <CheckboxField
    checked={row.sendReply !== false}
    onChange={(sendReply) => onChange({ sendReply })}
    label={t(
      "packages.AgentDiagram.sendAsAgentReply",
      "Send as agent reply (uncheck to only store, not send)"
    )}
  />
)

/** Input prompt mode toggle + custom prompt (llm / rag / db_reply). */
const InputPromptField: React.FC<{
  row: AgentStateBodyRow
  onChange: Patch
  headerKey: string
  headerFallback: string
  placeholderKey?: string
  placeholderFallback?: string
  t: Translate
}> = ({
  row,
  onChange,
  headerKey,
  headerFallback,
  placeholderKey = "packages.AgentDiagram.customPromptExample",
  placeholderFallback = "e.g. Summarise: {user_message}. Context: {ctx}",
  t,
}) => {
  const mode = row.inputPromptMode || "last_user_message"
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.75 }}>
      <FieldLabel>{t(headerKey, headerFallback)}</FieldLabel>
      <div className="bp-segmented" role="group" aria-label={t(headerKey, headerFallback)}>
        <button
          type="button"
          className="bp-toggle"
          aria-pressed={mode === "last_user_message"}
          onClick={() =>
            onChange({ inputPromptMode: "last_user_message", customInputPrompt: "" })
          }
        >
          {t("packages.AgentDiagram.lastUserMessage", "Last user message")}
        </button>
        <button
          type="button"
          className="bp-toggle"
          aria-pressed={mode === "custom"}
          onClick={() => onChange({ inputPromptMode: "custom" })}
        >
          {t("packages.AgentDiagram.customPrompt", "Custom prompt")}
        </button>
      </div>
      {mode === "custom" && (
        <>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            placeholder={t(placeholderKey, placeholderFallback)}
            value={row.customInputPrompt ?? ""}
            onChange={(e) => onChange({ customInputPrompt: e.target.value })}
          />
          <Hint>
            {t(
              "packages.AgentDiagram.useUserMessageAndSessionHint",
              "Use {user_message} for the user's message, {key} for session values."
            )}
          </Hint>
          <CheckboxField
            checked={!!row.customInputPromptUseSessionVars}
            onChange={(customInputPromptUseSessionVars) =>
              onChange({ customInputPromptUseSessionVars })
            }
            label={t(
              "packages.AgentDiagram.replaceVarsAtRuntime",
              "Replace {vars} at runtime"
            )}
          />
        </>
      )}
    </Box>
  )
}

/** "Interpolate session variables" toggle with the usage hint. */
const SessionVarsToggle: React.FC<{
  checked: boolean
  onChange: (checked: boolean) => void
  labelKey: string
  labelFallback: string
  t: Translate
}> = ({ checked, onChange, labelKey, labelFallback, t }) => (
  <>
    <CheckboxField
      checked={checked}
      onChange={onChange}
      label={t(labelKey, labelFallback)}
    />
    {checked && (
      <Hint>
        {t(
          "packages.AgentDiagram.useSessionValuesHint",
          "Use {key} for session values, {user_message} for the current user message."
        )}
      </Hint>
    )}
  </>
)

export const AgentActionEditor: React.FC<AgentActionEditorProps> = ({
  row,
  onChange,
  llmNameOptions,
  llmProviderByName,
  ragDatabaseOptions,
  guiOptions = [],
  hasWebSocketPlatform,
  hasCompatibleChatLlm,
}) => {
  const { t } = useTranslation()
  const rt = resolveReplyType(row)
  const noLlm = llmNameOptions.length === 0

  switch (rt) {
    case "text":
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={1}
            placeholder={t(
              "packages.AgentDiagram.enterReplyMessage",
              "Enter reply message"
            )}
            value={row.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <SessionVarsToggle
            checked={!!row.useSessionVars}
            onChange={(useSessionVars) => onChange({ useSessionVars })}
            labelKey="packages.AgentDiagram.interpolateSessionVariables"
            labelFallback="Interpolate session variables"
            t={t}
          />
        </Box>
      )

    case "llm":
      return (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {noLlm && (
            <Warning>
              {t(
                "packages.AgentDiagram.noLlmDefined",
                "No LLM defined. Add one in the Agent Configuration."
              )}
            </Warning>
          )}
          <LlmNameField
            row={row}
            onChange={onChange}
            llmNameOptions={llmNameOptions}
            t={t}
          />
          <CheckboxField
            checked={!!row.systemPromptUseSessionVars}
            onChange={(systemPromptUseSessionVars) =>
              onChange({ systemPromptUseSessionVars })
            }
            label={t(
              "packages.AgentDiagram.interpolateVarsSystemMessage",
              "Interpolate {vars} in system message"
            )}
          />
          <InputPromptField
            row={row}
            onChange={onChange}
            headerKey="packages.AgentDiagram.inputSentToLlm"
            headerFallback="Input (sent to LLM)"
            t={t}
          />
          <StoreInSession row={row} onChange={onChange} t={t} />
          <SendReply row={row} onChange={onChange} t={t} />
        </Box>
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
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {!hasCompatibleChatLlm && (
            <Warning>
              {t(
                "packages.AgentDiagram.noLlmDefinedChat",
                "LLM Chat requires an OpenAI or Hugging Face LLM."
              )}
            </Warning>
          )}
          <LlmNameField
            row={row}
            onChange={onChange}
            llmNameOptions={llmNameOptions}
            warning={
              incompatibleSelection
                ? t(
                    "packages.AgentDiagram.warningIncompatibleProvider",
                    "Selected LLM provider is incompatible with chat(). Use OpenAI or Hugging Face."
                  )
                : undefined
            }
            t={t}
          />
          <CheckboxField
            checked={!!row.systemPromptUseSessionVars}
            onChange={(systemPromptUseSessionVars) =>
              onChange({ systemPromptUseSessionVars })
            }
            label={t(
              "packages.AgentDiagram.interpolateVarsSystemMessage",
              "Interpolate {vars} in system message"
            )}
          />
          <StoreInSession row={row} onChange={onChange} t={t} />
          <SendReply row={row} onChange={onChange} t={t} />
        </Box>
      )
    }

    case "rag": {
      const current = row.ragDatabaseName ?? ""
      const names =
        current && !ragDatabaseOptions.includes(current)
          ? [...ragDatabaseOptions, current]
          : ragDatabaseOptions
      return (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {noLlm && (
            <Warning>
              {t(
                "packages.AgentDiagram.noLlmDefinedRag",
                "No LLM defined. RAG requires an LLM. Add one in the Agent Configuration."
              )}
            </Warning>
          )}
          {names.length ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <FieldLabel>
                {t("packages.AgentDiagram.ragDatabase", "RAG database")}
              </FieldLabel>
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={current}
                onChange={(e) => {
                  const selected = String(e.target.value)
                  onChange({
                    ragDatabaseName: selected,
                    name: getRagDisplayName(t, selected),
                  })
                }}
              >
                <MenuItem value="">
                  {t("packages.AgentDiagram.selectRagDatabase", "Select RAG database")}
                </MenuItem>
                {names.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
              <FieldLabel>{t("packages.AgentDiagram.prompt", "Prompt")}</FieldLabel>
              <MuiTextField
                size="small"
                variant="outlined"
                fullWidth
                multiline
                minRows={2}
                placeholder={t(
                  "packages.AgentDiagram.optionalPromptPassed",
                  "Optional prompt passed to RAGReply(prompt=...)"
                )}
                value={row.prompt ?? ""}
                onChange={(e) => onChange({ prompt: e.target.value })}
              />
              <CheckboxField
                checked={!!row.promptUseSessionVars}
                onChange={(promptUseSessionVars) =>
                  onChange({ promptUseSessionVars })
                }
                label={t(
                  "packages.AgentDiagram.interpolateVarsInPrompt",
                  "Interpolate {vars} in prompt"
                )}
              />
            </Box>
          ) : (
            <Typography variant="caption" sx={{ opacity: 0.7, my: 0.5 }}>
              {t(
                "packages.AgentDiagram.noRagDatabases",
                "No RAG databases found. Create one from the palette first."
              )}
            </Typography>
          )}
          <InputPromptField
            row={row}
            onChange={onChange}
            headerKey="packages.AgentDiagram.inputSentToRag"
            headerFallback="Input (sent to RAG)"
            t={t}
          />
          <StoreInSession row={row} onChange={onChange} t={t} />
          <SendReply row={row} onChange={onChange} t={t} />
        </Box>
      )
    }

    case "db_reply":
      return (
        <DbReplyEditor
          row={row}
          onChange={onChange}
          llmNameOptions={llmNameOptions}
          t={t}
        />
      )

    case "code": {
      // Code rows are edited by the section's "Custom (Python)" editor.
      return null
    }

    case "web_crawl_llm":
      return (
        <WebCrawlEditor
          row={row}
          onChange={onChange}
          llmNameOptions={llmNameOptions}
          t={t}
        />
      )

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
          replyType={rt}
          onChange={onChange}
          hasWebSocketPlatform={hasWebSocketPlatform}
          t={t}
        />
      )

    case "gui_reply": {
      const current = row.guiId ?? ""
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <FieldLabel>{t("packages.AgentDiagram.guiHeader", "GUI")}</FieldLabel>
          {guiOptions.length === 0 ? (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {t(
                "packages.AgentDiagram.noGuisDefinedAction",
                "No GUIs defined. Create one in the Components page."
              )}
            </Typography>
          ) : (
            <Select
              size="small"
              fullWidth
              displayEmpty
              value={current}
              onChange={(e) => {
                const selected = String(e.target.value)
                const gui = guiOptions.find((g) => g.gui_id === selected)
                onChange({
                  guiId: selected,
                  name: gui
                    ? `${t("packages.AgentDiagram.guiReplyPrefix", "GUI Reply:")} ${gui.name}`
                    : t("packages.AgentDiagram.guiReplySelectGui", "GUI Reply (select GUI)"),
                })
              }}
            >
              <MenuItem value="">
                {t("packages.AgentDiagram.selectGui", "Select GUI")}
              </MenuItem>
              {current && !guiOptions.some((g) => g.gui_id === current) ? (
                <MenuItem value={current}>{current}</MenuItem>
              ) : null}
              {guiOptions.map((g) => (
                <MenuItem key={g.gui_id} value={g.gui_id}>
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          )}
        </Box>
      )
    }

    default:
      return null
  }
}

/** Database reply editor (smart-gen `agent-state-db-reply-editor.tsx`). */
const DbReplyEditor: React.FC<{
  row: AgentStateBodyRow
  onChange: Patch
  llmNameOptions: string[]
  t: Translate
}> = ({ row, onChange, llmNameOptions, t }) => {
  const dbSelectionType = row.dbSelectionType || "default"
  const dbQueryMode = row.dbQueryMode || "llm_query"
  const dbOperation = row.dbOperation || "any"
  const updateDb = (values: Partial<AgentStateBodyRow>) => {
    const next = { ...row, ...values }
    onChange({
      ...values,
      name: getDbDisplayName(
        t,
        next.dbSelectionType || "default",
        next.dbCustomName || "",
        next.dbQueryMode || "llm_query",
        next.dbOperation || "any"
      ),
    })
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <FieldLabel>
        {t("packages.AgentDiagram.selectDatabase", "Select a Database")}
      </FieldLabel>
      <Select
        size="small"
        fullWidth
        value={dbSelectionType}
        onChange={(e) => {
          const next = e.target.value === "custom" ? "custom" : "default"
          updateDb({
            dbSelectionType: next,
            dbCustomName: next === "default" ? "" : row.dbCustomName,
          })
        }}
      >
        <MenuItem value="default">
          {t("packages.AgentDiagram.defaultUsingAppDb", "Default (using the app DB)")}
        </MenuItem>
        <MenuItem value="custom">{t("packages.AgentDiagram.custom", "Custom")}</MenuItem>
      </Select>
      {dbSelectionType === "custom" && (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder={t(
            "packages.AgentDiagram.customDatabaseName",
            "Custom database name"
          )}
          value={row.dbCustomName ?? ""}
          onChange={(e) => updateDb({ dbCustomName: e.target.value })}
        />
      )}
      <FieldLabel>{t("packages.AgentDiagram.dbOperation", "DB operation")}</FieldLabel>
      <Select
        size="small"
        fullWidth
        value={dbOperation}
        onChange={(e) => {
          const value = String(e.target.value)
          const ops = ["any", "select", "insert", "update", "delete"]
          updateDb({ dbOperation: ops.includes(value) ? value : "any" })
        }}
      >
        <MenuItem value="any">{t("packages.AgentDiagram.any", "Any")}</MenuItem>
        <MenuItem value="select">{t("packages.AgentDiagram.select", "SELECT")}</MenuItem>
        <MenuItem value="insert">{t("packages.AgentDiagram.insert", "INSERT")}</MenuItem>
        <MenuItem value="update">{t("packages.AgentDiagram.update", "UPDATE")}</MenuItem>
        <MenuItem value="delete">{t("packages.AgentDiagram.delete", "DELETE")}</MenuItem>
      </Select>
      <RadioGroup
        row
        value={dbQueryMode}
        onChange={(e) =>
          e.target.value === "sql"
            ? updateDb({ dbQueryMode: "sql" })
            : updateDb({ dbQueryMode: "llm_query", dbSqlQuery: "" })
        }
      >
        <FormControlLabel
          value="llm_query"
          control={<Radio size="small" />}
          label={t("packages.AgentDiagram.llmQuery", "LLM query")}
          sx={{ "& .MuiFormControlLabel-label": { fontSize: 12 } }}
        />
        <FormControlLabel
          value="sql"
          control={<Radio size="small" />}
          label={t("packages.AgentDiagram.sql", "SQL")}
          sx={{ "& .MuiFormControlLabel-label": { fontSize: 12 } }}
        />
      </RadioGroup>
      {dbQueryMode === "sql" ? (
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          multiline
          minRows={2}
          placeholder={t(
            "packages.AgentDiagram.sqlQueryPlaceholder",
            "SELECT * FROM table_name"
          )}
          value={row.dbSqlQuery ?? ""}
          onChange={(e) => updateDb({ dbSqlQuery: e.target.value })}
        />
      ) : (
        <>
          {llmNameOptions.length === 0 && (
            <Warning>
              {t(
                "packages.AgentDiagram.noLlmQueryMode",
                "No LLM defined. LLM query mode requires an LLM. Add one in the Agent Configuration."
              )}
            </Warning>
          )}
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {t(
              "packages.AgentDiagram.answerWillBeGenerated",
              "Answer will be generated with LLM during runtime"
            )}
          </Typography>
          <LlmNameField
            row={row}
            onChange={onChange}
            llmNameOptions={llmNameOptions}
            t={t}
          />
          <InputPromptField
            row={row}
            onChange={onChange}
            headerKey="packages.AgentDiagram.inputSentToDbLlm"
            headerFallback="Input (sent to DB + LLM)"
            placeholderKey="packages.AgentDiagram.dbCustomPromptExample"
            placeholderFallback="e.g. Find orders for: {user_message}. Customer: {customer_id}"
            t={t}
          />
        </>
      )}
      <StoreInSession row={row} onChange={onChange} t={t} />
      <SendReply row={row} onChange={onChange} t={t} />
    </Box>
  )
}

/** Web crawl + LLM editor (smart-gen `agent-state-web-crawl-editor.tsx`). */
const WebCrawlEditor: React.FC<{
  row: AgentStateBodyRow
  onChange: Patch
  llmNameOptions: string[]
  t: Translate
}> = ({ row, onChange, llmNameOptions, t }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
    {llmNameOptions.length === 0 && (
      <Warning>
        {t(
          "packages.AgentDiagram.noLlmDefinedWeb",
          "No LLM defined. Web Crawl + LLM requires an LLM. Add one in the Agent Configuration."
        )}
      </Warning>
    )}
    <FieldLabel>{t("packages.AgentDiagram.initialUrl", "Initial URL")}</FieldLabel>
    <MuiTextField
      size="small"
      variant="outlined"
      fullWidth
      placeholder={t("packages.AgentDiagram.httpsExample", "https://example.com")}
      value={row.initial_url ?? ""}
      onChange={(e) => {
        const value = e.target.value
        onChange({
          initial_url: value,
          name: value
            ? `${t("packages.AgentDiagram.webCrawlNamePrefix", "Crawl:")} ${value.slice(0, 40)}`
            : t("packages.AgentDiagram.webCrawlLlmSetUrl", "Web Crawl + LLM (set URL)"),
        })
      }}
    />
    <FieldLabel>
      {t("packages.AgentDiagram.baseUrlPrefixOptional", "Base URL prefix (optional)")}
    </FieldLabel>
    <MuiTextField
      size="small"
      variant="outlined"
      fullWidth
      placeholder={t(
        "packages.AgentDiagram.baseUrlPrefixExample",
        "https://example.com/docs"
      )}
      value={row.base_url_prefix ?? ""}
      onChange={(e) => onChange({ base_url_prefix: e.target.value })}
    />
    <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
      <MuiTextField
        size="small"
        variant="outlined"
        fullWidth
        type="number"
        label={t("packages.AgentDiagram.maxDepth", "Max depth")}
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
        label={t("packages.AgentDiagram.maxPages", "Max pages")}
        value={row.max_pages ?? 20}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10)
          onChange({ max_pages: Number.isNaN(parsed) ? 20 : parsed })
        }}
      />
    </Stack>
    <FieldLabel>{t("packages.AgentDiagram.crawlFormat", "Crawl format")}</FieldLabel>
    <Select
      size="small"
      fullWidth
      value={row.crawl_format ?? "markdown"}
      onChange={(e) => onChange({ crawl_format: String(e.target.value) })}
    >
      <MenuItem value="markdown">{t("packages.AgentDiagram.markdown", "Markdown")}</MenuItem>
      <MenuItem value="text">{t("packages.AgentDiagram.plainText", "Plain text")}</MenuItem>
      <MenuItem value="html">{t("packages.AgentDiagram.html", "HTML")}</MenuItem>
    </Select>
    <CheckboxField
      checked={row.run_crawl !== false}
      onChange={(run_crawl) => onChange({ run_crawl })}
      label={t(
        "packages.AgentDiagram.runCrawl",
        "Run crawl (uncheck to reuse cached result)"
      )}
    />
    {row.run_crawl === false && (
      <>
        <FieldLabel>
          {t("packages.AgentDiagram.noCrawlErrorMessage", "No-crawl error message")}
        </FieldLabel>
        <MuiTextField
          size="small"
          variant="outlined"
          fullWidth
          placeholder={t(
            "packages.AgentDiagram.noCrawlErrorDefault",
            "No web crawl data is available yet."
          )}
          value={row.no_crawl_error_message ?? ""}
          onChange={(e) => onChange({ no_crawl_error_message: e.target.value })}
        />
      </>
    )}
    <FieldLabel>
      {t(
        "packages.AgentDiagram.systemMessagePrefixOptional",
        "System message prefix (optional)"
      )}
    </FieldLabel>
    <MuiTextField
      size="small"
      variant="outlined"
      fullWidth
      multiline
      minRows={2}
      placeholder={t(
        "packages.AgentDiagram.useFollowingWebpageContent",
        "Use the following webpage content to answer the question:"
      )}
      value={row.system_message_prefix ?? ""}
      onChange={(e) => onChange({ system_message_prefix: e.target.value })}
    />
    {row.system_message_prefix ? (
      <SessionVarsToggle
        checked={!!row.systemMessagePrefixUseSessionVars}
        onChange={(systemMessagePrefixUseSessionVars) =>
          onChange({ systemMessagePrefixUseSessionVars })
        }
        labelKey="packages.AgentDiagram.interpolateVarsSystemMessagePrefix"
        labelFallback="Interpolate {vars} in system message prefix"
        t={t}
      />
    ) : null}
    <FieldLabel>{t("packages.AgentDiagram.llm", "LLM")}</FieldLabel>
    <LlmSelect
      value={row.llm_name ?? ""}
      llmNameOptions={llmNameOptions}
      onChange={(llm_name) => onChange({ llm_name })}
      t={t}
    />
    <StoreInSession row={row} onChange={onChange} t={t} />
    <SendReply row={row} onChange={onChange} t={t} />
  </Box>
)

/** WebSocket-reply editor for the 9 `ws_*` kinds (smart-gen `agent-state-ws-reply-editor.tsx`). */
const WebSocketReplyEditor: React.FC<{
  row: AgentStateBodyRow
  replyType: string
  onChange: Patch
  hasWebSocketPlatform: boolean
  t: Translate
}> = ({ row, replyType: rt, onChange, hasWebSocketPlatform, t }) => {
  const platformWarning = !hasWebSocketPlatform ? (
    <Warning>
      {t(
        "packages.AgentDiagram.requiresWebSocketWarning",
        "This action requires a WebSocket Platform. You can change the Agent Platform in the Configuration Page."
      )}
    </Warning>
  ) : null
  const sessionVars = (
    <SessionVarsToggle
      checked={!!row.useSessionVars}
      onChange={(useSessionVars) => onChange({ useSessionVars })}
      labelKey="packages.AgentDiagram.interpolateVarsInMessage"
      labelFallback="Interpolate {vars} in message"
      t={t}
    />
  )

  let content: React.ReactNode = null
  switch (rt) {
    case "ws_markdown":
    case "ws_html":
      content = (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <FieldLabel>{t("packages.AgentDiagram.message", "Message")}</FieldLabel>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            placeholder={
              rt === "ws_markdown"
                ? t("packages.AgentDiagram.markdownPlaceholder", "**Bold**, *italic*, etc.")
                : t("packages.AgentDiagram.htmlPlaceholder", "<p>HTML content</p>")
            }
            value={row.ws_message ?? ""}
            onChange={(e) => {
              const v = e.target.value
              onChange({
                ws_message: v,
                name: v
                  ? v.slice(0, 40)
                  : rt === "ws_markdown"
                    ? t("packages.AgentDiagram.markdownEmpty", "Markdown (empty)")
                    : t("packages.AgentDiagram.htmlEmpty", "HTML (empty)"),
              })
            }}
          />
          {sessionVars}
        </Box>
      )
      break
    case "ws_speech":
      content = (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <FieldLabel>{t("packages.AgentDiagram.message", "Message")}</FieldLabel>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            placeholder={t(
              "packages.AgentDiagram.speechPlaceholder",
              "Text to convert to speech"
            )}
            value={row.ws_message ?? ""}
            onChange={(e) => onChange({ ws_message: e.target.value })}
          />
          {sessionVars}
          <FieldLabel>
            {t("packages.AgentDiagram.audioSpeedOptional", "Audio speed (optional)")}
          </FieldLabel>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            placeholder={t("packages.AgentDiagram.default", "1.0 (default)")}
            value={row.ws_audio_speed ?? ""}
            onChange={(e) => {
              const raw = e.target.value
              const parsed = parseFloat(raw)
              onChange({
                ws_audio_speed: raw === "" || Number.isNaN(parsed) ? null : parsed,
              })
            }}
          />
        </Box>
      )
      break
    case "ws_options":
      content = (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <FieldLabel>
            {t("packages.AgentDiagram.optionsOnePerLine", "Options (one per line)")}
          </FieldLabel>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={3}
            placeholder={t("packages.AgentDiagram.optionsPlaceholder", "Yes\nNo\nMaybe")}
            value={row.ws_options ?? ""}
            onChange={(e) => {
              const v = e.target.value
              const count = v.split("\n").filter(Boolean).length
              onChange({
                ws_options: v,
                name:
                  count > 0
                    ? `${t("packages.AgentDiagram.optionsItemsCountPrefix", "Options:")} ${count} ${t("packages.AgentDiagram.optionItems", "option(s)")}`
                    : t("packages.AgentDiagram.optionsNoOptions", "Options (no options)"),
              })
            }}
          />
        </Box>
      )
      break
    case "ws_location":
      content = (
        <Stack direction="row" spacing={1}>
          <MuiTextField
            size="small"
            variant="outlined"
            fullWidth
            label={t("packages.AgentDiagram.latitude", "Latitude")}
            placeholder={t("packages.AgentDiagram.eg48", "e.g. 48.8566")}
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
            label={t("packages.AgentDiagram.longitude", "Longitude")}
            placeholder={t("packages.AgentDiagram.eg23", "e.g. 2.3522")}
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
        <Warning>
          {t(
            "packages.AgentDiagram.placeholderWarning.wsFile",
            "The generated code contains a placeholder. You must assign a baf.types.File object to reply_file_obj before this state is reached."
          )}
        </Warning>
      )
      break
    case "ws_image":
      content = (
        <Warning>
          {t(
            "packages.AgentDiagram.placeholderWarning.wsImage",
            "The generated code contains a placeholder. You must assign a numpy.ndarray image to reply_image_arr before this state is reached."
          )}
        </Warning>
      )
      break
    case "ws_dataframe":
      content = (
        <Warning>
          {t(
            "packages.AgentDiagram.placeholderWarning.wsDataframe",
            "The generated code contains a placeholder. You must assign a pandas.DataFrame to reply_df before this state is reached."
          )}
        </Warning>
      )
      break
    case "ws_plotly":
      content = (
        <Warning>
          {t(
            "packages.AgentDiagram.placeholderWarning.wsPlotly",
            "The generated code contains a placeholder. You must assign a plotly.graph_objs.Figure to reply_plot before this state is reached."
          )}
        </Warning>
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
