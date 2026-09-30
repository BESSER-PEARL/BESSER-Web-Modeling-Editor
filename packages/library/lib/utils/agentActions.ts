/**
 * AgentState body-row action types.
 *
 * A body row carries the informal `replyType` (editor discriminator) and,
 * since smart-gen, the metamodel class name as `actionType`. Writers emit
 * both; readers prefer `actionType` and fall back to `replyType`. Same maps
 * as the smart-gen `AgentStateMember` and the backend agent processor.
 */

export const REPLY_TYPE_TO_ACTION_TYPE: Readonly<Record<string, string>> = {
  text: "TextReplyAction",
  llm: "LLMReplyAction",
  llm_chat: "LLMChatAction",
  rag: "RAGReplyAction",
  db_reply: "DBAction",
  code: "CustomCodeAction",
  web_crawl_llm: "WebCrawlLLMAction",
  ws_markdown: "WebSocketReplyMarkdownAction",
  ws_html: "WebSocketReplyHTMLAction",
  ws_speech: "WebSocketReplySpeechAction",
  ws_options: "WebSocketReplyOptionsAction",
  ws_location: "WebSocketReplyLocationAction",
  ws_file: "WebSocketReplyFileAction",
  ws_image: "WebSocketReplyImageAction",
  ws_dataframe: "WebSocketReplyDataframeAction",
  ws_plotly: "WebSocketReplyPlotlyAction",
  gui_reply: "GUIReplyAction",
}

export const ACTION_TYPE_TO_REPLY_TYPE: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries(REPLY_TYPE_TO_ACTION_TYPE).map(([reply, action]) => [
      action,
      reply,
    ])
  )

/** The editor `replyType` of a row (prefers `actionType`, defaults to `'text'`). */
export const resolveReplyType = (row: {
  replyType?: unknown
  actionType?: unknown
}): string => {
  if (typeof row.actionType === "string" && row.actionType) {
    return ACTION_TYPE_TO_REPLY_TYPE[row.actionType] ?? row.actionType
  }
  return typeof row.replyType === "string" && row.replyType
    ? row.replyType
    : "text"
}

/** A row with `replyType` and the matching `actionType` both set. */
export const withActionType = <
  T extends { replyType?: string; actionType?: string },
>(
  row: T
): T => {
  const replyType = resolveReplyType(row)
  return {
    ...row,
    replyType,
    actionType: REPLY_TYPE_TO_ACTION_TYPE[replyType] ?? replyType,
  }
}
