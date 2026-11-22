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
 * PERSISTENCE: the conversation belongs to the open project, like its diagrams.
 * A bounded, sanitized copy is kept in localStorage under the project's id
 * (`openProject` binds the store to it), so every tab that opens the project,
 * and the same tab after a reload or the GitHub OAuth redirect, continues the
 * same dialogue. Writes are debounced, with a pagehide flush so the last one
 * lands before a navigation. A tab open on the same project picks up another
 * tab's write from the `storage` event (`adoptStoredConversation`).
 */
import type { Dispatch, SetStateAction } from 'react';
import type { Message as ChatKitMessage } from '@/components/chatbot-kit/ui/chat-message';
import type { ChatMessage, InjectionCommand, AssistantActionPayload } from '../services';
// Type-only import — erased at runtime, so no circular dependency with the hook.
import type { MessageMeta } from './useAssistantLogic';
import {
  conversationStorageKey,
  readStoredConversation,
  takeLegacyTabConversation,
  writeStoredConversation,
} from '../../../shared/services/storage/assistantStorage';
import { llmKeyRedactor } from '../../../shared/services/llmKeyStorage';

/* ------------------------------------------------------------------ */
/*  Persistence (localStorage per project, bounded, best-effort)      */
/* ------------------------------------------------------------------ */

/** Newest messages kept when persisting (older ones are dropped first). */
export const MAX_PERSISTED_MESSAGES = 100;
/** Hard cap on the serialized payload, in UTF-16 code units (`string.length`); oldest messages are shed to fit. */
export const MAX_PERSISTED_CHARS = 200 * 1024;
/** A per-tab copy from before v8.9.3 older than this is not moved to the project
 * (browser "restore tabs" can revive sessionStorage days later). */
const LEGACY_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const PERSIST_DEBOUNCE_MS = 400;

// savedAt stays the first key: assistantStorage reads it to evict the oldest conversation.
interface StoredConversation {
  savedAt: number;
  conversationId?: string;
  messages: unknown[];
  messageMeta: Record<string, MessageMeta>;
}

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

/** Build the bounded, serialized payload — or null when it does not fit. It goes
 * to localStorage, so the stored BYOK key is removed from every string in it. */
export const serializeConversation = (
  allMessages: ChatKitMessage[],
  allMeta: Record<string, MessageMeta>,
  conversationId?: string,
): string | null => {
  const redact = llmKeyRedactor();
  const redactStrings = (_key: string, value: unknown) => (typeof value === 'string' ? redact(value) : value);
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
    const stored: StoredConversation = { savedAt: Date.now(), conversationId, messages: sanitized, messageMeta: meta };
    return JSON.stringify(stored, redactStrings);
  };

  let payload = buildPayload();
  // Shed oldest messages until the payload fits the byte budget.
  while (payload.length > MAX_PERSISTED_CHARS && sanitized.length > 1) {
    sanitized = sanitized.slice(Math.ceil(sanitized.length / 4));
    payload = buildPayload();
  }
  if (payload.length > MAX_PERSISTED_CHARS) return null;
  return payload;
};

export interface RevivedConversation {
  messages: ChatKitMessage[];
  messageMeta: Record<string, MessageMeta>;
  conversationId?: string;
}

