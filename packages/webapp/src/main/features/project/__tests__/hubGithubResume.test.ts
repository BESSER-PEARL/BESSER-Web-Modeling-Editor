import { beforeEach, describe, expect, it } from 'vitest';

import { clearHubGithubResume, peekHubGithubResume, stashHubGithubResume } from '../hubGithubResume';
import { sessionStorageContinueFromGithubIntent } from '../../../shared/constants/constant';

beforeEach(() => sessionStorage.clear());

describe('hubGithubResume', () => {
  it('reads the "Continue from GitHub" flag as the repo picker', () => {
    sessionStorage.setItem(sessionStorageContinueFromGithubIntent, '1');
    expect(peekHubGithubResume()).toEqual({ step: 'github' });
  });

  it('round-trips the create form, under the key the bootstrap keeps the hub open for', () => {
    const resume = {
      step: 'create' as const,
      entryStep: 'welcome' as const,
      form: { name: 'Shop', description: 'A shop', owner: 'me' },
      mode: 'agent' as const,
      perspectiveKey: 'all',
    };
    stashHubGithubResume(resume);
    expect(sessionStorage.getItem(sessionStorageContinueFromGithubIntent)).not.toBeNull();
    expect(peekHubGithubResume()).toEqual(resume);

    clearHubGithubResume();
    expect(peekHubGithubResume()).toBeNull();
  });

  it('ignores a value it did not write', () => {
    sessionStorage.setItem(sessionStorageContinueFromGithubIntent, '{"step":"create","form":{}}');
    expect(peekHubGithubResume()).toBeNull();
    sessionStorage.setItem(sessionStorageContinueFromGithubIntent, 'garbage');
    expect(peekHubGithubResume()).toBeNull();
  });
});
