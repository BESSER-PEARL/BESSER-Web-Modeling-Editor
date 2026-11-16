import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canPersistRateLimiterState,
  claimAssistantHandleHint,
  clearAssistantSessionId,
  clearPendingAssistantPrompt,
  clearRateLimiterState,
  clearStoredConversation,
  conversationStorageKey,
  MAX_STORED_CONVERSATION_CHARS,
  MAX_STORED_CONVERSATIONS,
  consumeAssistantOpenOnLoad,
  readAssistantDrawerOpen,
  readAssistantSessionId,
  readAssistantUserId,
  readPendingAssistantPrompt,
  readRateLimiterState,
  readStoredConversation,
  requestAssistantOpenOnLoad,
  takeLegacyTabConversation,
  cancelAssistantOpenOnLoad,
  writeAssistantDrawerOpen,
  writeAssistantSessionId,
  writeAssistantUserId,
  writeRateLimiterState,
  writeStoredConversation,
} from '../assistantStorage';
import {
  localStorageAssistantRateLimiterProbe,
  localStorageAssistantRateLimiterState,
  localStorageAssistantUserId,
  sessionStorageAssistantConversation,
  sessionStorageAssistantDrawerOpen,
  sessionStorageAssistantSessionId,
  sessionStorageOpenAssistantOnLoad,
  sessionStoragePendingAssistantPrompt,
} from '../../../constants/constant';

const failingStorage = (storage: Storage) => {
  const fail = () => {
    throw new DOMException('denied', 'SecurityError');
  };
  vi.spyOn(storage, 'getItem').mockImplementation(fail);
  vi.spyOn(storage, 'setItem').mockImplementation(fail);
  vi.spyOn(storage, 'removeItem').mockImplementation(fail);
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawer and hand-off flags', () => {
  it('stores the drawer state as "1" / "0"', () => {
    expect(readAssistantDrawerOpen()).toBe(false);
    writeAssistantDrawerOpen(true);
    expect(sessionStorage.getItem(sessionStorageAssistantDrawerOpen)).toBe('1');
    expect(readAssistantDrawerOpen()).toBe(true);
    writeAssistantDrawerOpen(false);
    expect(sessionStorage.getItem(sessionStorageAssistantDrawerOpen)).toBe('0');
    expect(readAssistantDrawerOpen()).toBe(false);
  });

  it('opens the drawer on load exactly once per request', () => {
    expect(consumeAssistantOpenOnLoad()).toBe(false);
    requestAssistantOpenOnLoad();
    expect(sessionStorage.getItem(sessionStorageOpenAssistantOnLoad)).toBe('1');
    expect(consumeAssistantOpenOnLoad()).toBe(true);
    expect(consumeAssistantOpenOnLoad()).toBe(false);

    requestAssistantOpenOnLoad();
    cancelAssistantOpenOnLoad();
    expect(consumeAssistantOpenOnLoad()).toBe(false);
  });

  it('plays the handle hint once per tab', () => {
    expect(claimAssistantHandleHint()).toBe(true);
    expect(claimAssistantHandleHint()).toBe(false);
  });

  it('reads and clears a stashed prompt', () => {
    expect(readPendingAssistantPrompt()).toBe('');
    sessionStorage.setItem(sessionStoragePendingAssistantPrompt, 'build a shop');
    expect(readPendingAssistantPrompt()).toBe('build a shop');
    clearPendingAssistantPrompt();
    expect(readPendingAssistantPrompt()).toBe('');
  });

  it('never throws when sessionStorage does', () => {
    failingStorage(sessionStorage);
    expect(readAssistantDrawerOpen()).toBe(false);
    expect(() => writeAssistantDrawerOpen(true)).not.toThrow();
    expect(() => requestAssistantOpenOnLoad()).not.toThrow();
    expect(() => cancelAssistantOpenOnLoad()).not.toThrow();
    expect(consumeAssistantOpenOnLoad()).toBe(false);
    expect(claimAssistantHandleHint()).toBe(false);
    expect(readPendingAssistantPrompt()).toBe('');
    expect(() => clearPendingAssistantPrompt()).not.toThrow();
    expect(takeLegacyTabConversation()).toBeNull();
  });

  it('never throws when localStorage does', () => {
    failingStorage(localStorage);
    expect(readStoredConversation('p1')).toBeNull();
    expect(() => writeStoredConversation('p1', '{}')).not.toThrow();
    expect(() => clearStoredConversation('p1')).not.toThrow();
  });
});