/* A stored conversation is read back in every tab, so a value the renderers
   would crash on is dropped here rather than trusted. */

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isListOf = (value: unknown, item: (entry: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(item);
const isString = (value: unknown): boolean => typeof value === 'string';
const CARD_STATUSES = ['running', 'done', 'error'];

const isPhase = (value: unknown): boolean =>
  isRecord(value) &&
  isString(value.phase) &&
  isString(value.label) &&
  isString(value.message) &&
  isListOf(value.toolCalls, (call) => isRecord(call) && isString(call.tool));
const isWarning = (value: unknown): boolean => isRecord(value) && isString(value.code) && isString(value.message);
const isVerification = (value: unknown): boolean =>
  isRecord(value) &&
  isListOf(value.verified, isRecord) &&
  isListOf(value.notVerified, isRecord) &&
  isListOf(value.shippedUnenforced, isRecord) &&
  isRecord(value.counts);

/** The run card as stored, or undefined when a field the card reads unguarded is wrong; a wrong optional list is dropped. */
const reviveCard = (value: unknown): ChatKitMessage['specDriven'] => {
  if (
    !isRecord(value) ||
    !CARD_STATUSES.includes(value.status as string) ||
    !isString(value.text) ||
    !isListOf(value.phases, isPhase) ||
    !isListOf(value.warnings, isWarning)
  ) {
    return undefined;
  }
  const card: Json = { ...value };
  if (card.verification !== undefined && !isVerification(card.verification)) delete card.verification;
  for (const field of ['changedFiles', 'modelChanges']) {
    if (card[field] !== undefined && !isListOf(card[field], isString)) delete card[field];
  }
  return card as unknown as ChatKitMessage['specDriven'];
};

/** The message details as stored, keeping only fields of the right type. */
const reviveMeta = (value: unknown): MessageMeta | undefined => {
  if (!isRecord(value)) return undefined;
  const meta: MessageMeta = {};
  if (isListOf(value.suggestedActions, (a) => isRecord(a) && isString(a.label) && isString(a.prompt))) {
    meta.suggestedActions = value.suggestedActions as MessageMeta['suggestedActions'];
  }
  if (value.badge === 'injection' || value.badge === 'error' || value.badge === 'generation') meta.badge = value.badge;
  if (isString(value.badgeLabel)) meta.badgeLabel = value.badgeLabel as string;
  if (typeof value.needsApiKey === 'boolean') meta.needsApiKey = value.needsApiKey;
  return Object.keys(meta).length > 0 ? meta : undefined;
};

/** Parse + revive a stored conversation. Never throws; returns null when the
 * payload is missing, malformed, or older than `maxAgeMs` when given. A new
 * chat is stored as no messages, so its conversation id reaches other tabs. */
export const reviveStoredConversation = (raw: string | null, maxAgeMs?: number): RevivedConversation | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredConversation;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    if (typeof parsed.savedAt !== 'number' || (maxAgeMs !== undefined && Date.now() - parsed.savedAt > maxAgeMs)) {
      return null;
    }
    const revived: ChatKitMessage[] = [];
    for (const entry of parsed.messages) {
      if (!isRecord(entry)) continue;
      const m = entry;
      if (typeof m.id !== 'string' || typeof m.role !== 'string' || typeof m.content !== 'string') {
        continue;
      }
      const msg = { ...m } as unknown as ChatKitMessage;
      if (m.specDriven !== undefined) {
        msg.specDriven = reviveCard(m.specDriven);
        if (!msg.specDriven) {
          delete msg.specDriven;
          if (m.content === '') continue; // a card and nothing else
        }
      }
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
    const keptIds = new Set(revived.map((m) => m.id));
    const meta: Record<string, MessageMeta> = {};
    if (isRecord(parsed.messageMeta)) {
      for (const [id, value] of Object.entries(parsed.messageMeta)) {
        const entry = keptIds.has(id) ? reviveMeta(value) : undefined;
        if (entry) meta[id] = entry;
      }
    }
    const conversationId = typeof parsed.conversationId === 'string' ? parsed.conversationId : undefined;
    return { messages: revived, messageMeta: meta, conversationId };
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Shared conversation state (external store)                        */
/* ------------------------------------------------------------------ */

const createId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** The project the conversation belongs to; null until the workspace opens one. */
let projectId: string | null = null;
/** Changes on a new chat, so another tab replaces its conversation instead of merging. */
let conversationId = createId();
let messages: ChatKitMessage[] = [];
let messageMeta: Record<string, MessageMeta> = {};
/** The per-tab copy kept before v8.9.3, taken on the first project open; see takeLegacyConversation. */
let legacyConversation: RevivedConversation | null = null;
const listeners = new Set<() => void>();
const remoteTurnListeners = new Set<() => void>();
const notify = (): void => listeners.forEach((l) => l());
const emit = (): void => {
  notify();
  schedulePersist();
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;

const persistNow = (): void => {
  if (!projectId) return;
  try {
    // An empty conversation is written too (not removed), so a new chat's id
    // reaches the other tabs; a removed key means a deleted or evicted one.
    const payload = serializeConversation(messages, messageMeta, conversationId);
    if (payload === null) return; // over budget even after shedding — keep last good copy
    writeStoredConversation(projectId, payload);
  } catch {
    // Unserializable message — persistence is best-effort.
  }
};

const schedulePersist = (): void => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, PERSIST_DEBOUNCE_MS);
};

const flushPersist = (): void => {
  if (!persistTimer) return;
  clearTimeout(persistTimer);
  persistTimer = null;
  persistNow();
};

const isInFlight = (m: ChatKitMessage): boolean =>
  Boolean(m.isStreaming || m.isProgress || m.specDriven?.status === 'running');

/** Each message with a time to sort by; one without a date keeps its predecessor's. */
const timed = (list: ChatKitMessage[]): Array<{ m: ChatKitMessage; t: number }> => {
  let last = 0;
  return list.map((m) => {
    const time = m.createdAt instanceof Date ? m.createdAt.getTime() : NaN;
    last = Number.isNaN(time) ? last : time;
    return { m, t: last };
  });
};

const sameShown = (a: ChatKitMessage[], b: ChatKitMessage[]): boolean =>
  a.length === b.length &&
  a.every(
    (m, i) => m.id === b[i].id && m.content === b[i].content && m.specDriven?.status === b[i].specDriven?.status,
  );

/**
 * Another tab saved this project's conversation: show it here. A new chat
 * there replaces this one; otherwise the two are merged by message id, so a
 * turn this tab has not saved yet is kept and saved back. Messages still in
 * flight here always stay. A removed or unreadable copy (the project was
 * deleted, or the copy evicted) changes nothing here.
 */
export function adoptStoredConversation(raw: string | null): void {
  const remote = reviveStoredConversation(raw);
  if (!remote) return;
  const sameConversation = remote.conversationId === conversationId;
  const remoteIds = new Set(remote.messages.map((m) => m.id));
  const localById = new Map(messages.map((m) => [m.id, m]));
  const fromRemote = remote.messages.map((m) => {
    const local = localById.get(m.id);
    return local && isInFlight(local) ? local : m;
  });
  const kept = messages.filter((m) => !remoteIds.has(m.id) && (sameConversation || isInFlight(m)));
  const merged = [...timed(fromRemote), ...timed(kept)]
    .map((entry, i) => ({ ...entry, i }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((entry) => entry.m);

  conversationId = remote.conversationId ?? createId();
  if (sameShown(merged, messages)) return;

  const meta: Record<string, MessageMeta> = {};
  for (const m of merged) {
    const local = localById.get(m.id);
    const value =
      local && (isInFlight(local) || !remoteIds.has(m.id)) ? messageMeta[m.id] : remote.messageMeta[m.id];
    if (value) meta[m.id] = value;
  }
  // The agent's memory for this tab's session lacks the other tab's turns, or
  // belongs to the conversation a new chat there replaced.
  const agentMemoryStale =
    !sameConversation || fromRemote.some((m) => !localById.has(m.id) && (m.role === 'user' || m.role === 'assistant'));
  messages = merged;
  messageMeta = meta;
  if (kept.some((m) => !isInFlight(m))) emit();
  else notify();
  if (agentMemoryStale) remoteTurnListeners.forEach((l) => l());
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // Flush the debounced write before the page unloads (a reload, the GitHub OAuth redirect).
  window.addEventListener('pagehide', flushPersist);
  // Fired in this tab when ANOTHER tab writes localStorage.
  window.addEventListener('storage', (event) => {
    if (projectId && event.key === conversationStorageKey(projectId)) adoptStoredConversation(event.newValue);
  });
}

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
  getProjectId(): string | null {
    return projectId;
  },
  /**
   * Bind the conversation to the project now open and show its saved
   * conversation (none when it has none). The previous project's pending write
   * lands first. On the first open, messages posted before the project was
   * known stay when the project has no saved conversation.
   */
  openProject(id: string): void {
    if (id === projectId) return;
    const first = projectId === null;
    flushPersist();
    if (first) legacyConversation = reviveStoredConversation(takeLegacyTabConversation(), LEGACY_MAX_AGE_MS);
    projectId = id;
    const stored = reviveStoredConversation(readStoredConversation(id));
    if (first && messages.length > 0 && !stored?.messages.length) {
      emit();
      return;
    }
    messages = stored?.messages ?? [];
    messageMeta = stored?.messageMeta ?? {};
    conversationId = stored?.conversationId ?? createId();
    notify();
  },
  /** The conversation this tab kept before v8.9.3, once; the caller checks it belongs to the project. */
  takeLegacyConversation(): RevivedConversation | null {
    const legacy = legacyConversation;
    legacyConversation = null;
    return legacy;
  },
  /** Called when another tab added turns to this conversation or started a new chat. */
  onRemoteTurns(listener: () => void): () => void {
    remoteTurnListeners.add(listener);
    return () => {
      remoteTurnListeners.delete(listener);
    };
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
  /** Start a new chat; other tabs open on the project clear theirs too. */
  clear(): void {
    if (messages.length === 0 && Object.keys(messageMeta).length === 0) return;
    conversationId = createId();
    messages = [];
    messageMeta = {};
    emit();
  },
};

/** Append an assistant message to the shared conversation; both surfaces show it. */
export function postAssistantMessage(content: string, isError = false): void {
  const id = createId();
  conversationStore.setMessages((prev) => [
    ...prev,
    { id, role: 'assistant', content, createdAt: new Date(), ...(isError ? { isError: true } : {}) },
  ]);
}

/* ------------------------------------------------------------------ */
/*  Per-turn state shared by both surfaces                            */
/* ------------------------------------------------------------------ */

// Written by the surface that sends, read by the single-dispatch winner that
// receives the reply, which may be the other surface. Per-surface refs made
// voice from the drawer stick on "Transcribing…" and auto-fix run once per
// page load.

/** Id of the optimistic "🎤 Transcribing…" bubble awaiting its echo, or null. */
export const voicePlaceholderIdRef: { current: string | null } = { current: null };

export interface AutoFixState {
  /** The current user message's one automatic repair attempt is spent. */
  attempted: boolean;
  /** The modify being applied IS that repair. */
  fixInFlight: boolean;
  /** Id of the "fixing it now…" status line, replaced by the outcome. */
  progressMessageId: string | null;
  /** The issues the repair was asked to fix, named again in its outcome. */
  issues: string[];
  /** The repair request's turnId: only its replies settle the status line. */
  turnId: string | null;
}

export const freshAutoFixState = (): AutoFixState => ({
  attempted: false,
  fixInFlight: false,
  progressMessageId: null,
  issues: [],
  turnId: null,
});

export const autoFixRef: { current: AutoFixState } = {
  current: freshAutoFixState(),
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
