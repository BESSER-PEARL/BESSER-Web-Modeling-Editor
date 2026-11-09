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

// The payload starts with `{"savedAt":<ms>` (assistantConversationStore writes it first).
const savedAtOf = (raw: string | null): number => Number(/^\{"savedAt":(\d+)/.exec(raw ?? '')?.[1] ?? 0);

function evictOldConversations(keep: string): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(localStorageAssistantConversationPrefix) && key !== keep) keys.push(key);
  }
  const excess = keys.length + 1 - MAX_STORED_CONVERSATIONS;
  if (excess <= 0) return;
  keys
    .sort((a, b) => savedAtOf(localStorage.getItem(a)) - savedAtOf(localStorage.getItem(b)))
    .slice(0, excess)
    .forEach((key) => localStorage.removeItem(key));
}

export function writeStoredConversation(projectId: string, payload: string): void {
  try {
    const key = conversationStorageKey(projectId);
    localStorage.setItem(key, payload);
    evictOldConversations(key);
  } catch {
    // quota exceeded or unavailable: keep the last good copy
  }
}

export function clearStoredConversation(projectId: string): void {
  try {
    localStorage.removeItem(conversationStorageKey(projectId));
  } catch {
    // best effort
  }
}

/** The conversation this tab kept before conversations moved to the project (v8.9), once: reading removes it. */
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
