// Static data and pure helpers of the agent state property panel.
import { AGENT_LLM_PROVIDERS, NON_CHAT_AGENT_LLM_PROVIDERS } from '../agent-llm/agent-llm';
import { AgentStateBody } from '../agent-state-body/agent-state-body';
import { AgentStateFallbackBody } from '../agent-state-fallback-body/agent-state-fallback-body';
import { AgentStateMember } from './agent-state-member';

export type AgentStateMemberClass = typeof AgentStateBody | typeof AgentStateFallbackBody;

export type Translate = (id: string) => string;

export const DEFAULT_PYTHON_BODY = 'def body_name(session: Session):\n    pass\n';

export const WS_REPLY_TYPES = new Set([
  'ws_markdown',
  'ws_html',
  'ws_speech',
  'ws_options',
  'ws_location',
  'ws_file',
  'ws_image',
  'ws_dataframe',
  'ws_plotly',
]);

export const PLACEHOLDER_ACTIONS = new Set(['ws_file', 'ws_image', 'ws_dataframe', 'ws_plotly']);

// Maps of reply-type -> i18n key. Resolved via translate() at render time
// (module scope cannot access this.props.translate).
export const ACTION_DESCRIPTION_KEYS: Record<string, string> = {
  text: 'packages.AgentDiagram.actionDesc.text',
  llm: 'packages.AgentDiagram.actionDesc.llm',
  llm_chat: 'packages.AgentDiagram.actionDesc.llmChat',
  rag: 'packages.AgentDiagram.actionDesc.rag',
  db_reply: 'packages.AgentDiagram.actionDesc.dbReply',
  web_crawl_llm: 'packages.AgentDiagram.actionDesc.webCrawlLlm',
  ws_markdown: 'packages.AgentDiagram.actionDesc.wsMarkdown',
  ws_html: 'packages.AgentDiagram.actionDesc.wsHtml',
  ws_speech: 'packages.AgentDiagram.actionDesc.wsSpeech',
  ws_options: 'packages.AgentDiagram.actionDesc.wsOptions',
  ws_location: 'packages.AgentDiagram.actionDesc.wsLocation',
  ws_file: 'packages.AgentDiagram.actionDesc.wsFile',
  ws_image: 'packages.AgentDiagram.actionDesc.wsImage',
  ws_dataframe: 'packages.AgentDiagram.actionDesc.wsDataframe',
  ws_plotly: 'packages.AgentDiagram.actionDesc.wsPlotly',
  gui_reply: 'packages.AgentDiagram.actionDesc.guiReply',
};

export const PLACEHOLDER_WARNING_KEYS: Record<string, string> = {
  ws_file: 'packages.AgentDiagram.placeholderWarning.wsFile',
  ws_image: 'packages.AgentDiagram.placeholderWarning.wsImage',
  ws_dataframe: 'packages.AgentDiagram.placeholderWarning.wsDataframe',
  ws_plotly: 'packages.AgentDiagram.placeholderWarning.wsPlotly',
};

export type ActionSection = 'simple' | 'ai' | 'data';

export const SIMPLE_LEFT_COLUMN  = ['text', 'ws_speech', 'ws_options', 'gui_reply', 'ws_location', 'ws_html', 'ws_markdown'];
export const SIMPLE_RIGHT_COLUMN = ['ws_file', 'ws_image', 'ws_dataframe', 'ws_plotly'];

export const SECTION_ACTION_TYPES: Record<ActionSection, string[]> = {
  simple: [...SIMPLE_LEFT_COLUMN, ...SIMPLE_RIGHT_COLUMN],
  ai: ['llm', 'llm_chat'],
  data: ['rag', 'db_reply', 'web_crawl_llm'],
};

export const ALL_ACTION_TYPES = [...SECTION_ACTION_TYPES.simple, ...SECTION_ACTION_TYPES.ai, ...SECTION_ACTION_TYPES.data];

export type DbReplyValues = {
  dbSelectionType: string;
  dbCustomName: string;
  dbQueryMode: string;
  dbOperation: string;
  dbSqlQuery: string;
};

export type MemberSnapshot = {
  replyType: string;
  name: string;
  ragDatabaseName: string;
  prompt: string;
  dbSelectionType: string;
  dbCustomName: string;
  dbQueryMode: string;
  dbOperation: string;
  dbSqlQuery: string;
  llm_name: string;
  system_message: string;
  inputPromptMode: string;
  customInputPrompt: string;
  customInputPromptUseSessionVars: boolean;
  systemPromptUseSessionVars: boolean;
  promptUseSessionVars: boolean;
  storeInSession: string;
  useSessionVars: boolean;
  initial_url: string;
  max_depth: number;
  max_pages: number;
  crawl_format: string;
  base_url_prefix: string;
  run_crawl: boolean;
  no_crawl_error_message: string;
  system_message_prefix: string;
  systemMessagePrefixUseSessionVars: boolean;
  sendReply: boolean;
  ws_message: string;
  ws_audio_speed: number | null;
  ws_options: string;
  ws_latitude: number;
  ws_longitude: number;
  guiId: string;
};

