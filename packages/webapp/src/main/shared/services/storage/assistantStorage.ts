/**
 * What the browser keeps for the modeling assistant: drawer UI state and
 * one-shot hand-off flags (tab-scoped), each project's conversation, the
 * per-tab session id, the per-browser user id and the rate limiter's history.
 *
 * Functions that end in a "best effort" comment never throw; the identity and
 * rate-limiter ones throw like `Storage` does, because their callers decide.
 */
import {
  localStorageAssistantConversationPrefix,
  localStorageAssistantRateLimiterProbe,
  localStorageAssistantRateLimiterState,
  localStorageAssistantUserId,
  sessionStorageAssistantConversation,
  sessionStorageAssistantDrawerOpen,
  sessionStorageAssistantHandleHinted,
  sessionStorageAssistantSessionId,
  sessionStorageOpenAssistantOnLoad,
  sessionStoragePendingAssistantPrompt,
} from '../../constants/constant';

/* ---- Drawer and hand-off flags (sessionStorage, best effort) ---- */

/** Whether the drawer was left open in this tab. */
export function readAssistantDrawerOpen(): boolean {
  try {
    return sessionStorage.getItem(sessionStorageAssistantDrawerOpen) === '1';
  } catch {
    return false;
  }
}

export function writeAssistantDrawerOpen(open: boolean): void {
  try {
    sessionStorage.setItem(sessionStorageAssistantDrawerOpen, open ? '1' : '0');
  } catch {
    // persistence is a convenience
  }
}

/** Ask the workspace to open the drawer once the next project is loaded. */
export function requestAssistantOpenOnLoad(): void {
  try {
    sessionStorage.setItem(sessionStorageOpenAssistantOnLoad, '1');
  } catch {
    // the drawer just won't auto-open
  }
}

export function cancelAssistantOpenOnLoad(): void {
  try {
    sessionStorage.removeItem(sessionStorageOpenAssistantOnLoad);
  } catch {
    // non-fatal
  }
}

/** True once per request: reading clears it. */
export function consumeAssistantOpenOnLoad(): boolean {
  try {
    const requested = sessionStorage.getItem(sessionStorageOpenAssistantOnLoad) === '1';
    if (requested) sessionStorage.removeItem(sessionStorageOpenAssistantOnLoad);
    return requested;
  } catch {
    return false;
  }
}

/** True the first time in a tab (and records it); false after, or when storage fails. */
export function claimAssistantHandleHint(): boolean {
  try {
    if (sessionStorage.getItem(sessionStorageAssistantHandleHinted) === '1') return false;
    sessionStorage.setItem(sessionStorageAssistantHandleHinted, '1');
    return true;
  } catch {
    return false;
  }
}

/** The prompt stashed for the assistant to run, or '' when none. */
export function readPendingAssistantPrompt(): string {
  try {
    return sessionStorage.getItem(sessionStoragePendingAssistantPrompt) ?? '';
  } catch {
    return '';
  }
}

export function clearPendingAssistantPrompt(): void {
  try {
    sessionStorage.removeItem(sessionStoragePendingAssistantPrompt);
  } catch {
    // the caller's in-memory guard already prevents a replay
  }
}

/* ---- Conversation per project (localStorage, best effort) ---- */

/** Conversations kept; writing one more drops the least recently saved. */
export const MAX_STORED_CONVERSATIONS = 20;
/** All stored conversations together, in UTF-16 code units (about 2 MB): the
 * projects share the origin's quota, so conversations stay well under it. */
export const MAX_STORED_CONVERSATION_CHARS = 1_000_000;

/** The key of a project's conversation; a `storage` event with it means another tab changed it. */
export const conversationStorageKey = (projectId: string): string =>
  `${localStorageAssistantConversationPrefix}${projectId}`;

/** The project's serialized conversation, or null when none or storage is unavailable. */
export function readStoredConversation(projectId: string): string | null {
  try {
    return localStorage.getItem(conversationStorageKey(projectId));
  } catch {
    return null;
  }
}

function storedConversationKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(localStorageAssistantConversationPrefix)) keys.push(key);
  }
  return keys;
}

