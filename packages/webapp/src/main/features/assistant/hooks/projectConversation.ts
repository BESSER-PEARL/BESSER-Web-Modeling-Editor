import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import { readLlmKey } from '../../../shared/services/llmKeyStorage';
import type { ProjectConversation, ProjectConversationTurn } from '../../../shared/types/project';
import { recentHistoryFrom } from './recentHistory';

/**
 * The assistant conversation kept on the project (BESSER#745): saved with it
 * in the browser and written to its GitHub repo, so the user's specification
 * outlives the chat session. Bounded so the project file stays small.
 */
export const MAX_PROJECT_CONVERSATION_TURNS = 50;
export const MAX_PROJECT_CONVERSATION_CHARS = 4000;
const REDACTED_KEY = '[API key removed]';

/** Newest turns kept, long ones cut: applied on write and again on read. */
const boundTurns = (turns: readonly ProjectConversationTurn[]): ProjectConversationTurn[] =>
  turns
    .slice(-MAX_PROJECT_CONVERSATION_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_PROJECT_CONVERSATION_CHARS) }));

/**
 * The conversation's turns as stored on the project: newest kept, long ones cut.
 * The project goes to localStorage and the user's repository, where an API key
 * must never go, so the stored key is removed if the user pasted it into the chat.
 */
export const projectConversationTurns = (messages: readonly ChatKitMessage[]): ProjectConversationTurn[] => {
  const key = readLlmKey()?.apiKey ?? '';
  const turns = recentHistoryFrom(messages, '')
    .map((t) => (key ? { ...t, content: t.content.split(key).join(REDACTED_KEY) } : t))
    .filter((t) => t.content.trim().length > 0);
  return boundTurns(turns);
};

export const sameTurns = (
  a: readonly ProjectConversationTurn[],
  b: readonly ProjectConversationTurn[] | undefined,
): boolean => {
  const other = Array.isArray(b) ? b : [];
  return a.length === other.length && a.every((t, i) => t.role === other[i]?.role && t.content === other[i]?.content);
};

/** The project field for these turns: none for an empty conversation. */
export const toProjectConversation = (turns: ProjectConversationTurn[]): ProjectConversation | undefined =>
  turns.length > 0 ? { turns, updatedAt: new Date().toISOString() } : undefined;

const isTurn = (value: unknown): value is ProjectConversationTurn =>
  typeof value === 'object' &&
  value !== null &&
  ((value as ProjectConversationTurn).role === 'user' || (value as ProjectConversationTurn).role === 'assistant') &&
  typeof (value as ProjectConversationTurn).content === 'string';

/**
 * Chat messages for a conversation read back from a project. The project may
 * come from an imported file or someone else's repository, so the field is
 * checked: anything that is not a list of turns restores nothing.
 */
export const messagesFromProjectConversation = (
  conversation: ProjectConversation | undefined,
  makeMessage: (role: ProjectConversationTurn['role'], content: string) => ChatKitMessage,
): ChatKitMessage[] => {
  const turns: unknown = (conversation as { turns?: unknown } | undefined)?.turns;
  if (!Array.isArray(turns)) return [];
  return boundTurns(turns.filter(isTurn)).map((t) => makeMessage(t.role, t.content));
};
