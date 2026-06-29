/**
 * assistantConversationStore — single source of truth for the assistant
 * conversation, shared by the floating widget AND the workspace drawer.
 *
 * Both surfaces use ONE AssistantClient (one socket, one session). They must
 * also render IDENTICAL conversation content — so messages + messageMeta live
 * here (a tiny external store) instead of in each surface's own useState. Every
 * write (optimistic user-message append, streaming updates, injection results,
 * clearConversation, voice placeholders) goes through these setters, so both
 * surfaces re-render together.
 *
 * It also owns the SINGLE-DISPATCH registry: the message/injection/action
 * handlers mutate shared state / run real side-effects (e.g. applying a diagram
 * injection), so they must run ONCE per event, not once per mounted surface.
 * Surfaces register their handlers via setConversationHandlers (last writer
 * wins; the handlers are equivalent) and the dispatchers are wired exactly once
 * on the shared client.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { ChatMessage, InjectionCommand, AssistantActionPayload } from '../services';
// Type-only import — erased at runtime, so no circular dependency with the hook.
import type { MessageMeta } from './useAssistantLogic';

/* ------------------------------------------------------------------ */
/*  Shared conversation state (external store)                        */
/* ------------------------------------------------------------------ */

let messages: ChatKitMessage[] = [];
let messageMeta: Record<string, MessageMeta> = {};
const listeners = new Set<() => void>();
const emit = (): void => {
  listeners.forEach((l) => l());
};

export const conversationStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  // Stable references between changes -> safe for useSyncExternalStore.
  getMessages(): ChatKitMessage[] {
    return messages;
  },
  getMessageMeta(): Record<string, MessageMeta> {
    return messageMeta;
  },
  // setState-compatible (value OR functional updater), so every existing
  // setMessages/setMessageMeta call site works unchanged.
  setMessages: ((action: SetStateAction<ChatKitMessage[]>): void => {
    const next =
      typeof action === 'function'
        ? (action as (prev: ChatKitMessage[]) => ChatKitMessage[])(messages)
        : action;
    if (next !== messages) {
      messages = next;
      emit();
    }
  }) as Dispatch<SetStateAction<ChatKitMessage[]>>,
  setMessageMeta: ((action: SetStateAction<Record<string, MessageMeta>>): void => {
    const next =
      typeof action === 'function'
        ? (action as (prev: Record<string, MessageMeta>) => Record<string, MessageMeta>)(messageMeta)
        : action;
    if (next !== messageMeta) {
      messageMeta = next;
      emit();
    }
  }) as Dispatch<SetStateAction<Record<string, MessageMeta>>>,
  clear(): void {
    if (messages.length === 0 && Object.keys(messageMeta).length === 0) return;
    messages = [];
    messageMeta = {};
    emit();
  },
};

/* ------------------------------------------------------------------ */
/*  Single-dispatch handler registry                                  */
/* ------------------------------------------------------------------ */

interface ConversationHandlers {
  onMessage: (message: ChatMessage) => void;
  onInjection: (command: InjectionCommand) => void;
  onAction: (payload: AssistantActionPayload) => void;
}

interface DispatchableClient {
  onMessage: (cb: (message: ChatMessage) => void) => () => void;
  onInjection: (cb: (command: InjectionCommand) => void) => () => void;
  onAction: (cb: (payload: AssistantActionPayload) => void) => () => void;
}

let currentHandlers: ConversationHandlers | null = null;
let dispatchersWired = false;

/** Point the single dispatchers at the latest mounted surface's handlers. */
export function setConversationHandlers(handlers: ConversationHandlers): void {
  currentHandlers = handlers;
}

/**
 * Wire the shared client's message/injection/action handlers EXACTLY ONCE.
 * Each event then runs a single dispatcher (not one per mounted surface), so a
 * reply is appended once and an injection is applied once. Idempotent.
 */
export function wireConversationDispatchers(client: DispatchableClient): void {
  if (dispatchersWired) return;
  dispatchersWired = true;
  client.onMessage((message) => currentHandlers?.onMessage(message));
  client.onInjection((command) => currentHandlers?.onInjection(command));
  client.onAction((payload) => currentHandlers?.onAction(payload));
}