// Maps of reply-type -> i18n key for the short action-type labels. Resolved
// via translate() at render time (module scope cannot access this.props.translate).
export const ACTION_TYPE_LABEL_KEYS: Record<string, string> = {
  text: 'packages.AgentDiagram.actionTypeLabel.text',
  llm: 'packages.AgentDiagram.actionTypeLabel.llm',
  llm_chat: 'packages.AgentDiagram.actionTypeLabel.llmChat',
  rag: 'packages.AgentDiagram.actionTypeLabel.rag',
  db_reply: 'packages.AgentDiagram.actionTypeLabel.dbReply',
  code: 'packages.AgentDiagram.actionTypeLabel.code',
  web_crawl_llm: 'packages.AgentDiagram.actionTypeLabel.webCrawlLlm',
  ws_markdown: 'packages.AgentDiagram.actionTypeLabel.wsMarkdown',
  ws_html: 'packages.AgentDiagram.actionTypeLabel.wsHtml',
  ws_speech: 'packages.AgentDiagram.actionTypeLabel.wsSpeech',
  ws_options: 'packages.AgentDiagram.actionTypeLabel.wsOptions',
  ws_location: 'packages.AgentDiagram.actionTypeLabel.wsLocation',
  ws_file: 'packages.AgentDiagram.actionTypeLabel.wsFile',
  ws_image: 'packages.AgentDiagram.actionTypeLabel.wsImage',
  ws_dataframe: 'packages.AgentDiagram.actionTypeLabel.wsDataframe',
  ws_plotly: 'packages.AgentDiagram.actionTypeLabel.wsPlotly',
  gui_reply: 'packages.AgentDiagram.actionTypeLabel.guiReply',
};

// Derived from the canonical list rather than re-listed, so a newly added
// provider is chat-capable by default and only the genuine exceptions
// (huggingface_api, replicate) have to be declared.
export const isChatCompatibleProvider = (provider: string): boolean =>
  (AGENT_LLM_PROVIDERS as readonly string[]).includes(provider) && !NON_CHAT_AGENT_LLM_PROVIDERS.includes(provider);

export const getRagDisplayName = (translate: Translate, databaseName: string): string => {
  const trimmed = (databaseName || '').trim();
  return trimmed.length
    ? `${translate('packages.AgentDiagram.ragReplyUsingPrefix')} ${trimmed} ${translate('packages.AgentDiagram.ragReplyUsingSuffix')}`
    : translate('packages.AgentDiagram.ragReplySelectDatabase');
};

export const getDefaultDbReplyValues = (): DbReplyValues => ({
  dbSelectionType: 'default',
  dbCustomName: '',
  dbQueryMode: 'llm_query',
  dbOperation: 'any',
  dbSqlQuery: '',
});

export const getDbDisplayName = (
  translate: Translate,
  dbSelectionType: string,
  dbCustomName: string,
  dbQueryMode: string,
  dbOperation: string,
): string => {
  const customDb = (dbCustomName || '').trim();
  const dbLabel =
    dbSelectionType === 'custom'
      ? (customDb.length ? customDb : translate('packages.AgentDiagram.customDatabase'))
      : translate('packages.AgentDiagram.defaultDatabase');
  const modeLabel = dbQueryMode === 'sql'
    ? translate('packages.AgentDiagram.sqlMode')
    : translate('packages.AgentDiagram.llmQueryMode');
  const opLabel = dbOperation === 'any' ? translate('packages.AgentDiagram.any') : dbOperation.toUpperCase();
  return `${translate('packages.AgentDiagram.dbActionUsingPrefix')} ${dbLabel} (${modeLabel}, ${opLabel})`;
};

export const snapshotMember = (a: AgentStateMember): MemberSnapshot => ({
  replyType: a.replyType,
  name: a.name,
  ragDatabaseName: a.ragDatabaseName,
  prompt: a.prompt,
  dbSelectionType: a.dbSelectionType,
  dbCustomName: a.dbCustomName,
  dbQueryMode: a.dbQueryMode,
  dbOperation: a.dbOperation,
  dbSqlQuery: a.dbSqlQuery,
  llm_name: a.llm_name,
  system_message: a.system_message,
  inputPromptMode: a.inputPromptMode,
  customInputPrompt: a.customInputPrompt,
  customInputPromptUseSessionVars: a.customInputPromptUseSessionVars,
  systemPromptUseSessionVars: a.systemPromptUseSessionVars,
  promptUseSessionVars: a.promptUseSessionVars,
  storeInSession: a.storeInSession,
  useSessionVars: a.useSessionVars,
  initial_url: a.initial_url,
  max_depth: a.max_depth,
  max_pages: a.max_pages,
  crawl_format: a.crawl_format,
  base_url_prefix: a.base_url_prefix,
  run_crawl: a.run_crawl,
  no_crawl_error_message: a.no_crawl_error_message,
  system_message_prefix: a.system_message_prefix,
  systemMessagePrefixUseSessionVars: a.systemMessagePrefixUseSessionVars,
  sendReply: a.sendReply,
  ws_message: a.ws_message,
  ws_audio_speed: a.ws_audio_speed,
  ws_options: a.ws_options,
  ws_latitude: a.ws_latitude,
  ws_longitude: a.ws_longitude,
  guiId: a.guiId,
});
