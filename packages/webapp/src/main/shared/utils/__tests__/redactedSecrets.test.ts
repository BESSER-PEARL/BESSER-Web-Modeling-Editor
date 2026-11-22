import { describe, expect, it } from 'vitest';

import { REDACTED_SECRET, restoreRedactedSecrets } from '../redactedSecrets';

describe('restoreRedactedSecrets', () => {
  it('takes a redacted field from the local copy and keeps every other incoming value', () => {
    const incoming = { nlp: { openai_api_key: REDACTED_SECRET, language: 'fr' }, db: [{ password: REDACTED_SECRET }] };
    const local = { nlp: { openai_api_key: 'sk-local', language: 'en' }, db: [{ password: 'hunter2' }] };

    expect(restoreRedactedSecrets(incoming, local)).toEqual({
      nlp: { openai_api_key: 'sk-local', language: 'fr' },
      db: [{ password: 'hunter2' }],
    });
  });

  it('restores redacted config.yaml lines by key', () => {
    const incoming = `nlp:\n  openai:\n    api_key: '${REDACTED_SECRET}'\n  language: fr`;
    const local = 'nlp:\n  openai:\n    api_key: sk-local\n  language: en';

    expect(restoreRedactedSecrets(incoming, local)).toBe('nlp:\n  openai:\n    api_key: sk-local\n  language: fr');
  });

  it('leaves a redacted value as it is when there is nothing local to restore', () => {
    expect(restoreRedactedSecrets({ token: REDACTED_SECRET }, undefined)).toEqual({ token: REDACTED_SECRET });
    expect(restoreRedactedSecrets(`a: 1\nkey: '${REDACTED_SECRET}'`, 'a: 1')).toBe(`a: 1\nkey: '${REDACTED_SECRET}'`);
  });
});
