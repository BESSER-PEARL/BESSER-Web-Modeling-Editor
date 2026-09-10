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
 *
 * PERSISTENCE (survives full-page reloads): the conversation used to live only
 * in these module-level variables, so any full-page navigation wiped it — most
 * painfully the GitHub OAuth connect flow (app → backend auth endpoint →
 * github.com → /auth/callback → app), which reloads the SPA and lost the whole
 * chat right when the user connected to push their work. The store now mirrors
 * a BOUNDED, sanitized projection of the conversation into sessionStorage
 * (tab-scoped, like the assistant session id and the github_session token —
 * the OAuth redirect returns to the same tab) on every change (debounced, with
 * a pagehide flush so the write always lands before a navigation), and
 * restores it at module load. clearConversation / project switches write the
 * emptied state through the same path, so the persisted copy always matches
 * what the user last saw.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { ChatMessage, InjectionCommand, AssistantActionPayload } from '../services';
// Type-only import — erased at runtime, so no circular dependency with the hook.
import type { MessageMeta } from './useAssistantLogic';

/* ------------------------------------------------------------------ */
/*  Persistence (sessionStorage-backed, bounded, best-effort)         */
/* ------------------------------------------------------------------ */

export const CONVERSATION_STORAGE_KEY = 'besser_assistant_conversation_v1';
/** Newest messages kept when persisting (older ones are dropped first). */
export const MAX_PERSISTED_MESSAGES = 100;
/** Hard cap on the serialized payload; oldest messages are shed to fit. */
export const MAX_PERSISTED_BYTES = 200 * 1024;
/** Ignore a persisted conversation older than this (defensive: browser
 * "restore tabs" can revive sessionStorage days later). */
const MAX_PERSISTED_AGE_MS = 48 * 60 * 60 * 1000;
const PERSIST_DEBOUNCE_MS = 400;

interface StoredConversation {
  savedAt: number;
  messages: unknown[];
  messageMeta: Record<string, MessageMeta>;
}

const getSessionStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    // Accessing sessionStorage itself can throw (sandboxed iframe).
    return null;
  }
};

/**
 * Project one message into a JSON-safe, lean shape for persistence.
 * Returns null for messages that must not be persisted:
 *  - still-streaming messages (incomplete; the finalizing write re-persists),
 *  - transient progress/status bubbles ("Still working…", timing lines),
 *  - spec-driven run cards still 'running' (their SSE stream cannot be
 *    re-attached after a reload — a frozen "running" card is worse than none).
 * Heavy / unserializable fields are dropped:
 *  - experimental_attachments (data-URL previews, can be MBs),
 *  - specDriven.deterministicBlob (a Blob; the card's Download button gates on
 *    `instanceof Blob`, so a restored card degrades gracefully without it).
 * `createdAt` (a Date) becomes an ISO string; revived on restore.
 */
export const sanitizeMessageForPersist = (message: ChatKitMessage): Record<string, unknown> | null => {
  if (!message || typeof message.id !== 'string') return null;
  if (message.isStreaming) return null;
  if (message.isProgress) return null;
  if (message.specDriven?.status === 'running') return null;

  const { experimental_attachments: _attachments, createdAt, specDriven, ...rest } = message;
  const out: Record<string, unknown> = { ...rest };
  if (createdAt instanceof Date && !isNaN(createdAt.getTime())) {
    out.createdAt = createdAt.toISOString();
  } else {
    delete out.createdAt;
  }
  if (specDriven) {
    const { deterministicBlob: _blob, ...specRest } = specDriven;
    out.specDriven = specRest;
  }
  return out;
};

