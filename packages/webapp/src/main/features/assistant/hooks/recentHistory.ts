import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { HistoryTurn } from '../services/AssistantClient';

/**
 * The conversation before `currentMessage`, as the turns the modeling agent can
 * rebuild its memory from (BESSER#745). Status lines (progress, errors, the
 * still-streaming reply) are not conversation, so they are left out. The
 * message being sent is already in the list (it is appended before it is sent),
 * so its last occurrence is dropped: the agent records it itself.
 */
export const recentHistoryFrom = (messages: readonly ChatKitMessage[], currentMessage: string): HistoryTurn[] => {
  const turns = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.isProgress && !m.isError && !m.isStreaming)
    .map((m) => ({ role: m.role as HistoryTurn['role'], content: typeof m.content === 'string' ? m.content : '' }));
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i].role === 'user' && turns[i].content.trim() === currentMessage.trim()) {
      turns.splice(i, 1);
      break;
    }
  }
  return turns;
};
