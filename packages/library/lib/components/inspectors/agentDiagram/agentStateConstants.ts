/**
 * Static tables and pure helpers of the AgentState inspector.
 *
 * Port of smart-gen `agent-state-diagram/agent-state/
 * agent-state-update-constants.ts`: the tables hold i18n KEYS (resolved
 * with `t()` at render time) so they can live at module scope.
 */
import {
  AGENT_LLM_PROVIDERS,
  NON_CHAT_AGENT_LLM_PROVIDERS,
} from "@/services/agentLlm"
import type { Translate } from "@/i18n"

/** smart-gen 347bc646: no quotes around `Session` in the default body. */
export const DEFAULT_PYTHON_BODY = "def body_name(session: Session):\n    pass\n"

/** Placeholder the old converters wrote on the name of an LLM row. */
export const LLM_PLACEHOLDER_NAME = "AI response 🪄"

export const WS_REPLY_TYPES: ReadonlySet<string> = new Set([
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

export const PLACEHOLDER_ACTIONS: ReadonlySet<string> = new Set([
  "ws_file",
  "ws_image",
  "ws_dataframe",
  "ws_plotly",
])

export const LLM_ACTION_TYPES: ReadonlySet<string> = new Set([
  "llm",
  "llm_chat",
  "rag",
  "web_crawl_llm",
])

export type ActionSection = "simple" | "ai" | "data"

export const SIMPLE_LEFT_COLUMN = [
  "text",
  "ws_speech",
  "ws_options",
  "gui_reply",
  "ws_location",
  "ws_html",
  "ws_markdown",
]
export const SIMPLE_RIGHT_COLUMN = [
  "ws_file",
  "ws_image",
  "ws_dataframe",
  "ws_plotly",
]

export const SECTION_ACTION_TYPES: Record<ActionSection, string[]> = {
  simple: [...SIMPLE_LEFT_COLUMN, ...SIMPLE_RIGHT_COLUMN],
  ai: ["llm", "llm_chat"],
  data: ["rag", "db_reply", "web_crawl_llm"],
}

export const ACTION_DESCRIPTION_KEYS: Record<string, string> = {
  text: "packages.AgentDiagram.actionDesc.text",
  llm: "packages.AgentDiagram.actionDesc.llm",
  llm_chat: "packages.AgentDiagram.actionDesc.llmChat",
  rag: "packages.AgentDiagram.actionDesc.rag",
  db_reply: "packages.AgentDiagram.actionDesc.dbReply",
  web_crawl_llm: "packages.AgentDiagram.actionDesc.webCrawlLlm",
  ws_markdown: "packages.AgentDiagram.actionDesc.wsMarkdown",
  ws_html: "packages.AgentDiagram.actionDesc.wsHtml",
  ws_speech: "packages.AgentDiagram.actionDesc.wsSpeech",
  ws_options: "packages.AgentDiagram.actionDesc.wsOptions",
  ws_location: "packages.AgentDiagram.actionDesc.wsLocation",
  ws_file: "packages.AgentDiagram.actionDesc.wsFile",
  ws_image: "packages.AgentDiagram.actionDesc.wsImage",
  ws_dataframe: "packages.AgentDiagram.actionDesc.wsDataframe",
  ws_plotly: "packages.AgentDiagram.actionDesc.wsPlotly",
  gui_reply: "packages.AgentDiagram.actionDesc.guiReply",
}

export const PLACEHOLDER_WARNING_KEYS: Record<string, string> = {
  ws_file: "packages.AgentDiagram.placeholderWarning.wsFile",
  ws_image: "packages.AgentDiagram.placeholderWarning.wsImage",
  ws_dataframe: "packages.AgentDiagram.placeholderWarning.wsDataframe",
  ws_plotly: "packages.AgentDiagram.placeholderWarning.wsPlotly",
}

export const ACTION_TYPE_LABEL_KEYS: Record<string, string> = {
  text: "packages.AgentDiagram.actionTypeLabel.text",
  llm: "packages.AgentDiagram.actionTypeLabel.llm",
  llm_chat: "packages.AgentDiagram.actionTypeLabel.llmChat",
  rag: "packages.AgentDiagram.actionTypeLabel.rag",
  db_reply: "packages.AgentDiagram.actionTypeLabel.dbReply",
  code: "packages.AgentDiagram.actionTypeLabel.code",
  web_crawl_llm: "packages.AgentDiagram.actionTypeLabel.webCrawlLlm",
  ws_markdown: "packages.AgentDiagram.actionTypeLabel.wsMarkdown",
  ws_html: "packages.AgentDiagram.actionTypeLabel.wsHtml",
  ws_speech: "packages.AgentDiagram.actionTypeLabel.wsSpeech",
  ws_options: "packages.AgentDiagram.actionTypeLabel.wsOptions",
  ws_location: "packages.AgentDiagram.actionTypeLabel.wsLocation",
  ws_file: "packages.AgentDiagram.actionTypeLabel.wsFile",
  ws_image: "packages.AgentDiagram.actionTypeLabel.wsImage",
  ws_dataframe: "packages.AgentDiagram.actionTypeLabel.wsDataframe",
  ws_plotly: "packages.AgentDiagram.actionTypeLabel.wsPlotly",
  gui_reply: "packages.AgentDiagram.actionTypeLabel.guiReply",
}

/** English fallbacks for the action-type labels (keys above). */
const ACTION_TYPE_LABEL_FALLBACKS: Record<string, string> = {
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
  gui_reply: "GUI",
}

export const actionTypeLabel = (t: Translate, replyType: string): string => {
  const key = ACTION_TYPE_LABEL_KEYS[replyType]
  return key
    ? t(key, ACTION_TYPE_LABEL_FALLBACKS[replyType] ?? replyType)
    : replyType
}

/**
 * Providers whose wrapper exposes a chat API (smart-gen: every canonical
 * provider except the declared non-chat ones).
 */
export const isChatCompatibleProvider = (provider: string): boolean =>
  (AGENT_LLM_PROVIDERS as readonly string[]).includes(provider) &&
  !NON_CHAT_AGENT_LLM_PROVIDERS.includes(provider)

export const getRagDisplayName = (t: Translate, databaseName?: string): string => {
  const trimmed = (databaseName || "").trim()
  return trimmed.length
    ? `${t("packages.AgentDiagram.ragReplyUsingPrefix", "RAG reply using")} ${trimmed} ${t("packages.AgentDiagram.ragReplyUsingSuffix", "database")}`
    : t("packages.AgentDiagram.ragReplySelectDatabase", "RAG reply (select database)")
}

export const getDefaultDbReplyValues = () => ({
  dbSelectionType: "default",
  dbCustomName: "",
  dbQueryMode: "llm_query",
  dbOperation: "any",
  dbSqlQuery: "",
})

export const getDbDisplayName = (
  t: Translate,
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
        : t("packages.AgentDiagram.customDatabase", "custom database")
      : t("packages.AgentDiagram.defaultDatabase", "Default database")
  const modeLabel =
    dbQueryMode === "sql"
      ? t("packages.AgentDiagram.sqlMode", "SQL")
      : t("packages.AgentDiagram.llmQueryMode", "LLM query")
  const opLabel =
    !dbOperation || dbOperation === "any"
      ? t("packages.AgentDiagram.any", "Any")
      : dbOperation.toUpperCase()
  return `${t("packages.AgentDiagram.dbActionUsingPrefix", "DB action using")} ${dbLabel} (${modeLabel}, ${opLabel})`
}