/** Build the bounded, serialized payload — or null when there is nothing to store. */
export const serializeConversation = (
  allMessages: ChatKitMessage[],
  allMeta: Record<string, MessageMeta>,
): string | null => {
  let sanitized = allMessages
    .slice(-MAX_PERSISTED_MESSAGES)
    .map(sanitizeMessageForPersist)
    .filter((m): m is Record<string, unknown> => m !== null);

  const buildPayload = (): string => {
    const keptIds = new Set(sanitized.map((m) => m.id as string));
    const meta: Record<string, MessageMeta> = {};
    for (const [id, value] of Object.entries(allMeta)) {
      if (keptIds.has(id)) meta[id] = value;
    }
    const stored: StoredConversation = { savedAt: Date.now(), messages: sanitized, messageMeta: meta };
    return JSON.stringify(stored);
  };

  let payload = buildPayload();
  // Shed oldest messages until the payload fits the byte budget.
  while (payload.length > MAX_PERSISTED_BYTES && sanitized.length > 1) {
    sanitized = sanitized.slice(Math.ceil(sanitized.length / 4));
    payload = buildPayload();
  }
  if (payload.length > MAX_PERSISTED_BYTES) return null;
  return payload;
};

/** Parse + revive a stored conversation. Never throws; returns null when the
 * payload is missing, malformed, or expired. */
export const reviveStoredConversation = (
  raw: string | null,
): { messages: ChatKitMessage[]; messageMeta: Record<string, MessageMeta> } | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredConversation;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_PERSISTED_AGE_MS) {
      return null;
    }
    const revived: ChatKitMessage[] = [];
    for (const entry of parsed.messages) {
      if (!entry || typeof entry !== 'object') continue;
      const m = entry as Record<string, unknown>;
      if (typeof m.id !== 'string' || typeof m.role !== 'string' || typeof m.content !== 'string') {
        continue;
      }
      const msg = { ...m } as unknown as ChatKitMessage;
      if (typeof m.createdAt === 'string') {
        const date = new Date(m.createdAt);
        msg.createdAt = isNaN(date.getTime()) ? undefined : date;
      } else {
        msg.createdAt = undefined;
      }
      // Defensive: never restore an in-flight flag.
      msg.isStreaming = false;
      revived.push(msg);
    }
    if (revived.length === 0) return null;
    const meta =
      parsed.messageMeta && typeof parsed.messageMeta === 'object' && !Array.isArray(parsed.messageMeta)
        ? parsed.messageMeta
        : {};
    return { messages: revived, messageMeta: meta };
  } catch {
    return null;
  }
};

const restoreFromStorage = (): { messages: ChatKitMessage[]; messageMeta: Record<string, MessageMeta> } => {
  const storage = getSessionStorage();
  if (!storage) return { messages: [], messageMeta: {} };
  try {
    const revived = reviveStoredConversation(storage.getItem(CONVERSATION_STORAGE_KEY));
    if (revived) return revived;
  } catch {
    // fall through to a fresh conversation
  }
  return { messages: [], messageMeta: {} };
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;

const persistNow = (): void => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    if (messages.length === 0) {
      storage.removeItem(CONVERSATION_STORAGE_KEY);
      return;
    }
    const payload = serializeConversation(messages, messageMeta);
    if (payload === null) return; // over budget even after shedding — keep last good copy
    storage.setItem(CONVERSATION_STORAGE_KEY, payload);
  } catch {
    // Quota exceeded / storage unavailable — persistence is best-effort.
  }
};

const schedulePersist = (): void => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, PERSIST_DEBOUNCE_MS);
};

// Flush the debounced write before the page unloads — this is the moment that
// matters for the GitHub OAuth redirect (window.location.href navigation).
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    persistNow();
  });
}

/* ------------------------------------------------------------------ */
/*  Shared conversation state (external store)                        */
/* ------------------------------------------------------------------ */

const restored = restoreFromStorage();
let messages: ChatKitMessage[] = restored.messages;
let messageMeta: Record<string, MessageMeta> = restored.messageMeta;
const listeners = new Set<() => void>();
const emit = (): void => {
  listeners.forEach((l) => l());
  schedulePersist();
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