describe('conversation', () => {
  it('keeps one conversation per project in localStorage, which every tab shares', () => {
    expect(readStoredConversation('p1')).toBeNull();
    writeStoredConversation('p1', '{"savedAt":1}');
    writeStoredConversation('p2', '{"savedAt":2}');
    expect(localStorage.getItem(conversationStorageKey('p1'))).toBe('{"savedAt":1}');
    expect(readStoredConversation('p2')).toBe('{"savedAt":2}');
    clearStoredConversation('p1');
    expect(readStoredConversation('p1')).toBeNull();
    expect(readStoredConversation('p2')).toBe('{"savedAt":2}');
  });

  it('drops the least recently saved conversations beyond the limit', () => {
    for (let i = 0; i < MAX_STORED_CONVERSATIONS; i += 1) writeStoredConversation(`p${i}`, `{"savedAt":${100 + i}}`);
    // p0 was saved again last, so p1 is now the oldest.
    writeStoredConversation('p0', '{"savedAt":500}');
    writeStoredConversation('new', '{"savedAt":600}');
    expect(readStoredConversation('p1')).toBeNull();
    expect(readStoredConversation('p0')).toBe('{"savedAt":500}');
    expect(readStoredConversation('p2')).not.toBeNull();
    expect(readStoredConversation('new')).toBe('{"savedAt":600}');
  });

  it('drops the least recently saved conversations to stay within the size budget', () => {
    const big = (savedAt: number) => `{"savedAt":${savedAt},"x":"${'a'.repeat(MAX_STORED_CONVERSATION_CHARS / 4)}"}`;
    writeStoredConversation('old', big(1));
    writeStoredConversation('middle', big(2));
    writeStoredConversation('recent', big(3));
    writeStoredConversation('new', big(4));
    expect(readStoredConversation('old')).toBeNull();
    expect(readStoredConversation('middle')).not.toBeNull();
    expect(readStoredConversation('new')).not.toBeNull();
  });

  it('when storage is full, drops the other conversations, never other data, and saves the new copy', () => {
    writeStoredConversation('other', '{"savedAt":1}');
    writeStoredConversation('p1', '{"savedAt":2}');
    localStorage.setItem('besser_project_p1', '{"id":"p1"}');
    const setItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (readStoredConversation('other') !== null) throw new DOMException('full', 'QuotaExceededError');
      setItem(key, value);
    });

    writeStoredConversation('p1', '{"savedAt":3}');
    expect(readStoredConversation('p1')).toBe('{"savedAt":3}');
    expect(readStoredConversation('other')).toBeNull();
    expect(localStorage.getItem('besser_project_p1')).toBe('{"id":"p1"}');
  });

  it('keeps the previous copy when even that does not make room', () => {
    writeStoredConversation('p1', '{"savedAt":2}');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => writeStoredConversation('p1', '{"savedAt":3}')).not.toThrow();
    expect(readStoredConversation('p1')).toBe('{"savedAt":2}');
  });

  it('evicts by the saved time, whatever the order of the keys in the payload', () => {
    // Written newest first, so the first one written is not the one to drop.
    for (let i = 0; i < MAX_STORED_CONVERSATIONS; i += 1) {
      writeStoredConversation(`p${i}`, JSON.stringify({ conversationId: 'c', savedAt: 500 - i }));
    }
    writeStoredConversation('new', JSON.stringify({ conversationId: 'c', savedAt: 600 }));
    const last = `p${MAX_STORED_CONVERSATIONS - 1}`;
    expect(readStoredConversation(last)).toBeNull();
    expect(readStoredConversation('p0')).not.toBeNull();
  });

  it("hands over the tab's copy from before v8.9.3 once", () => {
    sessionStorage.setItem(sessionStorageAssistantConversation, '{"savedAt":1}');
    expect(takeLegacyTabConversation()).toBe('{"savedAt":1}');
    expect(takeLegacyTabConversation()).toBeNull();
  });
});

describe('identity', () => {
  it('keeps the session id per tab and the user id per browser', () => {
    writeAssistantSessionId('session-1');
    writeAssistantUserId('user-1');
    expect(sessionStorage.getItem(sessionStorageAssistantSessionId)).toBe('session-1');
    expect(localStorage.getItem(localStorageAssistantUserId)).toBe('user-1');
    expect(readAssistantSessionId()).toBe('session-1');
    expect(readAssistantUserId()).toBe('user-1');
    clearAssistantSessionId();
    expect(readAssistantSessionId()).toBeNull();
  });

  it('lets the caller handle a storage failure', () => {
    failingStorage(localStorage);
    expect(() => readAssistantUserId()).toThrow();
  });
});

describe('rate limiter state', () => {
  it('probes without leaving the probe key behind', () => {
    expect(canPersistRateLimiterState()).toBe(true);
    expect(localStorage.getItem(localStorageAssistantRateLimiterProbe)).toBeNull();
  });

  it('reports no storage when a write fails', () => {
    failingStorage(localStorage);
    expect(canPersistRateLimiterState()).toBe(false);
  });

  it('round-trips the serialized state', () => {
    writeRateLimiterState('{"requestHistory":[],"lastRequestTime":0}');
    expect(localStorage.getItem(localStorageAssistantRateLimiterState)).toBe(
      '{"requestHistory":[],"lastRequestTime":0}',
    );
    expect(readRateLimiterState()).toBe('{"requestHistory":[],"lastRequestTime":0}');
    clearRateLimiterState();
    expect(readRateLimiterState()).toBeNull();
  });
});