const savedAtOf = (raw: string): number => {
  try {
    const savedAt = (JSON.parse(raw) as { savedAt?: unknown } | null)?.savedAt;
    return typeof savedAt === 'number' ? savedAt : 0;
  } catch {
    return 0;
  }
};

/** Drop the least recently saved conversations (never `keep`) until one of `incoming` chars fits both limits. */
function makeRoom(keep: string, incoming: number): void {
  const others = storedConversationKeys()
    .filter((key) => key !== keep)
    .map((key) => ({ key, raw: localStorage.getItem(key) ?? '' }));
  let total = incoming + others.reduce((sum, o) => sum + o.key.length + o.raw.length, 0);
  let count = others.length + 1;
  if (total <= MAX_STORED_CONVERSATION_CHARS && count <= MAX_STORED_CONVERSATIONS) return;
  const oldestFirst = others
    .map((o) => ({ ...o, savedAt: savedAtOf(o.raw) }))
    .sort((a, b) => a.savedAt - b.savedAt);
  for (const o of oldestFirst) {
    if (total <= MAX_STORED_CONVERSATION_CHARS && count <= MAX_STORED_CONVERSATIONS) break;
    localStorage.removeItem(o.key);
    total -= o.key.length + o.raw.length;
    count -= 1;
  }
}

export function writeStoredConversation(projectId: string, payload: string): void {
  const key = conversationStorageKey(projectId);
  try {
    makeRoom(key, key.length + payload.length);
    localStorage.setItem(key, payload);
  } catch {
    // Full anyway (the projects fill the quota): drop the other conversations and try once more.
    try {
      clearStoredConversations(key);
      localStorage.setItem(key, payload);
    } catch {
      // keep the last good copy
    }
  }
}

export function clearStoredConversation(projectId: string): void {
  try {
    localStorage.removeItem(conversationStorageKey(projectId));
  } catch {
    // best effort
  }
}

/**
 * Remove every stored conversation but the one under `exceptKey`, to free space
 * when storage is full. A project's text copy (`assistantConversation`) still
 * restores its chat.
 */
export function clearStoredConversations(exceptKey?: string): void {
  try {
    storedConversationKeys()
      .filter((key) => key !== exceptKey)
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // best effort
  }
}

/** The conversation this tab kept before v8.9.3, when it was per tab, once: reading removes it. */
export function takeLegacyTabConversation(): string | null {
  try {
    const raw = sessionStorage.getItem(sessionStorageAssistantConversation);
    if (raw !== null) sessionStorage.removeItem(sessionStorageAssistantConversation);
    return raw;
  } catch {
    return null;
  }
}

/* ---- Session id (sessionStorage) and user id (localStorage); these throw ---- */

export const readAssistantSessionId = (): string | null =>
  sessionStorage.getItem(sessionStorageAssistantSessionId);

export const writeAssistantSessionId = (id: string): void =>
  sessionStorage.setItem(sessionStorageAssistantSessionId, id);

export const clearAssistantSessionId = (): void =>
  sessionStorage.removeItem(sessionStorageAssistantSessionId);

export const readAssistantUserId = (): string | null => localStorage.getItem(localStorageAssistantUserId);

export const writeAssistantUserId = (id: string): void => localStorage.setItem(localStorageAssistantUserId, id);

/* ---- Rate limiter history (localStorage); these throw ---- */

/** True when localStorage exists and accepts a write. */
export function canPersistRateLimiterState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const storage = window.localStorage;
    storage.setItem(localStorageAssistantRateLimiterProbe, '1');
    storage.removeItem(localStorageAssistantRateLimiterProbe);
    return true;
  } catch {
    return false;
  }
}

export const readRateLimiterState = (): string | null =>
  localStorage.getItem(localStorageAssistantRateLimiterState);

export const writeRateLimiterState = (serialized: string): void =>
  localStorage.setItem(localStorageAssistantRateLimiterState, serialized);

export const clearRateLimiterState = (): void => localStorage.removeItem(localStorageAssistantRateLimiterState);
