import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canPersistRateLimiterState,
  claimAssistantHandleHint,
  clearAssistantSessionId,
  clearPendingAssistantPrompt,
  clearRateLimiterState,
  clearStoredConversation,
  consumeAssistantOpenOnLoad,
  readAssistantDrawerOpen,
  readAssistantSessionId,
  readAssistantUserId,
  readPendingAssistantPrompt,
  readRateLimiterState,
  readStoredConversation,
  requestAssistantOpenOnLoad,
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
    expect(readStoredConversation()).toBeNull();
    expect(() => writeStoredConversation('{}')).not.toThrow();
    expect(() => clearStoredConversation()).not.toThrow();
  });
});

describe('conversation', () => {
  it('round-trips the serialized payload', () => {
    expect(readStoredConversation()).toBeNull();
    writeStoredConversation('{"savedAt":1}');
    expect(sessionStorage.getItem(sessionStorageAssistantConversation)).toBe('{"savedAt":1}');
    expect(readStoredConversation()).toBe('{"savedAt":1}');
    clearStoredConversation();
    expect(readStoredConversation()).toBeNull();
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
