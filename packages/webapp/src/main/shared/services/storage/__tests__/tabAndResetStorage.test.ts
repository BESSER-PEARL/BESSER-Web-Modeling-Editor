import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { claimChunkReload, readDemoToken, readPilotParticipant, writeDemoToken, writePilotParticipant } from '../tabStorage';
import { clearAppLocalStorage } from '../resetStorage';
import {
  localStorageProjectsList,
  sessionStorageChunkReloaded,
  sessionStorageDemoToken,
  sessionStoragePilotParticipant,
} from '../../../constants/constant';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('tab storage', () => {
  it('round-trips the demo token and study label', () => {
    writeDemoToken('demo-token-123');
    writePilotParticipant('P1');
    expect(sessionStorage.getItem(sessionStorageDemoToken)).toBe('demo-token-123');
    expect(sessionStorage.getItem(sessionStoragePilotParticipant)).toBe('P1');
    expect(readDemoToken()).toBe('demo-token-123');
    expect(readPilotParticipant()).toBe('P1');
  });

  it('allows one chunk reload per tab', () => {
    expect(claimChunkReload()).toBe(true);
    expect(sessionStorage.getItem(sessionStorageChunkReloaded)).toBe('1');
    expect(claimChunkReload()).toBe(false);
  });

  it('still allows the reload when storage fails', () => {
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    expect(claimChunkReload()).toBe(true);
  });
});

describe('clearAppLocalStorage', () => {
  it('removes besser_ and legacy keys and keeps everything else', () => {
    localStorage.setItem(localStorageProjectsList, '["p1"]');
    localStorage.setItem('besser_project_p1', '{}');
    localStorage.setItem('agentConfig', '{}');
    localStorage.setItem('github_username', 'octocat');
    localStorage.setItem('umlAgentRateLimiterState', '{}');
    localStorage.setItem('besser-standalone-settings', '{}');
    localStorage.setItem('unrelated', 'x');

    clearAppLocalStorage();

    expect(localStorage.length).toBe(2);
    expect(localStorage.getItem('besser-standalone-settings')).toBe('{}');
    expect(localStorage.getItem('unrelated')).toBe('x');
  });
});
