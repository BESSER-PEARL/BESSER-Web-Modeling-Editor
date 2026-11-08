import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { ProjectConversation, ProjectConversationTurn } from '../../../shared/types/project';
import { recentHistoryFrom } from './recentHistory';

/**
 * The assistant conversation kept on the project (BESSER#745): saved with it
 * in the browser and written to its GitHub repo, so the user's specification
 * outlives the chat session. Bounded so the project file stays small.
 */
export const MAX_PROJECT_CONVERSATION_TURNS = 50;
export const MAX_PROJECT_CONVERSATION_CHARS = 4000;

/** The conversation's turns as stored on the project: newest kept, long ones cut. */
export const projectConversationTurns = (messages: readonly ChatKitMessage[]): ProjectConversationTurn[] =>
  recentHistoryFrom(messages, '')
    .filter((t) => t.content.trim().length > 0)
    .slice(-MAX_PROJECT_CONVERSATION_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_PROJECT_CONVERSATION_CHARS) }));

export const sameTurns = (
  a: readonly ProjectConversationTurn[],
  b: readonly ProjectConversationTurn[] | undefined,
): boolean =>
  a.length === (b?.length ?? 0) && a.every((t, i) => t.role === b![i].role && t.content === b![i].content);

/** The project field for these turns: none for an empty conversation. */
export const toProjectConversation = (turns: ProjectConversationTurn[]): ProjectConversation | undefined =>
  turns.length > 0 ? { turns, updatedAt: new Date().toISOString() } : undefined;

/** Chat messages for a conversation read back from a project. */
export const messagesFromProjectConversation = (
  conversation: ProjectConversation | undefined,
  makeMessage: (role: ProjectConversationTurn['role'], content: string) => ChatKitMessage,
): ChatKitMessage[] =>
  (conversation?.turns ?? [])
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
    .map((t) => makeMessage(t.role, t.content));
